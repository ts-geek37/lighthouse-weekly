import Groq from "groq-sdk";
import type { Logger } from "pino";
import {
  ExtractedMetrics,
  AgentPrompt,
  AiSummaryOutput,
  MetricSituation,
  MetricClassification,
  PageTypeRule,
  CausalRule,
  ResolvedCausalRule,
  Opportunity,
  DetectedSituation,
  RuleEngineOutput,
  InvestigationStepFn,
} from "@/types";

export interface AiSummaryInput {
  url: string;
  pageType: string;
  metrics: ExtractedMetrics;
  previousMetrics?: Partial<ExtractedMetrics>; // optional, from prior AuditRun
}

export type AiSummaryResult =
  | { success: true; output: AiSummaryOutput }
  | { success: false; fallback: string };

const GROQ_MODEL = "llama-3.3-70b-versatile";
const RETRY_DELAY_MS = 5_000;

const THRESHOLDS = {
  lcp: {
    good: 2500,
    poor: 4000,
    unit: "ms",
    label: "Largest Contentful Paint",
  },
  cls: { good: 0.1, poor: 0.25, unit: "", label: "Cumulative Layout Shift" },
  inpOrTbt: {
    good: 200,
    poor: 500,
    unit: "ms",
    label: "INP / Total Blocking Time",
  },
  fcp: { good: 1800, poor: 3000, unit: "ms", label: "First Contentful Paint" },
  speedIndex: { good: 3400, poor: 5800, unit: "ms", label: "Speed Index" },
};

const PAGE_TYPE_RULES: Record<string, PageTypeRule> = {
  homepage: {
    criticalVitals: ["lcp", "fcp"],
    primaryConcern:
      "First impression — LCP and FCP directly affect bounce rate",
    scoreFloor: 85,
  },
  checkout: {
    criticalVitals: ["cls", "inpOrTbt"],
    primaryConcern:
      "CLS causes mis-taps on payment buttons. INP delays hurt conversion.",
    scoreFloor: 90,
  },
  "product-listing": {
    criticalVitals: ["lcp", "speedIndex"],
    primaryConcern:
      "Image-heavy pages — LCP is almost always an image. Speed Index affects perceived load.",
    scoreFloor: 80,
  },
  article: {
    criticalVitals: ["lcp", "fcp"],
    primaryConcern:
      "SEO-sensitive — Core Web Vitals are a ranking signal for content pages.",
    scoreFloor: 75,
  },
  dashboard: {
    criticalVitals: ["inpOrTbt", "cls"],
    primaryConcern:
      "Interaction-heavy — TBT/INP directly affects usability of controls and data tables.",
    scoreFloor: 70,
  },
  default: {
    criticalVitals: ["lcp", "cls", "inpOrTbt", "fcp", "speedIndex"],
    primaryConcern: "All Core Web Vitals are critical for this page type.",
    scoreFloor: 70,
  },
};

const OPPORTUNITY_CAUSAL_RULES: Record<string, CausalRule> = {
  "render-blocking-resources": {
    affectsVitals: ["lcp", "fcp"],
    condition: (m) => m.lcp !== null || m.fcp !== null,
    causalExplanation: (m) => {
      const parts: string[] = [];
      if (m.lcp !== null) {
        const sit = classifyMetric("lcp", m.lcp);
        if (sit !== "EXCELLENT")
          parts.push(
            `LCP is ${Math.round(m.lcp)}ms — render-blocking resources delay the browser from painting the largest element`,
          );
      }
      if (m.fcp !== null) {
        const sit = classifyMetric("fcp", m.fcp);
        if (sit !== "EXCELLENT")
          parts.push(
            `FCP is ${Math.round(m.fcp)}ms — blocking scripts stall the first byte of visible content`,
          );
      }
      return (
        parts.join(". ") ||
        "No vitals currently failing, but this is a regression risk on slower connections."
      );
    },
  },
  "unused-javascript": {
    affectsVitals: ["inpOrTbt", "lcp"],
    condition: (m) => m.inpOrTbt !== null || m.lcp !== null,
    causalExplanation: (m) => {
      const tbt =
        m.inpOrTbt !== null ? `${Math.round(m.inpOrTbt)}ms` : "unknown";
      return `Unused JS increases main thread parse/compile time. TBT is currently ${tbt} — excess JS is the most common driver of high TBT on Next.js apps.`;
    },
  },
  "uses-optimized-images": {
    affectsVitals: ["lcp", "cls"],
    condition: (m) => m.lcp !== null || m.cls !== null,
    causalExplanation: (m) => {
      const lcp = m.lcp !== null ? `${Math.round(m.lcp)}ms` : "unknown";
      const cls = m.cls !== null ? m.cls.toFixed(3) : "unknown";
      return `LCP is ${lcp} — on most pages the LCP element is an image. Unoptimized images (wrong format, no width/height) both slow LCP and cause layout shift (CLS: ${cls}).`;
    },
  },
  "uses-long-cache-ttl": {
    affectsVitals: [],
    condition: () => true,
    causalExplanation: () =>
      `Cache TTL does not affect first-load Core Web Vitals. It directly affects repeat-visit performance — users who return to the page re-download all assets that lack long-lived Cache-Control headers. This is invisible in a single Lighthouse run.`,
  },
  "unused-css-rules": {
    affectsVitals: ["fcp", "lcp"],
    condition: (m) => m.fcp !== null || m.lcp !== null,
    causalExplanation: (m) => {
      const fcp = m.fcp !== null ? `${Math.round(m.fcp)}ms` : "unknown";
      return `Unused CSS bloats the render-blocking stylesheet payload. FCP is ${fcp} — reducing CSS parse time is a direct lever.`;
    },
  },
};

