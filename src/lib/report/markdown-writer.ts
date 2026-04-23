import * as fs from 'fs';
import * as path from 'path';
import type { Logger } from 'pino';
import { WeeklyReport, UrlReport } from '@/types';

/**
 * Writes a WeeklyReport as a human-readable Markdown file.
 * Only invoked when MARKDOWN_OUTPUT_ENABLED=true.
 * File is named report-YYYY-MM-DD.md.
 */
export async function writeMarkdownReport(
  report: WeeklyReport,
  outputDir: string,
  log: Logger
): Promise<void> {
  const date = report.generatedAt.slice(0, 10); // YYYY-MM-DD
  const filename = `report-${date}.md`;
  const filePath = path.join(outputDir, filename);

  try {
    await fs.promises.mkdir(outputDir, { recursive: true });

    const content = buildMarkdown(report);
    await fs.promises.writeFile(filePath, content, 'utf-8');

    log.info({ stage: 'markdown-writer', filePath }, `Markdown report written: ${filename}`);
  } catch (err) {
    log.error({ stage: 'markdown-writer', filePath, err }, `Failed to write Markdown report to ${filePath}`);
    throw err;
  }
}

function buildMarkdown(report: WeeklyReport): string {
  const lines: string[] = [];

  lines.push(`# Weekly Lighthouse Report`);
  lines.push('');
  lines.push(`**Generated:** ${report.generatedAt}`);
  lines.push(`**Cycle started:** ${report.cycleStartedAt}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  if (report.projects.length === 0) {
    lines.push('_No projects were audited in this cycle._');
    return lines.join('\n');
  }

  for (const project of report.projects) {
    lines.push(`## ${project.projectTitle}`);
    lines.push('');
    lines.push(`**Owner:** ${project.owner}  `);
    lines.push(`**Environment:** ${project.environment}`);
    lines.push('');

    for (const urlReport of project.urls) {
      lines.push(`### ${urlReport.pageType} — ${urlReport.url}`);
      lines.push('');

      if (urlReport.status === 'failed') {
        lines.push('> ⚠️ **Audit failed** — metrics unavailable for this URL.');
        lines.push('');
        continue;
      }

      lines.push('#### Scores');
      lines.push('');
      lines.push(`| Category | Score |`);
      lines.push(`|---|---|`);
      lines.push(`| Performance | ${formatScore(urlReport.performanceScore)} |`);
      lines.push(`| Accessibility | ${formatScore(urlReport.accessibilityScore)} |`);
      lines.push(`| SEO | ${formatScore(urlReport.seoScore)} |`);
      lines.push(`| Best Practices | ${formatScore(urlReport.bestPracticesScore)} |`);
      lines.push('');

      lines.push('#### Core Web Vitals');
      lines.push('');
      lines.push(`| Metric | Value |`);
      lines.push(`|---|---|`);
      lines.push(`| LCP | ${formatMs(urlReport.coreWebVitals.lcp)} |`);
      lines.push(`| CLS | ${urlReport.coreWebVitals.cls !== null ? urlReport.coreWebVitals.cls : 'N/A'} |`);
      lines.push(`| INP/TBT | ${formatMs(urlReport.coreWebVitals.inpOrTbt)} |`);
      lines.push(`| FCP | ${formatMs(urlReport.coreWebVitals.fcp)} |`);
      lines.push(`| Speed Index | ${formatMs(urlReport.coreWebVitals.speedIndex)} |`);
      lines.push('');

      if (urlReport.opportunities.length > 0) {
        lines.push('#### Top Opportunities');
        lines.push('');
        for (const opp of urlReport.opportunities) {
          const savings = [
            opp.savingsMs !== undefined ? `~${opp.savingsMs}ms` : '',
            opp.savingsBytes !== undefined ? `~${Math.round(opp.savingsBytes / 1024)}KB` : '',
          ].filter(Boolean).join(', ');
          lines.push(`- **${opp.title}**${savings ? ` (${savings})` : ''}`);
        }
        lines.push('');
      }

      if (urlReport.aiSummary) {
        lines.push('#### AI Engineering Summary');
        lines.push('');
        lines.push(urlReport.aiSummary);
        lines.push('');
      }

      lines.push('---');
      lines.push('');
    }
  }

  return lines.join('\n');
}

function formatScore(score: number | null): string {
  return score !== null ? `${score}/100` : 'N/A';
}

function formatMs(value: number | null): string {
  return value !== null ? `${value}ms` : 'N/A';
}
