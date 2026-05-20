import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Opportunity, AgentPrompt } from '@/types';
import { extractAdvancedDiagnostics } from '@/lib/audit/metrics-extractor';
import { childLogger } from '@/lib/logger';

export const GET = async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  try {
    const run = await prisma.auditRun.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, title: true, owner: true, environment: true } },
        projectUrl: { select: { id: true, url: true, pageType: true, priority: true } },
      },
    });

    if (!run) {
      return NextResponse.json({ error: 'Audit run not found' }, { status: 404 });
    }

    const opportunities: Opportunity[] = Array.isArray(run.opportunitiesJson)
      ? (run.opportunitiesJson as unknown as Opportunity[])
      : [];

    const agentPrompts: AgentPrompt[] = Array.isArray(run.agentPromptsJson)
      ? (run.agentPromptsJson as unknown as AgentPrompt[])
      : [];

    let siblingRunId: string | null = null;
    if (run.projectUrlId) {
      const oppositeDevice = run.device === 'mobile' ? 'desktop' : 'mobile';
      const sibling = await prisma.auditRun.findFirst({
        where: {
          projectUrlId: run.projectUrlId,
          device: oppositeDevice,
          status: 'success',
          createdAt: {
            gte: new Date(run.createdAt.getTime() - 10 * 60 * 1000),
            lte: new Date(run.createdAt.getTime() + 10 * 60 * 1000),
          },
        },
        select: { id: true },
      });
      if (sibling) {
        siblingRunId = sibling.id;
      } else {
        const latestOpposite = await prisma.auditRun.findFirst({
          where: {
            projectUrlId: run.projectUrlId,
            device: oppositeDevice,
            status: 'success',
          },
          orderBy: { createdAt: 'desc' },
          select: { id: true },
        });
        if (latestOpposite) {
          siblingRunId = latestOpposite.id;
        }
      }
    }

    return NextResponse.json({
      id: run.id,
      status: run.status,
      url: run.projectUrl.url,
      pageType: run.projectUrl.pageType,
      projectId: run.project.id,
      projectTitle: run.project.title,
      projectOwner: run.project.owner,
      environment: run.project.environment,
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
        ttfb: run.ttfb,
      },
      opportunities,
      agentPrompts,
      aiSummary: run.aiSummary,
      device: run.device,
      siblingRunId,
      advancedDiagnostics: run.rawJson ? extractAdvancedDiagnostics(run.rawJson, childLogger({ stage: 'api-audit-detail' })) : null,
      createdAt: run.createdAt.toISOString(),
    });
  } catch (error) {
    console.error(`GET /api/audits/${id} error:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
};