const ZERO_SAVINGS_RISK_RATIONALE: Record<string, string> = {
  "uses-long-cache-ttl":
    "affects repeat-visit performance — users re-download all assets without long-lived Cache-Control headers",
  "uses-optimized-images":
    "unoptimized image formats increase LCP on slower connections and cause layout shift when width/height are absent",
  "render-blocking-resources":
    "no savings estimate does not mean no impact — blocking resources delay FCP and LCP on slower connections",
  "unused-css-rules":
    "unused CSS bloats the render-blocking stylesheet payload, delaying FCP on first load",
};

export function resolveCausalRules(
  metrics: ExtractedMetrics,
  opportunities: Opportunity[],
): ResolvedCausalRule[] {
  const resolved: ResolvedCausalRule[] = [];
  for (const opp of opportunities) {
    const rule = OPPORTUNITY_CAUSAL_RULES[opp.id];
    if (!rule) continue;
    if (rule.condition(metrics)) {
      resolved.push({
        opportunityId: opp.id,
        affectsVitals: rule.affectsVitals,
        causalExplanation: rule.causalExplanation(metrics),
      });
    }
  }
  return resolved;
}

export function detectSituations(
  metrics: ExtractedMetrics,
  pageType: string,
  opportunities: Opportunity[],
): DetectedSituation[] {
  const situations: DetectedSituation[] = [];
  const pageRule = PAGE_TYPE_RULES[pageType] ?? PAGE_TYPE_RULES["default"];
  const classifications = classifyAllMetrics(metrics);

  // 5.1 SCORE_BELOW_FLOOR
  if (
    metrics.performanceScore !== null &&
    metrics.performanceScore < pageRule.scoreFloor
  ) {
    situations.push({
      tag: "SCORE_BELOW_FLOOR",
      severity: "critical",
      message: `Performance score ${metrics.performanceScore} is below the ${pageRule.scoreFloor} floor for ${pageType} pages. ${pageRule.primaryConcern}`,
    });
  }

  // 5.2 FALSE_GREEN
  const allCriticalGoodOrBetter = pageRule.criticalVitals.every((v) =>
    ["GOOD", "EXCELLENT", "AT_RISK"].includes(classifications[v]),
  );
  const hasHighImpactOpportunities = opportunities.some(
    (o) => (o.savingsMs ?? 0) > 500 || (o.savingsBytes ?? 0) > 100_000,
  );
  if (allCriticalGoodOrBetter && hasHighImpactOpportunities) {
    situations.push({
      tag: "FALSE_GREEN",
      severity: "warning",
      message: `Vitals appear healthy but high-impact opportunities remain — score may degrade under real-world conditions`,
    });
  }

  // 5.3 CLS_IMAGE_COMBINED
  const clsClass = classifications["cls"];
  const hasImageOpp = opportunities.some(
    (o) => o.id === "uses-optimized-images",
  );
  if ((clsClass === "POOR" || clsClass === "CRITICAL") && hasImageOpp) {
    situations.push({
      tag: "CLS_IMAGE_COMBINED",
      severity: "critical",
      message: `CLS is ${metrics.cls?.toFixed(3)} and unoptimized images are present — missing width/height attributes are likely causing layout shift`,
    });
  }

  // 5.4 TBT_BUNDLE_PROBLEM
  const tbtClass = classifications["inpOrTbt"];
  const hasJsOpp = opportunities.some((o) => o.id === "unused-javascript");
  if ((tbtClass === "POOR" || tbtClass === "CRITICAL") && hasJsOpp) {
    situations.push({
      tag: "TBT_BUNDLE_PROBLEM",
      severity: "critical",
      message: `INP/TBT is ${Math.round(metrics.inpOrTbt ?? 0)}ms and unused JS is flagged — long tasks from oversized bundles are blocking the main thread`,
    });
  }

  // 5.5 LCP_RENDER_BLOCKED
  const lcpClass = classifications["lcp"];
  const hasRenderBlockingOpp = opportunities.some(
    (o) => o.id === "render-blocking-resources",
  );
  if (
    (lcpClass === "POOR" ||
      lcpClass === "CRITICAL" ||
      lcpClass === "AT_RISK") &&
    hasRenderBlockingOpp
  ) {
    situations.push({
      tag: "LCP_RENDER_BLOCKED",
      severity: lcpClass === "AT_RISK" ? "warning" : "critical",
      message: `LCP is ${Math.round(metrics.lcp ?? 0)}ms and render-blocking resources are present — parser-blocking scripts/CSS are delaying the largest paint`,
    });
  }

  return situations;
}

