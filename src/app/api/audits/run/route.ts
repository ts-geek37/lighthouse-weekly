import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { childLogger } from '@/lib/logger';
import { runAudit } from '@/lib/audit/runner';
import { extractMetrics } from '@/lib/audit/metrics-extractor';
import { generateSummary } from '@/lib/audit/ai-summarizer';
import { Opportunity, AgentPrompt } from '@/types';

export interface RunAuditRequest {
  url: string;
  projectUrlId?: string;
  pageType?: string;
}

export interface RunAuditResponse {
  auditRunId: string;
  url: string;
  status: 'success' | 'failed';
  performanceScore: number | null;
  accessibilityScore: number | null;
  seoScore: number | null;
  bestPracticesScore: number | null;
  coreWebVitals: {
    lcp: number | null;
    cls: number | null;
    inpOrTbt: number | null;
    fcp: number | null;
    speedIndex: number | null;
  };
  opportunities: Opportunity[];
  aiSummary: string | null;
  agentPrompts: AgentPrompt[];
  createdAt: string;
  error?: string;
}

/**
 * POST /api/audits/run
 *
 * Runs an on-demand Lighthouse audit for a single URL.
 * Executes the full pipeline: Lighthouse → metrics extraction → AI summary.
 * Saves the result as an AuditRun record and returns it immediately.
 *
 * Body: { url: string, projectUrlId?: string, pageType?: string }
 *
 * Note: This runs Lighthouse synchronously. Expect 15–45s response time.
 * For local dev this is fine. For Vercel deployment, set maxDuration in next.config.ts.
 */
export async function POST(request: NextRequest) {
  const log = childLogger({ stage: 'on-demand-audit' });

  let body: RunAuditRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { url, projectUrlId, pageType = 'ad-hoc' } = body;

  // Validate URL
  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'url is required' }, { status: 422 });
  }

  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: `Invalid URL: ${url}` }, { status: 422 });
  }

  const parsedUrl = new URL(url);
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return NextResponse.json(
      { error: 'URL must use http or https protocol' },
      { status: 422 }
    );
  }

  // If projectUrlId provided, verify it exists and get its projectId
  let projectId: string | null = null;
  if (projectUrlId) {
    const projectUrl = await prisma.projectUrl.findUnique({
      where: { id: projectUrlId },
      select: { projectId: true },
    });
    if (!projectUrl) {
      return NextResponse.json({ error: 'projectUrlId not found' }, { status: 404 });
    }
    projectId = projectUrl.projectId;
  }

  log.info({ url, projectUrlId, pageType }, 'Starting on-demand audit');

  // ── Run Lighthouse audit ──────────────────────────────────────────────────
  const auditResult = await runAudit({ url, maxRetries: 1 }, log);

  if (!auditResult.success) {
    // Save failed run if linked to a project URL
    if (projectUrlId && projectId) {
      const failedRun = await prisma.auditRun.create({
        data: {
          projectId,
          projectUrlId,
          status: 'failed',
        },
      });

      const response: RunAuditResponse = {
        auditRunId: failedRun.id,
        url,
        status: 'failed',
        performanceScore: null,
        accessibilityScore: null,
        seoScore: null,
        bestPracticesScore: null,
        coreWebVitals: { lcp: null, cls: null, inpOrTbt: null, fcp: null, speedIndex: null },
        opportunities: [],
        aiSummary: null,
        agentPrompts: [],
        createdAt: failedRun.createdAt.toISOString(),
        error: auditResult.error,
      };

      return NextResponse.json(response, { status: 200 });
    }

    return NextResponse.json(
      { error: `Audit failed: ${auditResult.error}` },
      { status: 502 }
    );
  }

  // ── Extract metrics ───────────────────────────────────────────────────────
  const metrics = extractMetrics(auditResult.lhr, log);

  // ── Persist audit run (only if linked to a project URL) ──────────────────
  let auditRunId: string;
  let createdAt: string;

  if (projectUrlId && projectId) {
    const auditRun = await prisma.auditRun.create({
      data: {
        projectId,
        projectUrlId,
        status: 'success',
        performanceScore: metrics.performanceScore,
        accessibilityScore: metrics.accessibilityScore,
        seoScore: metrics.seoScore,
        bestPracticesScore: metrics.bestPracticesScore,
        lcp: metrics.lcp,
        cls: metrics.cls,
        inpOrTbt: metrics.inpOrTbt,
        fcp: metrics.fcp,
        speedIndex: metrics.speedIndex,
        opportunitiesJson: metrics.opportunities as any,
      },
    });
    auditRunId = auditRun.id;
    createdAt = auditRun.createdAt.toISOString();

    // Generate AI summary and update record
    const summaryResult = await generateSummary({ url, pageType, metrics }, log);
    const aiSummary = summaryResult.success ? summaryResult.output.summary : summaryResult.fallback;
    const agentPrompts = summaryResult.success ? summaryResult.output.agentPrompts : [];

    await prisma.auditRun.update({
      where: { id: auditRunId },
      data: { aiSummary, waZ: agentPrompts as any } as any,
    });

    const response: RunAuditResponse = {
      auditRunId,
      url,
      status: 'success',
      performanceScore: metrics.performanceScore,
      accessibilityScore: metrics.accessibilityScore,
      seoScore: metrics.seoScore,
      bestPracticesScore: metrics.bestPracticesScore,
      coreWebVitals: {
        lcp: metrics.lcp,
        cls: metrics.cls,
        inpOrTbt: metrics.inpOrTbt,
        fcp: metrics.fcp,
        speedIndex: metrics.speedIndex,
      },
      opportunities: metrics.opportunities,
      aiSummary,
      agentPrompts,
      createdAt,
    };

    log.info({ auditRunId, url }, 'On-demand audit completed and saved');
    return NextResponse.json(response);
  }

  // Ad-hoc run (not linked to a project) — return results without saving
  const summaryResult = await generateSummary({ url, pageType, metrics }, log);
  const aiSummary = summaryResult.success ? summaryResult.output.summary : summaryResult.fallback;
  const agentPrompts = summaryResult.success ? summaryResult.output.agentPrompts : [];

  const response: RunAuditResponse = {
    auditRunId: `adhoc-${Date.now()}`,
    url,
    status: 'success',
    performanceScore: metrics.performanceScore,
    accessibilityScore: metrics.accessibilityScore,
    seoScore: metrics.seoScore,
    bestPracticesScore: metrics.bestPracticesScore,
    coreWebVitals: {
      lcp: metrics.lcp,
      cls: metrics.cls,
      inpOrTbt: metrics.inpOrTbt,
      fcp: metrics.fcp,
      speedIndex: metrics.speedIndex,
    },
    opportunities: metrics.opportunities,
    aiSummary,
    agentPrompts,
    createdAt: new Date().toISOString(),
  };

  log.info({ url }, 'On-demand ad-hoc audit completed (not saved)');
  return NextResponse.json(response);
}
