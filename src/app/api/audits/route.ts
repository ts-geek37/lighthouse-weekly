import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const GET = async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId') ?? undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100);
    const page = Math.max(parseInt(searchParams.get('page') ?? '1', 10), 1);
    const skip = (page - 1) * limit;

    const where = projectId ? { projectId } : {};

    const [auditRuns, total] = await Promise.all([
      prisma.auditRun.findMany({
        where,
        include: {
          project: { select: { id: true, title: true, environment: true } },
          projectUrl: { select: { id: true, url: true, pageType: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      prisma.auditRun.count({ where }),
    ]);

    return NextResponse.json({
      data: auditRuns.map(run => ({
        id: run.id,
        status: run.status,
        url: run.projectUrl.url,
        pageType: run.projectUrl.pageType,
        projectId: run.project.id,
        projectTitle: run.project.title,
        environment: run.project.environment,
        performanceScore: run.performanceScore,
        accessibilityScore: run.accessibilityScore,
        seoScore: run.seoScore,
        bestPracticesScore: run.bestPracticesScore,
        lcp: run.lcp,
        cls: run.cls,
        inpOrTbt: run.inpOrTbt,
        fcp: run.fcp,
        speedIndex: run.speedIndex,
        aiSummary: run.aiSummary,
        device: run.device,
        createdAt: run.createdAt.toISOString(),
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('GET /api/audits error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
};
