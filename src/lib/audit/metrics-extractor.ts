import type { Logger } from "pino";
import {
  LighthouseResult,
  ExtractedMetrics,
  Opportunity,
  OpportunityItem,
  AdvancedDiagnostics,
} from "@/types";

const OPPORTUNITY_AUDIT_IDS = [
  "unused-javascript",
  "render-blocking-resources",
  "uses-optimized-images",
  "uses-long-cache-ttl",
  "unused-css-rules",
] as const;

export const extractAdvancedDiagnostics = (lhr: any, log: Logger): AdvancedDiagnostics => {
  // 1. third-party-summary
  const tpSummaryRaw = lhr.audits['third-party-summary']?.details?.items || [];
  const thirdPartySummary = tpSummaryRaw.map((item: any) => ({
    entityName: item.entity?.name || String(item.entity || 'Unknown'),
    transferSize: Number(item.transferSize || 0),
    mainThreadTime: Number(item.mainThreadTime || 0),
    blockingTime: Number(item.blockingTime || 0),
  }));

  // 2. bootup-time
  const bootupRaw = lhr.audits['bootup-time']?.details?.items || [];
  const bootupTime = bootupRaw.map((item: any) => ({
    url: String(item.url || ''),
    total: Number(item.total || 0),
    scripting: Number(item.scripting || 0),
    scriptParseCompile: Number(item.scriptParseCompile || 0),
  }));

  // 3. mainthread-work-breakdown
  const mtRaw = lhr.audits['mainthread-work-breakdown']?.details?.items || [];
  const mainthreadWorkBreakdown = mtRaw.map((item: any) => ({
    group: String(item.group || ''),
    groupLabel: String(item.groupLabel || ''),
    duration: Number(item.duration || 0),
  }));

  // 4. diagnostics
  const diagRaw = lhr.audits['diagnostics']?.details?.items?.[0] || null;
  const diagnostics = diagRaw
    ? {
        numRequests: diagRaw.numRequests !== undefined ? Number(diagRaw.numRequests) : undefined,
        numScripts: diagRaw.numScripts !== undefined ? Number(diagRaw.numScripts) : undefined,
        numStylesheets: diagRaw.numStylesheets !== undefined ? Number(diagRaw.numStylesheets) : undefined,
        numFonts: diagRaw.numFonts !== undefined ? Number(diagRaw.numFonts) : undefined,
        numTasks: diagRaw.numTasks !== undefined ? Number(diagRaw.numTasks) : undefined,
        rtt: diagRaw.rtt !== undefined ? Number(diagRaw.rtt) : undefined,
        throughput: diagRaw.throughput !== undefined ? Number(diagRaw.throughput) : undefined,
        maxRtt: diagRaw.maxRtt !== undefined ? Number(diagRaw.maxRtt) : undefined,
        maxServerLatency: diagRaw.maxServerLatency !== undefined ? Number(diagRaw.maxServerLatency) : undefined,
        totalByteWeight: diagRaw.totalByteWeight !== undefined ? Number(diagRaw.totalByteWeight) : undefined,
        totalTaskTime: diagRaw.totalTaskTime !== undefined ? Number(diagRaw.totalTaskTime) : undefined,
      }
    : null;

  // 5. network-requests
  const netRaw = lhr.audits['network-requests']?.details?.items || [];
  const networkRequests = netRaw.map((item: any) => ({
    url: String(item.url || ''),
    protocol: String(item.protocol || ''),
    startTime: Number(item.startTime || 0),
    endTime: Number(item.endTime || 0),
    transferSize: Number(item.transferSize || 0),
    resourceSize: Number(item.resourceSize || 0),
    statusCode: Number(item.statusCode || 0),
    mimeType: String(item.mimeType || ''),
    resourceType: String(item.resourceType || ''),
  }));

  // 6. long-tasks
  const ltRaw = lhr.audits['long-tasks']?.details?.items || [];
  const longTasks = ltRaw.map((item: any) => ({
    url: item.url ? String(item.url) : undefined,
    duration: Number(item.duration || 0),
    startTime: Number(item.startTime || 0),
  }));

  // 7. duplicated-javascript
  const dupRaw = lhr.audits['duplicated-javascript']?.details?.items || [];
  const duplicatedJavascript = dupRaw.map((item: any) => ({
    source: String(item.source || ''),
    wastedBytes: Number(item.wastedBytes || 0),
    url: String(item.url || ''),
  }));

  // 8. legacy-javascript
  const legRaw = lhr.audits['legacy-javascript']?.details?.items || [];
  const legacyJavascript = legRaw.map((item: any) => ({
    url: String(item.url || ''),
    wastedBytes: Number(item.wastedBytes || 0),
    signals: Array.isArray(item.signals) ? item.signals.map(String) : [],
  }));

  // 9. render-blocking-resources
  const rbRaw = lhr.audits['render-blocking-resources']?.details?.items || [];
  const renderBlockingResources = rbRaw.map((item: any) => ({
    url: String(item.url || ''),
    wastedMs: Number(item.wastedMs || 0),
    totalBytes: Number(item.totalBytes || item.wastedBytes || 0),
  }));

  // 10. critical-request-chains
  const criticalRequestChains = lhr.audits['critical-request-chains']?.details?.chains || null;

  // 11. largest-contentful-paint-element
  const lcpElemRaw = lhr.audits['largest-contentful-paint-element']?.details?.items?.[0] || null;
  const lcpElement = lcpElemRaw
    ? {
        nodeLabel: String(lcpElemRaw.node?.nodeLabel || ''),
        path: lcpElemRaw.node?.path ? String(lcpElemRaw.node.path) : undefined,
        snippet: lcpElemRaw.node?.snippet ? String(lcpElemRaw.node.snippet) : undefined,
      }
    : null;

  // 12. layout-shift-elements
  const lsRaw = lhr.audits['layout-shift-elements']?.details?.items || [];
  const layoutShiftElements = lsRaw.map((item: any) => ({
    nodeLabel: String(item.node?.nodeLabel || ''),
    snippet: item.node?.snippet ? String(item.node.snippet) : undefined,
    score: Number(item.score || 0),
  }));

  // 13. screenshot-thumbnails
  const stRaw = lhr.audits['screenshot-thumbnails']?.details?.items || [];
  const screenshotThumbnails = stRaw.map((item: any) => ({
    data: String(item.data || ''),
    timing: Number(item.timing || 0),
  }));

  // 14. final-screenshot
  const finalScreenshot = lhr.audits['final-screenshot']?.details?.data || null;

  // 15. DOM size
  const domSize = lhr.audits['dom-size']?.numericValue !== undefined
    ? Number(lhr.audits['dom-size'].numericValue)
    : null;

  // 16. unused-javascript
  const unusedJsRaw = lhr.audits['unused-javascript']?.details?.items || [];
  const unusedJavascript = unusedJsRaw.map((item: any) => ({
    url: String(item.url || ''),
    wastedBytes: Number(item.wastedBytes || 0),
    totalBytes: Number(item.totalBytes || 0),
  }));

  // 17. unused-css-rules
  const unusedCssRaw = lhr.audits['unused-css-rules']?.details?.items || [];
  const unusedCssRules = unusedCssRaw.map((item: any) => ({
    url: String(item.url || ''),
    wastedBytes: Number(item.wastedBytes || 0),
    totalBytes: Number(item.totalBytes || 0),
  }));

  return {
    thirdPartySummary,
    bootupTime,
    mainthreadWorkBreakdown,
    diagnostics,
    networkRequests,
    longTasks,
    duplicatedJavascript,
    legacyJavascript,
    renderBlockingResources,
    criticalRequestChains,
    lcpElement,
    layoutShiftElements,
    screenshotThumbnails,
    finalScreenshot,
    domSize,
    unusedJavascript,
    unusedCssRules,
  };
}

