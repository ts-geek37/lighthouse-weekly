import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Opportunity, AgentPrompt } from '@/types';

/**
 * GET /api/audits/:id
 * Returns full detail for a single audit run including opportunities JSON.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const agentPrompts: AgentPrompt[] = Array.isArray((run as any).agentPromptsJson)
      ? ((run as any).agentPromptsJson as AgentPrompt[])
      : [];

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
      },
      opportunities,
      agentPrompts,
      aiSummary: run.aiSummary,
      createdAt: run.createdAt.toISOString(),
    });
  } catch (error) {
    console.error(`GET /api/audits/${id} error:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
