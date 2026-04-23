import Groq from 'groq-sdk';
import type { Logger } from 'pino';
import { ExtractedMetrics } from '@/types';

export interface AiSummaryInput {
  url: string;
  metrics: ExtractedMetrics;
}

export type AiSummaryResult =
  | { success: true; summary: string }
  | { success: false; fallback: string };

const GROQ_MODEL = 'llama-3.3-70b-versatile';
const RETRY_DELAY_MS = 5_000;

const SYSTEM_PROMPT = `You are a senior web performance engineer. You produce concise, actionable engineering summaries from Lighthouse audit data.
Your output must contain exactly three sections with these exact headings:
## Good
## Needs Attention
## Recommended Fixes

Rules:
- Every bullet point must reference a specific metric value or opportunity name from the provided data.
- Do not include generic advice not supported by the data.
- Recommended Fixes must be ordered by estimated impact (highest first).
- Be concise: 3–5 bullets per section maximum.`;

function buildUserPrompt(input: AiSummaryInput): string {
  const { url, metrics } = input;

  const opportunitiesText =
    metrics.opportunities.length > 0
      ? metrics.opportunities
          .map((o) => {
            const savings = [
              o.savingsMs !== undefined ? `~${o.savingsMs}ms savings` : '',
              o.savingsBytes !== undefined ? `~${Math.round(o.savingsBytes / 1024)}KB savings` : '',
            ]
              .filter(Boolean)
              .join(', ');
            return `- ${o.title}${savings ? ` (${savings})` : ''}`;
          })
          .join('\n')
      : '- No significant opportunities identified';

  return `Lighthouse audit results for: ${url}

Performance: ${metrics.performanceScore ?? 'N/A'}/100
Accessibility: ${metrics.accessibilityScore ?? 'N/A'}/100
SEO: ${metrics.seoScore ?? 'N/A'}/100
Best Practices: ${metrics.bestPracticesScore ?? 'N/A'}/100

Core Web Vitals:
- LCP: ${metrics.lcp !== null ? `${metrics.lcp}ms` : 'N/A'}
- CLS: ${metrics.cls !== null ? metrics.cls : 'N/A'}
- INP/TBT: ${metrics.inpOrTbt !== null ? `${metrics.inpOrTbt}ms` : 'N/A'}
- FCP: ${metrics.fcp !== null ? `${metrics.fcp}ms` : 'N/A'}
- Speed Index: ${metrics.speedIndex !== null ? `${metrics.speedIndex}ms` : 'N/A'}

Top Opportunities:
${opportunitiesText}

Generate the engineering summary now.`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generates a structured AI engineering summary for a Lighthouse audit result.
 * Uses the Groq API with temperature=0 for deterministic output.
 * Retries once on failure after a 5-second delay.
 */
export async function generateSummary(
  input: AiSummaryInput,
  log: Logger
): Promise<AiSummaryResult> {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const userPrompt = buildUserPrompt(input);

  for (let attempt = 0; attempt <= 1; attempt++) {
    try {
      if (attempt > 0) {
        log.warn(
          { stage: 'ai-summarizer', url: input.url, attempt },
          'Retrying Groq API call after failure'
        );
        await sleep(RETRY_DELAY_MS);
      }

      const completion = await groq.chat.completions.create({
        model: GROQ_MODEL,
        temperature: 0,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
      });

      const summary = completion.choices[0]?.message?.content;

      if (!summary) {
        throw new Error('Groq API returned empty content');
      }

      log.info(
        { stage: 'ai-summarizer', url: input.url },
        'AI summary generated successfully'
      );

      return { success: true, summary };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      if (attempt === 0) {
        log.warn(
          { stage: 'ai-summarizer', url: input.url, err: errorMessage },
          'Groq API call failed, will retry once'
        );
      } else {
        log.error(
          { stage: 'ai-summarizer', url: input.url, err: errorMessage },
          'Groq API call failed after retry — using fallback'
        );
      }
    }
  }

  return {
    success: false,
    fallback: `AI summary generation failed. Manual review required for: ${input.url}`,
  };
}
