import lighthouse from 'lighthouse';
import { launch, LaunchedChrome } from 'chrome-launcher';
import type { Logger } from 'pino';
import { LighthouseResult } from '@/types';

export interface AuditRunnerOptions {
  url: string;
  device?: 'mobile' | 'desktop';
  timeoutMs?: number;
  maxRetries?: number;
}

export type AuditRunnerResult =
  | { success: true; lhr: LighthouseResult; htmlReport: string }
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
  const { url, device = 'mobile', timeoutMs = 60_000, maxRetries = 2 } = options;

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
          output: ['json', 'html'],
          onlyCategories: ['performance', 'accessibility', 'seo', 'best-practices'],
          logLevel: 'silent',
          ...(device === 'desktop' ? {
            formFactor: 'desktop',
            screenEmulation: {
              mobile: false,
              width: 1350,
              height: 940,
              deviceScaleFactor: 1,
              disabled: false,
            },
            throttling: {
              rttMs: 40,
              throughputKbps: 10 * 1024,
              cpuSlowdownMultiplier: 1,
            },
          } : {})
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Audit timed out after ${timeoutMs}ms`)), timeoutMs)
        ),
      ]);

      if (!runnerResult || !runnerResult.lhr) {
        throw new Error('Lighthouse returned no result');
      }

      log.info({ stage: 'audit-runner', url, attempt }, 'Lighthouse audit completed successfully');

      const lhr = runnerResult.lhr as unknown as LighthouseResult;
      // runnerResult.report is an array [jsonReport, htmlReport] when output is ['json', 'html']
      const htmlReport = Array.isArray(runnerResult.report) 
        ? runnerResult.report[1] 
        : (runnerResult.report as string);

      return { success: true, lhr, htmlReport };
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