export function classifyMetric(
  key: keyof typeof THRESHOLDS,
  value: number | null,
): MetricSituation {
  if (value === null) return "GOOD";
  const t = THRESHOLDS[key];
  if (value > t.poor) return "CRITICAL";
  if (value > t.good) return "POOR";
  if (value / t.good > 0.8) return "AT_RISK";
  if (value / t.good <= 0.6) return "EXCELLENT";
  return "GOOD";
}

export function classifyAllMetrics(
  metrics: ExtractedMetrics,
): MetricClassification {
  return {
    lcp: classifyMetric("lcp", metrics.lcp),
    cls: classifyMetric("cls", metrics.cls),
    inpOrTbt: classifyMetric("inpOrTbt", metrics.inpOrTbt),
    fcp: classifyMetric("fcp", metrics.fcp),
    speedIndex: classifyMetric("speedIndex", metrics.speedIndex),
  };
}

function scoreLabel(score: number | null): string {
  if (score === null) return "N/A";
  if (score >= 90) return `${score}/100 (Good)`;
  if (score >= 50) return `${score}/100 (Needs Improvement)`;
  return `${score}/100 (Poor)`;
}

const INVESTIGATION_STEPS: Record<string, InvestigationStepFn> = {
  "unused-javascript": (metrics, situation) => {
    const tbt = metrics.inpOrTbt !== null ? Math.round(metrics.inpOrTbt) : null;
    const urgency =
      situation === "CRITICAL" || situation === "POOR"
        ? `TBT is ${tbt}ms — this is actively hurting interactivity. Prioritize this immediately.`
        : `TBT is within threshold but this is technical debt that will compound.`;
    return `${urgency}

1. Run: npx next build && npx next-bundle-analyzer (or check .next/analyze/ if already configured)
2. Search for full library imports: grep -r "from 'lodash'" src/ — should be "from 'lodash/get'" etc.
3. Find barrel file re-exports: grep -r "export \\*" src/ — these defeat tree-shaking
4. Check next.config.ts for missing optimizePackageImports entries
5. Search for synchronous imports that could be dynamic: find components using heavy libraries only on interaction
Report: list each file with import path, estimated bundle contribution, and whether it can be lazy-loaded`;
  },

  "render-blocking-resources": (metrics, situation) => {
    const lcp = metrics.lcp !== null ? Math.round(metrics.lcp) : null;
    const focus =
      lcp && lcp > THRESHOLDS.lcp.poor
        ? `LCP is ${lcp}ms (CRITICAL). Render-blocking resources are the most likely primary cause.`
        : lcp && lcp > THRESHOLDS.lcp.good
          ? `LCP is ${lcp}ms (POOR). Unblocking render is a high-leverage fix.`
          : `LCP is within threshold, but render-blocking resources create fragility on slower connections.`;
    return `${focus}

1. Check _document.tsx and layout.tsx <head> for <script> tags without defer/async
2. grep -r "<script" src/ app/ pages/ — list every script tag and its attributes
3. Check next.config.ts for Script strategy settings (beforeInteractive scripts block render)
4. Find CSS @import inside .css/.scss files — these chain-block rendering
5. Identify third-party scripts (analytics, chat, A/B testing) — these are the most common offenders
Report: list each blocking resource, its origin (first/third party), file location, and estimated impact`;
  },

  "uses-optimized-images": (_metrics, _situation) => `
1. Find all <img> tags, next/image components, CSS background-image declarations
2. Check what image formats are being served — look at the actual file extensions in /public or CDN config
3. Identify images missing explicit width and height attributes (causes layout shift)
4. Find images above the fold that lack fetchpriority="high" or <link rel="preload">
5. Check if your image pipeline (sharp, imagemin, CDN transforms) is configured and actually running
6. Look for images served at a larger resolution than their display size
Report: list each problematic image with its location, current format/size, and what's missing`,

  "uses-long-cache-ttl": (_metrics, _situation) => `
1. Find your server headers configuration (next.config.ts headers(), nginx.conf, vercel.json, _headers file)
2. Check Cache-Control headers currently set on static assets (JS, CSS, images, fonts)
3. Verify whether static assets have content-hash in their filenames (required for long TTL)
4. Look for any middleware that strips or overrides cache headers
5. Check CDN configuration if applicable
Report: list each asset type with its current TTL, whether it has content-hash, and what TTL is safe`,

  "unused-css-rules": (_metrics, _situation) => `
1. Check if PurgeCSS, UnCSS, or Tailwind's content purging is configured
2. Look for global CSS files imported in _app.tsx, layout.tsx, or index.html
3. Find CSS frameworks (Bootstrap, Bulma) loaded in full — check if only a subset is used
4. Search for CSS-in-JS libraries and check if they have dead code elimination
5. Look for component-level CSS files that import shared utilities they don't use
Report: list each source of unused CSS with file location, estimated size, and why it's unused`,
};

