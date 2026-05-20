/**
 * Weekly Lighthouse Audit Pipeline — Entry Point
 *
 * Invoked via:
 *   npm run audit          (local)
 *   npm run audit          (GitHub Actions — same command)
 */

// Load .env file before any other imports that need environment variables
import 'dotenv/config';

import { loadConfig } from '../src/lib/config';
import { logger, childLogger } from '../src/lib/logger';
import { prisma } from '../src/lib/prisma';
import { runAudit } from '../src/lib/audit/runner';
import { extractMetrics } from '../src/lib/audit/metrics-extractor';
import { generateSummary } from '../src/lib/audit/ai-summarizer';
import { generateReport } from '../src/lib/report/generator';
import { writeJsonReport } from '../src/lib/report/json-writer';
import { writeMarkdownReport } from '../src/lib/report/markdown-writer';
import { sendReportEmail } from '../src/lib/mail';
import { WeeklyIntelligenceService } from '../src/lib/comparison/intelligenceService';
import { PipelineContext } from '../src/types';

async function main(): Promise<void> {
  // ── 1. Validate configuration ─────────────────────────────────────────────
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    logger.fatal({ err }, 'Configuration validation failed — aborting');
    process.exit(1);
  }

  const log = childLogger({ stage: 'orchestrator' });
  log.info('Starting weekly Lighthouse audit pipeline');

  // ── 2. Initialize pipeline context ────────────────────────────────────────
  const context: PipelineContext = {
    cycleStartedAt: new Date(),
    auditRunIds: [],
    failedUrls: [],
  };

  // ── 3. Load active projects ───────────────────────────────────────────────
  let activeProjects;
  try {
    activeProjects = await prisma.project.findMany({
      where: { isActive: true },
      include: { urls: { orderBy: { priority: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });
  } catch (err) {
    log.fatal({ err }, 'Failed to load active projects from database — aborting');
    process.exit(1);
  }

  log.info({ projectCount: activeProjects.length }, `Found ${activeProjects.length} active project(s)`);

  if (activeProjects.length === 0) {
    log.info('No active projects to audit — exiting');
    process.exit(0);
  }

  // ── 4. Run audits for each project URL ────────────────────────────────────
  for (const project of activeProjects) {
    const projectLog = childLogger({ stage: 'orchestrator', projectId: project.id });
    projectLog.info({ urlCount: project.urls.length }, `Auditing project: ${project.title}`);

    for (const projectUrl of project.urls) {
      const urlLog = childLogger({ stage: 'orchestrator', projectId: project.id, url: projectUrl.url });

      for (const device of ['mobile', 'desktop'] as const) {
        try {
          urlLog.info({ device }, `Starting ${device} audit`);

          // ── Lighthouse audit ────────────────────────────────────────────────
          const auditResult = await runAudit({ url: projectUrl.url, device }, urlLog);

          if (!auditResult.success) {
            // Record failed audit run
            const failedRun = await prisma.auditRun.create({
              data: {
                projectId: project.id,
                projectUrlId: projectUrl.id,
                status: 'failed',
                device,
              },
            });
            context.auditRunIds.push(failedRun.id);
            context.failedUrls.push({
              projectId: project.id,
              url: projectUrl.url,
              error: `${device} audit failed: ${auditResult.error}`,
            });
            urlLog.error(
              { stage: 'orchestrator', projectId: project.id, url: projectUrl.url, device, err: auditResult.error },
              'Audit failed — recorded as failed run'
            );
            continue;
          }

          // ── Metrics extraction ──────────────────────────────────────────────
          const metrics = extractMetrics(auditResult.lhr, urlLog);

          // ── Persist audit run ───────────────────────────────────────────────
          const auditRun = await prisma.auditRun.create({
            data: {
              projectId: project.id,
              projectUrlId: projectUrl.id,
              status: 'success',
              device,
              performanceScore: metrics.performanceScore,
              accessibilityScore: metrics.accessibilityScore,
              seoScore: metrics.seoScore,
              bestPracticesScore: metrics.bestPracticesScore,
              lcp: metrics.lcp,
              cls: metrics.cls,
              inpOrTbt: metrics.inpOrTbt,
              fcp: metrics.fcp,
              speedIndex: metrics.speedIndex,
              ttfb: metrics.ttfb,
              opportunitiesJson: metrics.opportunities as any,
              rawJson: auditResult.lhr as any,
              htmlReport: auditResult.htmlReport,
            },
          });

          // ── AI summary ──────────────────────────────────────────────────────
          const summaryResult = await generateSummary(
            { url: projectUrl.url, pageType: projectUrl.pageType, metrics },
            urlLog
          );

          const aiSummary = summaryResult.success
            ? summaryResult.output.summary
            : summaryResult.fallback;

          const agentPromptsJson = summaryResult.success
            ? summaryResult.output.agentPrompts
            : null;

          await prisma.auditRun.update({
            where: { id: auditRun.id },
            data: {
              aiSummary,
              agentPromptsJson: agentPromptsJson as any,
            } as any,
          });

          context.auditRunIds.push(auditRun.id);
          urlLog.info({ auditRunId: auditRun.id, device }, 'Audit completed successfully');
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          urlLog.error(
            { stage: 'orchestrator', projectId: project.id, url: projectUrl.url, device, err: errorMessage },
            'Unexpected error processing URL'
          );
          context.failedUrls.push({
            projectId: project.id,
            url: projectUrl.url,
            error: `${device} audit error: ${errorMessage}`,
          });
        }
      }
    }
  }

  // ── 5. Generate and save report ───────────────────────────────────────────
  log.info(
    {
      totalAudited: context.auditRunIds.length,
      totalFailed: context.failedUrls.length,
    },
    'All audits complete — generating report'
  );

  try {
    const report = await generateReport(context.auditRunIds, context.cycleStartedAt, log);
    await writeJsonReport(report, config.reportOutputDir, log);

    if (config.markdownOutputEnabled) {
      await writeMarkdownReport(report, config.reportOutputDir, log);
    }

    // Send individual project reports via email if configured
    for (const projectReport of report.projects) {
      if (projectReport.reportEmail) {
        log.info({ projectId: projectReport.projectId }, 'Generating performance intelligence for email report');
        let mobileComp = null;
        let desktopComp = null;
        try {
          // 1. Generate/Fetch both mobile and desktop comparison reports
          mobileComp = await WeeklyIntelligenceService.getComparisonReport(projectReport.projectId, 'mobile');
          desktopComp = await WeeklyIntelligenceService.getComparisonReport(projectReport.projectId, 'desktop');

          // 2. Pre-generate and cache the AI regression insights for each URL that has enough history
          for (const compReport of [mobileComp, desktopComp]) {
            for (const urlReport of compReport.urls) {
              if (urlReport.hasEnoughData) {
                const latestRun = urlReport.historicalRuns[urlReport.historicalRuns.length - 1];
                const previousRun = urlReport.historicalRuns[urlReport.historicalRuns.length - 2];
                if (latestRun && previousRun) {
                  log.info(
                    { projectUrlId: urlReport.projectUrlId, device: compReport === mobileComp ? 'mobile' : 'desktop' },
                    'Pre-generating and caching AI performance insights'
                  );
                  // getOrGenerateAiInsight automatically computes and caches it in DB
                  const aiInsight = await WeeklyIntelligenceService.getOrGenerateAiInsight(
                    urlReport.projectUrlId,
                    latestRun.id,
                    previousRun.id
                  );
                  urlReport.aiInsight = aiInsight;
                }
              }
            }
          }
        } catch (err) {
          log.error(
            { err, projectId: projectReport.projectId },
            'Failed to precompute weekly performance intelligence for email'
          );
        }

        await sendReportEmail(
          projectReport.reportEmail,
          projectReport,
          log,
          mobileComp || undefined,
          desktopComp || undefined
        );
      }
    }
  } catch (err) {
    log.error({ err }, 'Failed to write report');
    process.exit(1);
  }

  log.info(
    {
      totalAudited: context.auditRunIds.length,
      totalFailed: context.failedUrls.length,
      reportDir: config.reportOutputDir,
    },
    'Weekly Lighthouse audit pipeline completed'
  );

  await prisma.$disconnect();
}

// Top-level error handler
main().catch((err) => {
  logger.fatal({ err }, 'Unhandled exception in audit pipeline');
  process.exit(1);
});
