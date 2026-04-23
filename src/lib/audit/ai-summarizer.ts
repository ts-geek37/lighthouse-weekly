import Groq from 'groq-sdk';
import type { Logger } from 'pino';
import { ExtractedMetrics, AgentPrompt, AiSummaryOutput } from '@/types';

export interface AiSummaryInput {
  url: string;
  pageType: string;
  metrics: ExtractedMetrics;
}

export type AiSummaryResult =
  | { success: true; output: AiSummaryOutput }
  | { success: false; fallback: string };

const GROQ_MODEL = 'llama-3.3-70b-versatile';
const RETRY_DELAY_MS = 5_000;

// ── Thresholds ────────────────────────────────────────────────────────────────

const THRESHOLDS = {
  lcp:        { good: 2500,  poor: 4000,  unit: 'ms', label: 'Largest Contentful Paint' },
  cls:        { good: 0.1,   poor: 0.25,  unit: '',   label: 'Cumulative Layout Shift' },
  inpOrTbt:   { good: 200,   poor: 500,   unit: 'ms', label: 'INP / Total Blocking Time' },
  fcp:        { good: 1800,  poor: 3000,  unit: 'ms', label: 'First Contentful Paint' },
  speedIndex: { good: 3400,  poor: 5800,  unit: 'ms', label: 'Speed Index' },
};

function severity(key: keyof typeof THRESHOLDS, value: number | null): string {
  if (value === null) return 'unknown';
  const t = THRESHOLDS[key];
  if (value <= t.good) return 'GOOD';
  if (value <= t.poor) return 'NEEDS IMPROVEMENT';
  return 'POOR';
}

function scoreLabel(score: number | null): string {
  if (score === null) return 'N/A';
  if (score >= 90) return `${score}/100 (Good)`;
  if (score >= 50) return `${score}/100 (Needs Improvement)`;
  return `${score}/100 (Poor)`;
}

// ── Investigation instructions per opportunity type ───────────────────────────

const INVESTIGATION_STEPS: Record<string, string> = {
  'render-blocking-resources': `
1. Search for all <script> tags in HTML templates, layout files, and <head> sections
2. Identify scripts without defer or async attributes
3. Find CSS <link> tags that block rendering (no media query, no preload)
4. Distinguish first-party scripts (your code) from third-party (analytics, ads, chat widgets)
5. Check if any blocking scripts are only needed after user interaction
6. Look for any CSS @import statements inside stylesheets (these are always blocking)
Report: list each blocking resource with its file location and estimated removal impact`,

  'unused-javascript': `
1. Check your bundler config (webpack.config.js, vite.config.ts, next.config.ts) for tree-shaking settings
2. Search for full library imports: import _ from 'lodash', import moment from 'moment', import * as icons from '...'
3. Find barrel files (index.ts) that re-export everything — these defeat tree-shaking
4. Look for polyfills that may target browsers you no longer support
5. Check for dynamic imports that could be lazy-loaded but aren't
6. Search for large dependencies in package.json and check if lighter alternatives exist
Report: list each source of unused JS with file location, estimated bundle size, and root cause`,

  'uses-optimized-images': `
1. Find all <img> tags, next/image components, CSS background-image declarations
2. Check what image formats are being served — look at the actual file extensions in /public or CDN config
3. Identify images missing explicit width and height attributes (causes layout shift)
4. Find images above the fold that lack fetchpriority="high" or <link rel="preload">
5. Check if your image pipeline (sharp, imagemin, CDN transforms) is configured and actually running
6. Look for images served at a larger resolution than their display size
Report: list each problematic image with its location, current format/size, and what's missing`,

  'uses-long-cache-ttl': `
1. Find your server headers configuration (next.config.ts headers(), nginx.conf, vercel.json, _headers file)
2. Check Cache-Control headers currently set on static assets (JS, CSS, images, fonts)
3. Verify whether static assets have content-hash in their filenames (required for long TTL)
4. Look for any middleware that strips or overrides cache headers
5. Check CDN configuration if applicable
Report: list each asset type with its current TTL, whether it has content-hash, and what TTL is safe`,

  'unused-css-rules': `
1. Check if PurgeCSS, UnCSS, or Tailwind's content purging is configured
2. Look for global CSS files imported in _app.tsx, layout.tsx, or index.html
3. Find CSS frameworks (Bootstrap, Bulma) loaded in full — check if only a subset is used
4. Search for CSS-in-JS libraries and check if they have dead code elimination
5. Look for component-level CSS files that import shared utilities they don't use
Report: list each source of unused CSS with file location, estimated size, and why it's unused`,
};