export function getInvestigationSteps(
  opportunityId: string,
  metrics: ExtractedMetrics,
  situation: MetricSituation,
): string {
  const fn = INVESTIGATION_STEPS[opportunityId];
  if (fn) return fn(metrics, situation);
  return `
1. Search the codebase for code patterns related to "${opportunityId}"
2. Identify which files or components are responsible
3. Check configuration files that might control this behavior
4. Look for any existing optimizations that may be misconfigured
Report: describe what you found, where it is, and what change would address it`;
}

function margin(key: keyof typeof THRESHOLDS, value: number | null): string {
  if (value === null) return "";
  const t = THRESHOLDS[key];
  const unit = t.unit;
  if (key === "cls") {
    const diff = t.good - value;
    return diff > 0
      ? ` (${diff.toFixed(3)} below the ${t.good} good threshold)`
      : ` (${Math.abs(diff).toFixed(3)} above the ${t.good} good threshold — FAILING)`;
  }
  const diff = t.good - Math.round(value);
  return diff > 0
    ? ` (${diff}${unit} below the ${t.good}${unit} good threshold)`
    : ` (${Math.abs(diff)}${unit} above the ${t.good}${unit} good threshold — FAILING)`;
}

export function buildSummaryPrompt(
  input: AiSummaryInput,
  ruleOutput: RuleEngineOutput,
): string {
  const { url, pageType, metrics } = input;
  const { classifications, situations } = ruleOutput;

  const vitals = [
    { key: "lcp" as const, value: metrics.lcp, label: "LCP" },
    { key: "cls" as const, value: metrics.cls, label: "CLS" },
    { key: "inpOrTbt" as const, value: metrics.inpOrTbt, label: "INP/TBT" },
    { key: "fcp" as const, value: metrics.fcp, label: "FCP" },
    {
      key: "speedIndex" as const,
      value: metrics.speedIndex,
      label: "Speed Index",
    },
  ];

  const vitalsText = vitals
    .map((v) => {
      const t = THRESHOLDS[v.key];
      const sit = classifications[v.key];
      const formatted =
        v.value !== null
          ? v.key === "cls"
            ? v.value.toFixed(3)
            : `${Math.round(v.value)}${t.unit}`
          : "N/A";
      const m = margin(v.key, v.value);
      return `- ${v.label}: ${formatted}${m} → ${sit}`;
    })
    .join("\n");

  const classificationsText = vitals
    .map((v) => {
      const t = THRESHOLDS[v.key];
      const sit = classifications[v.key];
      const formatted =
        v.value !== null
          ? v.key === "cls"
            ? v.value.toFixed(3)
            : `${Math.round(v.value)}${t.unit}`
          : "N/A";
      return `- ${v.label}: ${sit} (${formatted})`;
    })
    .join("\n");

  const sortedOpps = [...metrics.opportunities].sort(
    (a, b) =>
      (b.savingsMs ?? 0) +
      (b.savingsBytes ?? 0) / 1000 -
      ((a.savingsMs ?? 0) + (a.savingsBytes ?? 0) / 1000),
  );

  const oppsText =
    sortedOpps.length > 0
      ? sortedOpps
          .map((o, i) => {
            const savings: string[] = [];
            if (o.savingsMs && o.savingsMs > 0)
              savings.push(`${o.savingsMs}ms`);
            if (o.savingsBytes && o.savingsBytes > 0)
              savings.push(`${Math.round(o.savingsBytes / 1024)}KB`);
            const savingsStr = savings.length
              ? ` — potential savings: ${savings.join(", ")}`
              : "";
            const riskNote =
              (o.savingsMs ?? 0) === 0 && (o.savingsBytes ?? 0) === 0
                ? `\n   Risk if unaddressed: ${
                    ZERO_SAVINGS_RISK_RATIONALE[o.id] ??
                    "flagged by Lighthouse as a best-practice violation that may affect performance on slower connections or repeat visits."
                  }`
                : "";
            const desc = o.description.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
            // Render top offending resources if available
            const itemsBlock =
              o.items && o.items.length > 0
                ? "\n   Top offenders:\n" +
                  o.items
                    .map((item) => {
                      const parts: string[] = [`     • ${item.url}`];
                      if (item.wastedBytes && item.wastedBytes > 0)
                        parts.push(
                          `${Math.round(item.wastedBytes / 1024)}KB wasted`,
                        );
                      else if (item.totalBytes && item.totalBytes > 0)
                        parts.push(
                          `${Math.round(item.totalBytes / 1024)}KB total`,
                        );
                      if (item.wastedMs && item.wastedMs > 0)
                        parts.push(`${Math.round(item.wastedMs)}ms`);
                      if (item.cacheLifetimeMs !== undefined)
                        parts.push(
                          `TTL: ${item.cacheLifetimeMs === 0 ? "no-cache" : `${Math.round(item.cacheLifetimeMs / 3600000)}h`}`,
                        );
                      return parts.join(" — ");
                    })
                    .join("\n")
                : "";
            return `${i + 1}. **${o.title}**${savingsStr}${riskNote}${itemsBlock}\n   Lighthouse says: "${desc}"`;
          })
          .join("\n\n")
      : "No opportunities flagged.";

  const situationsBlock =
    situations.length > 0
      ? `\nSYSTEM CONCLUSIONS (pre-verified by rule engine — treat as facts, do not contradict):\n` +
        situations
          .map((s) => `[${s.severity.toUpperCase()}] ${s.tag}: ${s.message}`)
          .join("\n")
      : "";

  // FALSE_GREEN directive block — injected only when FALSE_GREEN situation is detected
  const hasFalseGreen = situations.some((s) => s.tag === "FALSE_GREEN");
  const falseGreenDirective = hasFalseGreen
    ? (() => {
        const highImpactOpps = sortedOpps.filter(
          (o) => (o.savingsMs ?? 0) > 500 || (o.savingsBytes ?? 0) > 100_000,
        );
        const savingsStr = (o: Opportunity): string => {
          const parts: string[] = [];
          if (o.savingsMs && o.savingsMs > 0) parts.push(`${o.savingsMs}ms`);
          if (o.savingsBytes && o.savingsBytes > 0)
            parts.push(`${Math.round(o.savingsBytes / 1024)}KB`);
          return parts.length ? parts.join(", ") : "no quantified savings";
        };
        return `
FALSE_GREEN DIRECTIVE (applies because FALSE_GREEN situation was detected):
The score appears healthy but the following high-impact opportunities remain unfixed:
${highImpactOpps.map((o) => `- ${o.title}: ${savingsStr(o)}`).join("\n")}

MANDATORY INSTRUCTIONS for this run:
- The phrase "all metrics are within good thresholds" is FORBIDDEN. Replace it with a sentence naming the specific opportunities above and the risk they pose.
- In ## Good: qualify EVERY passing metric with its exact margin to threshold (e.g. "LCP 2054ms — 446ms from the 2500ms threshold"). Do not state a metric is simply "passing."
- In ## Needs Attention: LEAD with the FALSE_GREEN framing — the score is fragile and the listed opportunities are the specific threats to it.
- In ## Recommended Fixes: frame every fix as "protecting the current score" not "fixing a problem."
`;
      })()
    : "";

  return `You are a senior web performance engineer writing a precise, actionable internal report. You do not write generic advice. Every sentence must be grounded in the specific numbers below.

PAGE: ${url} (${pageType})

LIGHTHOUSE SCORES:
- Performance: ${scoreLabel(metrics.performanceScore)}
- Accessibility: ${scoreLabel(metrics.accessibilityScore)}
- SEO: ${scoreLabel(metrics.seoScore)}
- Best Practices: ${scoreLabel(metrics.bestPracticesScore)}

CORE WEB VITALS:
${vitalsText}

METRIC CLASSIFICATIONS:
${classificationsText}
${situationsBlock}${falseGreenDirective}
OPPORTUNITIES FLAGGED BY LIGHTHOUSE (in order of estimated impact):
${oppsText}

---

Write a report with EXACTLY these three sections. Do not add any other sections.

## Good
- State each passing metric with its exact value and exact margin to threshold.
- For scores ≥90: name the specific score and note what it means (e.g. "SEO 100 — all meta tags, canonical, and structured data present").
- Do not write generic praise. If a metric is AT_RISK, say so here.

## Needs Attention
- For each opportunity flagged by Lighthouse: explain what type of resource is likely causing it based on the Lighthouse description, and which specific vital it threatens.
- If an opportunity has no savings estimate, explain why it still matters (e.g. cache TTL affects repeat-visit performance, not first-load LCP).
- Connect each opportunity to a specific metric: "render-blocking-resources has no savings estimate but directly threatens LCP (currently 446ms from threshold) and FCP on slower connections."
- Do NOT skip opportunities just because all vitals are currently GOOD. Flag the risk.

## Recommended Fixes
- List in order of estimated impact (highest savings first).
- For each fix: state the opportunity name, the savings, and the SPECIFIC action — not "reduce unused JS" but "audit the 29KB of unused JS (190ms savings) — check for full lodash/moment imports or unshaken barrel files in your bundle."
- For opportunities with no savings estimate: explain the concrete risk if left unaddressed (e.g. "cache TTL — static assets served without long-lived Cache-Control headers means every repeat visitor re-downloads JS/CSS on each visit").
- If all vitals are GOOD: frame fixes as "protecting the current score" not "fixing a problem."

RECOMMENDED FIXES FORMAT (mandatory for every entry in ## Recommended Fixes):
  [Opportunity name] ([savings or "risk: <one-line risk>"]) — [specific action: name the file, import, or config to change]

FORBIDDEN phrases (will be rejected):
  - "reduce unused JavaScript" without naming a specific import or file
  - "optimize images" without naming a specific format, attribute, or pipeline step
  - "improve caching" without naming a specific header or asset type
  - "no quantified savings" — replace with the concrete risk from the ZERO-SAVINGS RISK block below

RULES:
${situations.length > 0 ? "- The SYSTEM CONCLUSIONS above are pre-verified facts. Do not contradict them.\n" : "- Metric classifications are pre-verified facts. Do not contradict them.\n"}- Use the METRIC CLASSIFICATIONS to determine severity language (CRITICAL → urgent, AT_RISK → proactive).
- Every bullet must cite a specific number from the data above.
- Maximum 5 bullets per section.
- Do not write "all metrics are within good thresholds" — that is not actionable.
- Do not repeat the same point across sections.
- Write for a senior engineer who will act on this immediately.
- Zero-savings opportunities MUST appear in ## Needs Attention and ## Recommended Fixes with their "Risk if unaddressed" rationale. The phrase "no quantified savings" is FORBIDDEN.`;
}

