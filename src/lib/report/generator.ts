import type { Logger } from 'pino';
import { prisma } from '@/lib/prisma';
import { WeeklyReport, ProjectReport, UrlReport, Opportunity, Environment, AuditStatus } from '@/types';

/**
 * Assembles a WeeklyReport from AuditRun records created during the current pipeline cycle.
 * Groups results by project, includes failed runs with null metrics.
 * Filters to only records with createdAt >= cycleStartedAt.
 */
export async function generateReport(
  auditRunIds: string[],
  cycleStartedAt: Date,
  log: Logger
): Promise<WeeklyReport> {
  log.info({ stage: 'report-generator', auditRunCount: auditRunIds.length }, 'Assembling weekly report');

  const auditRuns = await prisma.auditRun.findMany({
    where: {
      id: { in: auditRunIds },
      createdAt: { gte: cycleStartedAt },
    },
    include: {
      project: true,
      projectUrl: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  // Group by project
  const projectMap = new Map<string, {
    project: typeof auditRuns[0]['project'];
    urlReports: UrlReport[];
  }>();

  for (const run of auditRuns) {
    const projectId = run.projectId;

    if (!projectMap.has(projectId)) {
      projectMap.set(projectId, {
        project: run.project,
        urlReports: [],
      });
    }

    const opportunities: Opportunity[] = Array.isArray(run.opportunitiesJson)
      ? (run.opportunitiesJson as unknown as Opportunity[])
      : [];

    const urlReport: UrlReport = {
      url: run.projectUrl.url,
      pageType: run.projectUrl.pageType,
      status: run.status as AuditStatus,
      performanceScore: run.performanceScore,
      accessibilityScore: run.accessibilityScore,
      seoScore: run.seoScore,
      bestPracticesScore: run.bestPracticesScore,
      coreWebVitals: {
        lcp: run.lcp,
        cls: run.cls,
        inpOrTbt: run.inpOrTbt,
        fcp: run.fcp,
        speedIndex: run.speedIndex,
      },
      opportunities,
      aiSummary: run.aiSummary,
    };

    projectMap.get(projectId)!.urlReports.push(urlReport);
  }

  const projects: ProjectReport[] = Array.from(projectMap.values()).map(({ project, urlReports }) => ({
    projectId: project.id,
    projectTitle: project.title,
    owner: project.owner,
    environment: project.environment as Environment,
    urls: urlReports,
  }));

  const report: WeeklyReport = {
    generatedAt: new Date().toISOString(),
    cycleStartedAt: cycleStartedAt.toISOString(),
    projects,
  };

  log.info(
    { stage: 'report-generator', projectCount: projects.length, urlCount: auditRuns.length },
    'Weekly report assembled'
  );

  return report;
}