function getInvestigationSteps(opportunityId: string): string {
  return INVESTIGATION_STEPS[opportunityId] ?? `
1. Search the codebase for code patterns related to "${opportunityId}"
2. Identify which files or components are responsible
3. Check configuration files that might control this behavior
4. Look for any existing optimizations that may be misconfigured
Report: describe what you found, where it is, and what change would address it`;
}

// ── Prompt builders ───────────────────────────────────────────────────────────

function buildSummaryPrompt(input: AiSummaryInput): string {
  const { url, pageType, metrics } = input;

  const vitals = [
    { key: 'lcp' as const,      value: metrics.lcp,        label: 'LCP',        unit: 'ms' },
    { key: 'cls' as const,      value: metrics.cls,        label: 'CLS',        unit: '' },
    { key: 'inpOrTbt' as const, value: metrics.inpOrTbt,   label: 'INP/TBT',    unit: 'ms' },
    { key: 'fcp' as const,      value: metrics.fcp,        label: 'FCP',        unit: 'ms' },
    { key: 'speedIndex' as const, value: metrics.speedIndex, label: 'Speed Index', unit: 'ms' },
  ];

  const vitalsText = vitals.map(v => {
    const t = THRESHOLDS[v.key];
    const sev = severity(v.key, v.value);
    const val = v.value !== null ? `${v.value}${v.unit}` : 'N/A';
    const threshold = `(good ≤${t.good}${t.unit}, poor >${t.poor}${t.unit})`;
    return `- ${v.label}: ${val} → ${sev} ${threshold}`;
  }).join('\n');

  const oppsText = metrics.opportunities.length > 0
    ? metrics.opportunities
        .sort((a, b) => ((b.savingsMs ?? 0) + (b.savingsBytes ?? 0) / 1000) - ((a.savingsMs ?? 0) + (a.savingsBytes ?? 0) / 1000))
        .map(o => {
          const savings = [
            o.savingsMs ? `${o.savingsMs}ms` : '',
            o.savingsBytes ? `${Math.round(o.savingsBytes / 1024)}KB` : '',
          ].filter(Boolean).join(', ');
          return `- ${o.title}${savings ? ` [potential savings: ${savings}]` : ''}`;
        }).join('\n')
    : '- No significant opportunities identified';

  return `You are a senior web performance engineer writing an internal engineering report.

Page: ${url}
Page type: ${pageType}

SCORES:
- Performance: ${scoreLabel(metrics.performanceScore)}
- Accessibility: ${scoreLabel(metrics.accessibilityScore)}
- SEO: ${scoreLabel(metrics.seoScore)}
- Best Practices: ${scoreLabel(metrics.bestPracticesScore)}

CORE WEB VITALS (with thresholds):
${vitalsText}

TOP OPPORTUNITIES (sorted by estimated savings):
${oppsText}

Write a concise engineering summary with EXACTLY these three sections:

## Good
List what is genuinely performing well. Reference specific metric values and scores.
Only include items that are actually good — do not pad this section.

## Needs Attention
For each underperforming metric: state the exact value, how far it is from the good threshold,
and which opportunity is most likely causing it. Connect metrics to opportunities explicitly.
Example: "LCP is 4.2s — 1.7s above the 2.5s good threshold. The render-blocking-resources
opportunity (890ms savings) is likely the primary contributor."

## Recommended Fixes
List fixes in order of estimated impact (highest savings first).
Each fix must reference the specific opportunity name and its savings estimate.
Be specific about what type of change is needed — not "optimize images" but
"serve images in WebP/AVIF format and add explicit width/height to prevent layout shift".

Rules:
- Every bullet must reference a specific number from the data above
- Do not include advice not supported by the audit data
- If a metric is GOOD, do not suggest fixing it
- Maximum 5 bullets per section
- Write for a senior engineer, not a beginner`;
}

