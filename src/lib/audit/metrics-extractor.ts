import type { Logger } from 'pino';
import { LighthouseResult, ExtractedMetrics, Opportunity } from '@/types';

const OPPORTUNITY_AUDIT_IDS = [
  'unused-javascript',
  'render-blocking-resources',
  'uses-optimized-images',
  'uses-long-cache-ttl',
  'unused-css-rules',
] as const;

/**
 * Extracts standardized performance metrics from a Lighthouse Result (LHR) object.
 * Maps category scores (0–1) to 0–100 range.
 * Maps Core Web Vitals from audit numericValue fields.
 * Extracts top opportunities as a structured array.
 * Sets absent fields to null and emits a warn log for each missing field.
 */
export function extractMetrics(lhr: LighthouseResult, log: Logger): ExtractedMetrics {
  // ── Category scores ──────────────────────────────────────────────────────

  const performanceScore = extractScore(lhr, 'performance', log);
  const accessibilityScore = extractScore(lhr, 'accessibility', log);
  const seoScore = extractScore(lhr, 'seo', log);
  const bestPracticesScore = extractScore(lhr, 'best-practices', log);

  // ── Core Web Vitals ───────────────────────────────────────────────────────

  const lcp = extractNumericValue(lhr, 'largest-contentful-paint', log);
  const cls = extractNumericValue(lhr, 'cumulative-layout-shift', log);
  const fcp = extractNumericValue(lhr, 'first-contentful-paint', log);
  const speedIndex = extractNumericValue(lhr, 'speed-index', log);

  // INP preferred, fall back to TBT
  let inpOrTbt: number | null = null;
  const inp = lhr.audits['interaction-to-next-paint'];
  const tbt = lhr.audits['total-blocking-time'];

  if (inp?.numericValue !== undefined) {
    inpOrTbt = inp.numericValue;
  } else if (tbt?.numericValue !== undefined) {
    inpOrTbt = tbt.numericValue;
  } else {
    log.warn(
      { stage: 'metrics-extractor', missingField: 'inp_or_tbt' },
      'Missing metric field: interaction-to-next-paint and total-blocking-time both absent'
    );
  }

  // ── Opportunities ─────────────────────────────────────────────────────────

  const opportunities: Opportunity[] = [];

  for (const auditId of OPPORTUNITY_AUDIT_IDS) {
    const audit = lhr.audits[auditId];
    if (!audit) {
      log.warn(
        { stage: 'metrics-extractor', missingField: auditId },
        `Missing opportunity audit: ${auditId}`
      );
      continue;
    }

    const opportunity: Opportunity = {
      id: audit.id,
      title: audit.title,
      description: audit.description,
    };

    if (audit.details?.overallSavingsMs !== undefined) {
      opportunity.savingsMs = audit.details.overallSavingsMs;
    }
    if (audit.details?.overallSavingsBytes !== undefined) {
      opportunity.savingsBytes = audit.details.overallSavingsBytes;
    }

    opportunities.push(opportunity);
  }

  return {
    performanceScore,
    accessibilityScore,
    seoScore,
    bestPracticesScore,
    lcp,
    cls,
    inpOrTbt,
    fcp,
    speedIndex,
    opportunities,
  };
}

function extractScore(
  lhr: LighthouseResult,
  categoryKey: keyof LighthouseResult['categories'],
  log: Logger
): number | null {
  const category = lhr.categories[categoryKey];
  if (!category || category.score === null || category.score === undefined) {
    log.warn(
      { stage: 'metrics-extractor', missingField: categoryKey },
      `Missing category score: ${categoryKey}`
    );
    return null;
  }
  return Math.round(category.score * 100);
}

function extractNumericValue(
  lhr: LighthouseResult,
  auditId: string,
  log: Logger
): number | null {
  const audit = lhr.audits[auditId];
  if (!audit || audit.numericValue === undefined) {
    log.warn(
      { stage: 'metrics-extractor', missingField: auditId },
      `Missing metric field: ${auditId}`
    );
    return null;
  }
  return audit.numericValue;
}
