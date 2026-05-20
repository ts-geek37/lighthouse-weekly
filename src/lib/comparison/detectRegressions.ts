import { Opportunity } from "@/types";
import {
  MetricChange,
  RegressionItem,
  ImprovementItem,
  DeterministicRecommendation,
} from "./comparisonTypes";
import { calculateConfidence } from "./classifySeverity";

export const detectRegressionsAndImprovements =(
  metrics: Record<string, MetricChange>,
  newOpps: Opportunity[]
): { regressions: RegressionItem[]; improvements: ImprovementItem[] } => {
  const regressions: RegressionItem[] = [];
  const improvements: ImprovementItem[] = [];

  for (const [key, change] of Object.entries(metrics)) {
    if (change.status === "regressed" || change.status === "critical") {
      // Check if there is a matching opportunity in the new opportunities list
      let hasMatchingOpp = false;
      if (key === "lcp" || key === "fcp") {
        hasMatchingOpp = newOpps.some(
          (o) =>
            o.id === "render-blocking-resources" ||
            o.id === "uses-optimized-images" ||
            o.id === "unused-css-rules"
        );
      } else if (key === "inpOrTbt" || key === "performanceScore") {
        hasMatchingOpp = newOpps.some((o) => o.id === "unused-javascript");
      }

      const confidence = calculateConfidence(key, change.delta || 0, hasMatchingOpp);

      let message = "";
      if (key === "cls") {
        message = `Layout shift (CLS) increased by ${change.delta?.toFixed(3)} (${change.percentage?.toFixed(1)}% change).`;
      } else if (key === "performanceScore") {
        message = `Performance score degraded by ${Math.abs(change.delta || 0)} points.`;
      } else {
        message = `${change.label} worsened by ${Math.abs(change.delta || 0)}${change.unit} (${change.percentage?.toFixed(1)}% change).`;
      }

      regressions.push({
        metric: key,
        label: change.label,
        message,
        severity: change.severity,
        confidence,
      });
    } else if (change.status === "improved") {
      let message = "";
      if (key === "cls") {
        message = `Layout shift (CLS) reduced by ${Math.abs(change.delta || 0).toFixed(3)} (${Math.abs(change.percentage || 0).toFixed(1)}% improvement).`;
      } else if (key === "performanceScore") {
        message = `Performance score improved by ${change.delta} points.`;
      } else {
        message = `${change.label} improved by ${Math.abs(change.delta || 0)}${change.unit} (${Math.abs(change.percentage || 0).toFixed(1)}% improvement).`;
      }

      improvements.push({
        metric: key,
        label: change.label,
        message,
      });
    }
  }

  // Sort regressions: high severity first, then medium, then low
  const severityOrder = { high: 0, medium: 1, low: 2 };
  regressions.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return { regressions, improvements };
}

export const diffOpportunities = (
  prevOpps: Opportunity[],
  currOpps: Opportunity[]
): { newOpps: Opportunity[]; resolvedOpps: Opportunity[] } => {
  const prevIds = new Set(prevOpps.map((o) => o.id));
  const currIds = new Set(currOpps.map((o) => o.id));

  const newOpps = currOpps.filter((o) => !prevIds.has(o.id));
  const resolvedOpps = prevOpps.filter((o) => !currIds.has(o.id));

  return { newOpps, resolvedOpps };
}

export const generateRecommendations = (
  metrics: Record<string, MetricChange>,
  currOpps: Opportunity[],
  newOpps: Opportunity[]
): DeterministicRecommendation[] => {
  const recommendations: DeterministicRecommendation[] = [];

  const hasOpp = (id: string) => currOpps.some((o) => o.id === id);
  const hasNewOpp = (id: string) => newOpps.some((o) => o.id === id);

  const performanceRegressed =
    metrics.performanceScore.status === "regressed" ||
    metrics.performanceScore.status === "critical";

  // 1. CLS Regression & Images
  if (
    (metrics.cls.status === "regressed" || metrics.cls.status === "critical") &&
    (hasOpp("uses-optimized-images") || hasNewOpp("uses-optimized-images"))
  ) {
    recommendations.push({
      priority: "high",
      issue: "Cumulative Layout Shift (CLS) regression coupled with unoptimized image flags.",
      suggestedFixes: [
        "Ensure all image elements have explicit width and height attributes or use dynamic CSS aspect-ratio properties to reserve layout space.",
        "Ensure images above the fold use fetchpriority='high' and are preloaded.",
        "Serve images in next-gen formats (WebP/AVIF) and size them correctly to prevent excessive layout shifts during reflows.",
      ],
    });
  } else if (metrics.cls.status === "regressed" || metrics.cls.status === "critical") {
    recommendations.push({
      priority: "medium",
      issue: "Cumulative Layout Shift (CLS) has increased without image issues, indicating dynamic components.",
      suggestedFixes: [
        "Avoid injecting dynamic DOM elements (like banners or recommendation widgets) after hydration without reserving placeholder blocks.",
        "Apply CSS min-height properties to contain slow-loading dynamic containers.",
      ],
    });
  }

  // 2. LCP/Performance Regression & Render Blocking
  if (
    (metrics.lcp.status === "regressed" ||
      metrics.lcp.status === "critical" ||
      performanceRegressed) &&
    (hasOpp("render-blocking-resources") || hasNewOpp("render-blocking-resources"))
  ) {
    recommendations.push({
      priority: "high",
      issue: "Largest Contentful Paint (LCP) regression driven by render-blocking resources.",
      suggestedFixes: [
        "Audit layout files and ensure <script> tags are marked with defer or async strategies.",
        "Inline critical CSS and delay importing non-essential stylesheets.",
        "Split dynamic subtrees using Next.js dynamic imports (lazy loading) to shrink initial bundles.",
      ],
    });
  }

  // 3. TBT/INP Regression & Unused JavaScript
  if (
    (metrics.inpOrTbt.status === "regressed" ||
      metrics.inpOrTbt.status === "critical" ||
      performanceRegressed) &&
    (hasOpp("unused-javascript") || hasNewOpp("unused-javascript"))
  ) {
    recommendations.push({
      priority: "high",
      issue: "Main thread block times (INP/TBT) increased, indicating heavy bundle parsing or large execution scripts.",
      suggestedFixes: [
        "Utilize Next.js Script optimization component with strategy='lazyOnload' for external third-party scripts.",
        "Analyze Webpack/Next bundle size and replace heavy library imports (e.g. importing full lodash or moment).",
        "Refactor component barrel file exports that might be drawing dead code into production builds.",
      ],
    });
  }

  // 4. TTFB Regression & Caching
  if (
    metrics.ttfb.status === "regressed" ||
    metrics.ttfb.status === "critical"
  ) {
    recommendations.push({
      priority: "medium",
      issue: "Time to First Byte (TTFB) server latency increased.",
      suggestedFixes: [
        "Verify stale-while-revalidate caching headers are correctly set in the CDN or hosting server config.",
        "Optimize API router handler databases requests (add selective selects, indexes, or memoize heavy fetching).",
        "Enable compression (gzip/brotli) if it was disabled on the deployment edge.",
      ],
    });
  }

  // Fallback default recommendation if performance degraded but nothing specific was caught
  if (recommendations.length === 0 && performanceRegressed) {
    recommendations.push({
      priority: "medium",
      issue: "General performance regression detected.",
      suggestedFixes: [
        "Audit recently added packages in package.json.",
        "Check network request waterfalls in Chrome DevTools to locate blocking static chunks.",
      ],
    });
  }

  // Sort: High priority first, then Medium, then Low
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return recommendations;
}