const VITAL_META: Record<
  "lcp" | "cls" | "inpOrTbt" | "fcp" | "speedIndex",
  { label: string; format: (v: number) => string }
> = {
  lcp: { label: "LCP", format: (v) => `${Math.round(v)}ms` },
  cls: { label: "CLS", format: (v) => v.toFixed(3) },
  inpOrTbt: { label: "INP/TBT", format: (v) => `${Math.round(v)}ms` },
  fcp: { label: "FCP", format: (v) => `${Math.round(v)}ms` },
  speedIndex: { label: "Speed Index", format: (v) => `${Math.round(v)}ms` },
};

const ALL_VITALS = [
  "lcp",
  "cls",
  "inpOrTbt",
  "fcp",
  "speedIndex",
] as const satisfies ReadonlyArray<keyof typeof VITAL_META>;

function buildTrendLines(
  vitals: ReadonlyArray<"lcp" | "cls" | "inpOrTbt" | "fcp" | "speedIndex">,
  metrics: ExtractedMetrics,
  previousMetrics: Partial<ExtractedMetrics>,
): string {
  const lines: string[] = [];

  for (const vital of vitals) {
    const current = metrics[vital];
    const previous = previousMetrics[vital];

    // Skip if either value is null/undefined
    if (current === null || current === undefined) continue;
    if (previous === null || previous === undefined) continue;

    const meta = VITAL_META[vital];

    let deltaRatio: number;
    if (previous === 0) {
      // Guard against divide-by-zero
      if (current === 0) continue; // no change
      deltaRatio = 1; // treat as 100% change
    } else {
      deltaRatio = Math.abs(current - previous) / previous;
    }

    // Only emit trend line if change exceeds 10%
    if (deltaRatio <= 0.1) continue;

    const deltaPercent = Math.round(deltaRatio * 100);
    const sign = current > previous ? "+" : "-";
    const isRegression = current > previous;
    const emoji = isRegression ? "⚠️ regression" : "✅ improvement";

    lines.push(
      `- ${meta.label} was ${meta.format(previous)} → now ${meta.format(current)} (${sign}${deltaPercent}% change) ${emoji}`,
    );
  }

  if (lines.length === 0) return "";
  return `\n**Trend (vs previous run):**\n${lines.join("\n")}`;
}

