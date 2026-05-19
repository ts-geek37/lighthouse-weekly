import {
  MetricChange,
  RegressionItem,
  ImprovementItem,
  DeterministicRecommendation,
} from "./comparisonTypes";
import { Opportunity } from "@/types";

export function buildComparisonPrompt(
  url: string,
  pageType: string,
  metrics: Record<string, MetricChange>,
  regressions: RegressionItem[],
  improvements: ImprovementItem[],
  newOpps: Opportunity[],
  resolvedOpps: Opportunity[],
  recommendations: DeterministicRecommendation[]
): { system: string; user: string } {
  const metricsBlock = Object.values(metrics)
    .map((m) => {
      const prevStr = m.previous !== null ? `${m.previous}${m.unit}` : "N/A";
      const currStr = m.current !== null ? `${m.current}${m.unit}` : "N/A";
      const deltaStr = m.delta !== null ? (m.delta > 0 ? `+${m.delta}` : `${m.delta}`) : "0";
      const pctStr = m.percentage !== null ? `(${m.percentage > 0 ? `+${m.percentage}` : `${m.percentage}`}% change)` : "";
      return `- ${m.label}: ${prevStr} → ${currStr} [Delta: ${deltaStr} ${pctStr}] (${m.status.toUpperCase()})`;
    })
    .join("\n");

  const regressionsBlock =
    regressions.length > 0
      ? regressions
          .map((r) => `- [${r.severity.toUpperCase()} SEVERITY | Confidence: ${r.confidence.toUpperCase()}] ${r.message}`)
          .join("\n")
      : "No metric regressions detected.";

  const improvementsBlock =
    improvements.length > 0
      ? improvements.map((i) => `- ${i.message}`).join("\n")
      : "No metric improvements detected.";

  const newOppsBlock =
    newOpps.length > 0
      ? newOpps
          .map((o) => {
            const savings: string[] = [];
            if (o.savingsMs) savings.push(`${o.savingsMs}ms`);
            if (o.savingsBytes) savings.push(`${Math.round(o.savingsBytes / 1024)}KB`);
            const savingsStr = savings.length ? ` (Potential Savings: ${savings.join(", ")})` : "";
            return `- **${o.title}**${savingsStr}: ${o.description}`;
          })
          .join("\n")
      : "No new opportunities flagged.";

  const resolvedOppsBlock =
    resolvedOpps.length > 0
      ? resolvedOpps.map((o) => `- **${o.title}**`).join("\n")
      : "No opportunities resolved.";

  const recsBlock =
    recommendations.length > 0
      ? recommendations
          .map((r, idx) => {
            return `${idx + 1}. [Priority: ${r.priority.toUpperCase()}] Issue: ${r.issue}\n   Suggested Fixes:\n${r.suggestedFixes
              .map((sf) => `     - ${sf}`)
              .join("\n")}`;
          })
          .join("\n\n")
      : "No deterministic recommendations.";

  const system = `You are a senior staff web performance engineer and root-cause analysis (RCA) specialist.
Your analysis must be grounded entirely in the provided performance metrics comparison, regressions, improvements, opportunities, and pre-processed recommendations. You must not hallucinate or change metrics.

You are presenting this intelligence report directly to other senior software engineers.
The AI must only provide insights that are NOT immediately obvious from the visible report data.
Do NOT simply restate or narrate the numbers, scores, deltas, or opportunities that the user can already see on the page.
Instead, focus on engineering interpretation, causal reasoning, cross-metric relationships, likely technical causes, and user-impact analysis.

CRITICAL PROMPT RULES:
1. Avoid generic Lighthouse explanations, metric narration, or filler observations.
2. Ignore tiny, statistically insignificant, or stable metric deltas. Only discuss high-impact shifts.
3. Every engineering insight must link symptoms to causes with reasoning (e.g., explaining how unused JS bloating by X KB correlates with main-thread blocking time, or how CSS render-blocking delays FCP and LCP).
4. Use explicit confidence scoring (HIGH, MEDIUM, or LOW confidence) with a clear, evidence-based rationale in the dedicated Confidence Assessment section.

Provide your response in EXACTLY these sections with these exact Markdown headers:

## Primary Regression Drivers
- Identify the primary drivers behind any significant performance degradations. Do not just list the metrics; explain why they degraded and how they link to specific assets. If there are no regressions, state "No significant performance regressions detected."

## Major Improvements
- Detail performance recoveries or optimization wins. Avoid listing minor fluctuations. If there are no major improvements, state "No significant performance improvements detected."

## Cross-Metric Analysis
- Analyze how multiple metrics correlate or affect each other (e.g., LCP degradation coinciding with a bundle size increase affecting TBT).

## Likely Technical Causes
- Formulate concrete, codebase-specific hypotheses on the likely technical systems or layers responsible (e.g., client-side hydration bottlenecks, synchronous packages, render-blocking third-party scripts, or unoptimized CDN formatting).

## User Experience Impact
- Analyze the user-perceived impact of these performance changes (e.g., responsiveness lag during user interaction, visual jumping, or bounce risks on slow networks).

## Highest Priority Engineering Actions
- Suggest 2-3 precise, actionable steps. Recommend specific codebase search patterns, bundle auditing tools, or file targets based on the offending assets.

## Confidence Assessment
- State the overall confidence of this analysis: HIGH, MEDIUM, or LOW confidence, followed by a brief, evidence-backed rationale (e.g. "HIGH confidence — metric regressions directly correlate with the size and location of the newly introduced render-blocking assets").`;

  const user = `URL Monitored: ${url}
Page Type: ${pageType}

METRICS COMPARISON:
${metricsBlock}

DETECTED REGRESSIONS:
${regressionsBlock}

DETECTED IMPROVEMENTS:
${improvementsBlock}

NEW OPPORTUNITIES IN CURRENT AUDIT (NOT IN PREVIOUS):
${newOppsBlock}

RESOLVED OPPORTUNITIES (SOLVED SINCE PREVIOUS AUDIT):
${resolvedOppsBlock}

DETERMINISTIC RECOMMENDATIONS (Pre-processed):
${recsBlock}`;

  return { system, user };
}
