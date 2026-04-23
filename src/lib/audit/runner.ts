import lighthouse from 'lighthouse';
import { launch, LaunchedChrome } from 'chrome-launcher';
import type { Logger } from 'pino';
import { LighthouseResult } from '@/types';

export interface AuditRunnerOptions {
  url: string;
  timeoutMs?: number;
  maxRetries?: number;
}

export type AuditRunnerResult =
  | { success: true; lhr: LighthouseResult }
  | { success: false; error: string };

/**
 * Runs a Lighthouse audit against the given URL using the Lighthouse Node API.
 * Launches headless Chrome via chrome-launcher, runs the audit, then kills Chrome.
 * Retries up to maxRetries times on failure.
 */
export async function runAudit(
  options: AuditRunnerOptions,
  log: Logger
): Promise<AuditRunnerResult> {
  const { url, timeoutMs = 60_000, maxRetries = 2 } = options;

  let lastError = '';

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      log.warn(
        { stage: 'audit-runner', url, attempt },
        `Retrying Lighthouse audit (attempt ${attempt} of ${maxRetries})`
      );
    }

    let chrome: LaunchedChrome | null = null;

    try {
      chrome = await launch({
        chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu'],
      });

      const runnerResult = await Promise.race([
        lighthouse(url, {
          port: chrome.port,
          output: 'json',
          onlyCategories: ['performance', 'accessibility', 'seo', 'best-practices'],
          logLevel: 'silent',
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Audit timed out after ${timeoutMs}ms`)), timeoutMs)
        ),
      ]);

      if (!runnerResult || !runnerResult.lhr) {
        throw new Error('Lighthouse returned no result');
      }

      log.info({ stage: 'audit-runner', url, attempt }, 'Lighthouse audit completed successfully');

      return { success: true, lhr: runnerResult.lhr as unknown as LighthouseResult };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);

      if (attempt < maxRetries) {
        log.warn(
          { stage: 'audit-runner', url, attempt, err: lastError },
          'Lighthouse audit failed, will retry'
        );
      }
    } finally {
      if (chrome) {
        try {
          await chrome.kill();
        } catch {
          // Ignore kill errors — Chrome may have already exited
        }
      }
    }
  }

  log.error(
    { stage: 'audit-runner', url, maxRetries, err: lastError },
    'Lighthouse audit failed after all retry attempts'
  );

  return { success: false, error: lastError };
}