function buildAgentPrompt(
  url: string,
  pageType: string,
  opp: Opportunity,
  metrics: ExtractedMetrics,
  resolvedRule: ResolvedCausalRule | undefined,
  steps: string,
  rank: number,
  previousMetrics?: Partial<ExtractedMetrics>,
): string {
  const savings = [
    opp.savingsMs ? `~${opp.savingsMs}ms load time` : "",
    opp.savingsBytes
      ? `~${Math.round(opp.savingsBytes / 1024)}KB transfer size`
      : "",
  ]
    .filter(Boolean)
    .join(", ");

  // Determine which vitals to check for trend lines
  const vitalsToCheck =
    resolvedRule && resolvedRule.affectsVitals.length > 0
      ? resolvedRule.affectsVitals
      : ALL_VITALS;

  const trendBlock =
    previousMetrics !== undefined
      ? buildTrendLines(vitalsToCheck, metrics, previousMetrics)
      : "";

  let contextBlock = "";
  if (resolvedRule) {
    const vitalsStr =
      resolvedRule.affectsVitals.length > 0
        ? `**Metrics affected:** ${resolvedRule.affectsVitals.join(", ")}\n**Causal analysis:** ${resolvedRule.causalExplanation}`
        : `**Causal analysis:** ${resolvedRule.causalExplanation}`;
    contextBlock = `\n${vitalsStr}${trendBlock}`;
  } else if (trendBlock) {
    contextBlock = `\n${trendBlock.trimStart()}`;
  }

  return `# Performance Investigation — Priority ${rank}: ${opp.title}
${savings ? `**Estimated savings if fixed:** ${savings}` : ""}${contextBlock}

**Page audited:** ${url} (${pageType})
**Lighthouse finding:** ${opp.description}

## Your task

You are a performance investigator. Do NOT implement any fixes yet.

Your job is to:
1. Search this codebase to find the root cause of this issue
2. Identify exactly which files, components, or configuration are responsible
3. Explain what is causing the problem
4. Describe what a fix would look like — but do not write the code

## Investigation steps
${steps}

## What to report back

Structure your response as:
- **Root cause found:** [yes/no/partial]
- **Location:** [file paths and line numbers if found]
- **What's happening:** [specific explanation of why this is slow]
- **What would fix it:** [description of the change needed, no code]
- **Confidence:** [high/medium/low] — how certain are you this is the actual cause

Do not guess. If you cannot find the root cause, say so and explain what additional information would help.`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function generateSummary(
  input: AiSummaryInput,
  log: Logger,
): Promise<AiSummaryResult> {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  // ── Rule engine ───────────────────────────────────────────────────────────
  let classifications: ReturnType<typeof classifyAllMetrics>;
  let situations: DetectedSituation[] = [];
  let resolvedCausalRules: ResolvedCausalRule[] = [];

  try {
    classifications = classifyAllMetrics(input.metrics);
  } catch (err) {
    log.error(
      {
        stage: "rule-engine",
        err: err instanceof Error ? err.message : String(err),
      },
      "classifyAllMetrics failed, using defaults",
    );
    classifications = {
      lcp: "GOOD",
      cls: "GOOD",
      inpOrTbt: "GOOD",
      fcp: "GOOD",
      speedIndex: "GOOD",
    };
  }

  try {
    situations = detectSituations(
      input.metrics,
      input.pageType,
      input.metrics.opportunities,
    );
  } catch (err) {
    log.error(
      {
        stage: "rule-engine",
        err: err instanceof Error ? err.message : String(err),
      },
      "detectSituations failed, proceeding with empty situations",
    );
    situations = [];
  }

  try {
    resolvedCausalRules = resolveCausalRules(
      input.metrics,
      input.metrics.opportunities,
    );
  } catch (err) {
    log.error(
      {
        stage: "rule-engine",
        err: err instanceof Error ? err.message : String(err),
      },
      "resolveCausalRules failed, proceeding with empty rules",
    );
    resolvedCausalRules = [];
  }

  const ruleOutput: RuleEngineOutput = {
    classifications,
    situations,
    resolvedCausalRules,
  };

  // ── Summary prompt ────────────────────────────────────────────────────────
  const summaryPrompt = buildSummaryPrompt(input, ruleOutput);
  let summaryText = "";

  for (let attempt = 0; attempt <= 1; attempt++) {
    try {
      if (attempt > 0) {
        log.warn(
          { stage: "ai-summarizer", url: input.url, attempt },
          "Retrying Groq API call",
        );
        await sleep(RETRY_DELAY_MS);
      }

      const completion = await groq.chat.completions.create({
        model: GROQ_MODEL,
        temperature: 0,
        messages: [{ role: "user", content: summaryPrompt }],
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) throw new Error("Groq returned empty content");

      summaryText = content;
      break;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt === 0) {
        log.warn(
          { stage: "ai-summarizer", url: input.url, err: msg },
          "Groq call failed, retrying",
        );
      } else {
        log.error(
          { stage: "ai-summarizer", url: input.url, err: msg },
          "Groq call failed after retry",
        );
        return {
          success: false,
          fallback: `AI summary generation failed. Manual review required for: ${input.url}`,
        };
      }
    }
  }

  // ── Agent prompts ─────────────────────────────────────────────────────────
  const sortedOpps = [...input.metrics.opportunities].sort(
    (a, b) =>
      (b.savingsMs ?? 0) +
      (b.savingsBytes ?? 0) / 1000 -
      ((a.savingsMs ?? 0) + (a.savingsBytes ?? 0) / 1000),
  );

  const agentPrompts: AgentPrompt[] = sortedOpps.slice(0, 5).map((opp, i) => {
    const resolvedRule = resolvedCausalRules.find(
      (r) => r.opportunityId === opp.id,
    );
    const oppSituation =
      opp.id === "unused-javascript"
        ? classifications["inpOrTbt"]
        : opp.id === "render-blocking-resources"
          ? classifications["lcp"]
          : ("GOOD" as MetricSituation);
    const steps = getInvestigationSteps(opp.id, input.metrics, oppSituation);
    return {
      opportunityId: opp.id,
      opportunityTitle: opp.title,
      rank: i + 1,
      savingsMs: opp.savingsMs ?? null,
      savingsBytes: opp.savingsBytes ?? null,
      prompt: buildAgentPrompt(
        input.url,
        input.pageType,
        opp,
        input.metrics,
        resolvedRule,
        steps,
        i + 1,
        input.previousMetrics,
      ),
    };
  });

  log.info(
    {
      stage: "ai-summarizer",
      url: input.url,
      agentPromptCount: agentPrompts.length,
    },
    "AI summary and agent prompts generated",
  );

  return {
    success: true,
    output: { summary: summaryText, agentPrompts },
  };
}