/**
 * Extracts standardized performance metrics from a Lighthouse Result (LHR) object.
 * Maps category scores (0–1) to 0–100 range.
 * Maps Core Web Vitals from audit numericValue fields.
 * Extracts top opportunities as a structured array.
 * Sets absent fields to null and emits a warn log for each missing field.
 */
export const extractMetrics = (
  lhr: LighthouseResult,
  log: Logger,
): ExtractedMetrics => {
  // ── Category scores ──────────────────────────────────────────────────────

  const performanceScore = extractScore(lhr, "performance", log);
  const accessibilityScore = extractScore(lhr, "accessibility", log);
  const seoScore = extractScore(lhr, "seo", log);
  const bestPracticesScore = extractScore(lhr, "best-practices", log);

  // ── Core Web Vitals ───────────────────────────────────────────────────────

  const lcp = extractNumericValue(lhr, "largest-contentful-paint", log);
  const cls = extractNumericValue(lhr, "cumulative-layout-shift", log);
  const fcp = extractNumericValue(lhr, "first-contentful-paint", log);
  const speedIndex = extractNumericValue(lhr, "speed-index", log);
  const ttfb = extractNumericValue(lhr, "server-response-time", log);

  // INP preferred, fall back to TBT
  let inpOrTbt: number | null = null;
  const inp = lhr.audits["interaction-to-next-paint"];
  const tbt = lhr.audits["total-blocking-time"];

  if (inp?.numericValue !== undefined) {
    inpOrTbt = inp.numericValue;
  } else if (tbt?.numericValue !== undefined) {
    inpOrTbt = tbt.numericValue;
  } else {
    log.warn(
      { stage: "metrics-extractor", missingField: "inp_or_tbt" },
      "Missing metric field: interaction-to-next-paint and total-blocking-time both absent",
    );
  }

  // ── Opportunities ─────────────────────────────────────────────────────────

  const opportunities: Opportunity[] = [];

  for (const auditId of OPPORTUNITY_AUDIT_IDS) {
    const audit = lhr.audits[auditId];
    if (!audit) {
      log.warn(
        { stage: "metrics-extractor", missingField: auditId },
        `Missing opportunity audit: ${auditId}`,
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

    // Extract top 3 offending resources from details.items
    if (audit.details?.items && audit.details.items.length > 0) {
      const rawItems = audit.details.items;
      // Sort by wastedBytes desc, then wastedMs desc, then totalBytes desc
      const sorted = [...rawItems].sort((a, b) => {
        const wastedA = (a.wastedBytes ?? 0) + (a.wastedMs ?? 0) * 100;
        const wastedB = (b.wastedBytes ?? 0) + (b.wastedMs ?? 0) * 100;
        if (wastedB !== wastedA) return wastedB - wastedA;
        return (b.totalBytes ?? 0) - (a.totalBytes ?? 0);
      });
      opportunity.items = sorted
        .slice(0, 3)
        .reduce<OpportunityItem[]>((acc, item) => {
          if (typeof item.url === "string" && item.url) {
            acc.push({
              url: item.url,
              ...(item.totalBytes !== undefined && {
                totalBytes: item.totalBytes,
              }),
              ...(item.wastedBytes !== undefined && {
                wastedBytes: item.wastedBytes,
              }),
              ...(item.wastedMs !== undefined && { wastedMs: item.wastedMs }),
              ...(item.cacheLifetimeMs !== undefined && {
                cacheLifetimeMs: item.cacheLifetimeMs,
              }),
            });
          }
          return acc;
        }, []);
      if (opportunity.items.length === 0) delete opportunity.items;
    }

    opportunities.push(opportunity);
  }

  const advancedDiagnostics = extractAdvancedDiagnostics(lhr, log);

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
    ttfb,
    opportunities,
    advancedDiagnostics,
  };
}

const extractScore = (
  lhr: LighthouseResult,
  categoryKey: keyof LighthouseResult["categories"],
  log: Logger,
): number | null => {
  const category = lhr.categories[categoryKey];
  if (!category || category.score === null || category.score === undefined) {
    log.warn(
      { stage: "metrics-extractor", missingField: categoryKey },
      `Missing category score: ${categoryKey}`,
    );
    return null;
  }
  return Math.round(category.score * 100);
};

const extractNumericValue = (
  lhr: LighthouseResult,
  auditId: string,
  log: Logger,
): number | null => {
  const audit = lhr.audits[auditId];
  if (!audit || audit.numericValue === undefined) {
    log.warn(
      { stage: "metrics-extractor", missingField: auditId },
      `Missing metric field: ${auditId}`,
    );
    return null;
  }
  return Math.round(audit.numericValue * 100) / 100;
};