function buildAgentPrompt(
  url: string,
  pageType: string,
  opp: { id: string; title: string; description: string; savingsMs?: number; savingsBytes?: number },
  metrics: ExtractedMetrics,
  rank: number
): string {
  const savings = [
    opp.savingsMs ? `~${opp.savingsMs}ms load time` : '',
    opp.savingsBytes ? `~${Math.round(opp.savingsBytes / 1024)}KB transfer size` : '',
  ].filter(Boolean).join(', ');

  // Find which metrics this opportunity most likely affects
  const affectedMetrics: string[] = [];
  if (['render-blocking-resources', 'unused-javascript', 'uses-optimized-images'].includes(opp.id)) {
    if (metrics.lcp !== null && metrics.lcp > THRESHOLDS.lcp.good) {
      affectedMetrics.push(`LCP (currently ${metrics.lcp}ms, good threshold: ${THRESHOLDS.lcp.good}ms)`);
    }
    if (metrics.fcp !== null && metrics.fcp > THRESHOLDS.fcp.good) {
      affectedMetrics.push(`FCP (currently ${metrics.fcp}ms, good threshold: ${THRESHOLDS.fcp.good}ms)`);
    }
  }
  if (['render-blocking-resources', 'unused-javascript'].includes(opp.id)) {
    if (metrics.inpOrTbt !== null && metrics.inpOrTbt > THRESHOLDS.inpOrTbt.good) {
      affectedMetrics.push(`INP/TBT (currently ${metrics.inpOrTbt}ms, good threshold: ${THRESHOLDS.inpOrTbt.good}ms)`);
    }
  }
  if (opp.id === 'uses-optimized-images') {
    if (metrics.cls !== null && metrics.cls > THRESHOLDS.cls.good) {
      affectedMetrics.push(`CLS (currently ${metrics.cls}, good threshold: ${THRESHOLDS.cls.good})`);
    }
  }

  const affectedText = affectedMetrics.length > 0
    ? `\n**Metrics likely affected:** ${affectedMetrics.join(', ')}`
    : '';

  const steps = getInvestigationSteps(opp.id);

  return `# Performance Investigation — Priority ${rank}: ${opp.title}
${savings ? `**Estimated savings if fixed:** ${savings}` : ''}${affectedText}

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

// ── Main export ───────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function generateSummary(
  input: AiSummaryInput,
  log: Logger
): Promise<AiSummaryResult> {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const summaryPrompt = buildSummaryPrompt(input);

  // ── Generate human-readable summary ────────────────────────────────────────
  let summaryText = '';

  for (let attempt = 0; attempt <= 1; attempt++) {
    try {
      if (attempt > 0) {
        log.warn({ stage: 'ai-summarizer', url: input.url, attempt }, 'Retrying Groq API call');
        await sleep(RETRY_DELAY_MS);
      }

      const completion = await groq.chat.completions.create({
        model: GROQ_MODEL,
        temperature: 0,
        messages: [
          { role: 'user', content: summaryPrompt },
        ],
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) throw new Error('Groq returned empty content');

      summaryText = content;
      break;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt === 0) {
        log.warn({ stage: 'ai-summarizer', url: input.url, err: msg }, 'Groq call failed, retrying');
      } else {
        log.error({ stage: 'ai-summarizer', url: input.url, err: msg }, 'Groq call failed after retry');
        return {
          success: false,
          fallback: `AI summary generation failed. Manual review required for: ${input.url}`,
        };
      }
    }
  }

  // ── Generate agent investigation prompts ───────────────────────────────────
  // Sort opportunities by estimated savings (highest first)
  const sortedOpps = [...input.metrics.opportunities].sort(
    (a, b) =>
      ((b.savingsMs ?? 0) + (b.savingsBytes ?? 0) / 1000) -
      ((a.savingsMs ?? 0) + (a.savingsBytes ?? 0) / 1000)
  );

  // Generate one investigation prompt per opportunity (max 5)
  const agentPrompts: AgentPrompt[] = sortedOpps.slice(0, 5).map((opp, i) => ({
    opportunityId: opp.id,
    opportunityTitle: opp.title,
    savingsMs: opp.savingsMs ?? null,
    savingsBytes: opp.savingsBytes ?? null,
    prompt: buildAgentPrompt(input.url, input.pageType, opp, input.metrics, i + 1),
  }));

  log.info(
    { stage: 'ai-summarizer', url: input.url, agentPromptCount: agentPrompts.length },
    'AI summary and agent prompts generated'
  );

  return {
    success: true,
    output: {
      summary: summaryText,
      agentPrompts,
    },
  };
}
