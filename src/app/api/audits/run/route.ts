import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { childLogger } from "@/lib/logger";
import { runAudit } from "@/lib/audit/runner";
import { extractMetrics } from "@/lib/audit/metrics-extractor";
import { generateSummary } from "@/lib/audit/ai-summarizer";
import { Opportunity, AgentPrompt, ExtractedMetrics } from "@/types";
import type { Logger } from "pino";

export interface RunAuditRequest {
  url: string;
  projectUrlId?: string;
  pageType?: string;
}

export interface RunAuditResponse {
  auditRunId: string;
  url: string;
  status: "success" | "failed";
  device: "mobile" | "desktop";
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
    ttfb: number | null;
  };
  opportunities: Opportunity[];
  aiSummary: string | null;
  agentPrompts: AgentPrompt[];
  createdAt: string;
  error?: string;
}

export interface RunAuditsResponse {
  mobile: RunAuditResponse;
  desktop: RunAuditResponse;
}

async function executeAuditForDevice({
  url,
  projectUrlId,
  projectId,
  pageType,
  device,
  log,
}: {
  url: string;
  projectUrlId?: string;
  projectId: string | null;
  pageType: string;
  device: "mobile" | "desktop";
  log: Logger;
}): Promise<RunAuditResponse> {
  log.info({ url, projectUrlId, pageType, device }, `Starting on-demand ${device} audit`);

  // ── Run Lighthouse audit ──────────────────────────────────────────────────
  const auditResult = await runAudit({ url, device, maxRetries: 1 }, log);

  if (!auditResult.success) {
    // Save failed run if linked to a project URL
    if (projectUrlId && projectId) {
      const failedRun = await prisma.auditRun.create({
        data: {
          projectId,
          projectUrlId,
          status: "failed",
          device,
        },
      });

      return {
        auditRunId: failedRun.id,
        url,
        status: "failed",
        device,
        performanceScore: null,
        accessibilityScore: null,
        seoScore: null,
        bestPracticesScore: null,
        coreWebVitals: {
          lcp: null,
          cls: null,
          inpOrTbt: null,
          fcp: null,
          speedIndex: null,
          ttfb: null,
        },
        opportunities: [],
        aiSummary: null,
        agentPrompts: [],
        createdAt: failedRun.createdAt.toISOString(),
        error: auditResult.error,
      };
    }

    return {
      auditRunId: `adhoc-failed-${Date.now()}`,
      url,
      status: "failed",
      device,
      performanceScore: null,
      accessibilityScore: null,
      seoScore: null,
      bestPracticesScore: null,
      coreWebVitals: {
        lcp: null,
        cls: null,
        inpOrTbt: null,
        fcp: null,
        speedIndex: null,
        ttfb: null,
      },
      opportunities: [],
      aiSummary: null,
      agentPrompts: [],
      createdAt: new Date().toISOString(),
      error: `Audit failed: ${auditResult.error}`,
    };
  }

  // ── Extract metrics ───────────────────────────────────────────────────────
  const metrics = extractMetrics(auditResult.lhr, log);

  // ── Persist audit run (only if linked to a project URL) ──────────────────
  let auditRunId: string;
  let createdAt: string;

  if (projectUrlId && projectId) {
    // Query the most recent prior successful run of the same device for trend-aware context.
    // This MUST run before AuditRun.create so it returns the previous run, not the current one.
    let previousMetrics: Partial<ExtractedMetrics> | undefined;
    try {
      const priorRun = await prisma.auditRun.findFirst({
        where: { projectUrlId, status: "success", device },
        orderBy: { createdAt: "desc" },
        select: {
          performanceScore: true,
          lcp: true,
          cls: true,
          inpOrTbt: true,
          fcp: true,
          speedIndex: true,
        },
      });
      if (priorRun) {
        previousMetrics = {
          performanceScore: priorRun.performanceScore,
          lcp: priorRun.lcp,
          cls: priorRun.cls,
          inpOrTbt: priorRun.inpOrTbt,
          fcp: priorRun.fcp,
          speedIndex: priorRun.speedIndex,
        };
      }
    } catch (err) {
      log.warn(
        { err: err instanceof Error ? err.message : String(err), projectUrlId, device },
        "Failed to query prior run for trend context — proceeding without previousMetrics",
      );
    }

    const auditRun = await prisma.auditRun.create({
      data: {
        projectId,
        projectUrlId,
        status: "success",
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
        htmlReport: auditResult.htmlReport,
        rawJson: auditResult.lhr as any,
      },
    });
    auditRunId = auditRun.id;
    createdAt = auditRun.createdAt.toISOString();

    // Generate AI summary and update record
    const summaryResult = await generateSummary(
      { url, pageType, metrics, previousMetrics },
      log,
    );
    const aiSummary = summaryResult.success
      ? summaryResult.output.summary
      : summaryResult.fallback;
    const agentPrompts = summaryResult.success
      ? summaryResult.output.agentPrompts
      : [];

    await prisma.auditRun.update({
      where: { id: auditRunId },
      data: { aiSummary, agentPromptsJson: agentPrompts as any },
    });

    log.info({ auditRunId, url, device }, "On-demand audit completed and saved");

    return {
      auditRunId,
      url,
      status: "success",
      device,
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
        ttfb: metrics.ttfb,
      },
      opportunities: metrics.opportunities,
      aiSummary,
      agentPrompts,
      createdAt,
    };
  }

  // Ad-hoc run (not linked to a project) — return results without saving
  // No projectUrlId means no prior run to compare against; previousMetrics is always undefined.
  const summaryResult = await generateSummary(
    { url, pageType, metrics, previousMetrics: undefined },
    log,
  );
  const aiSummary = summaryResult.success
    ? summaryResult.output.summary
    : summaryResult.fallback;
  const agentPrompts = summaryResult.success
    ? summaryResult.output.agentPrompts
    : [];

  log.info({ url, device }, "On-demand ad-hoc audit completed (not saved)");

  return {
    auditRunId: `adhoc-${Date.now()}`,
    url,
    status: "success",
    device,
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
      ttfb: metrics.ttfb,
    },
    opportunities: metrics.opportunities,
    aiSummary,
    agentPrompts,
    createdAt: new Date().toISOString(),
  };
}

/**
 * POST /api/audits/run
 *
 * Runs an on-demand Lighthouse audit for both mobile and desktop.
 * Executes the full pipeline: Lighthouse → metrics extraction → AI summary.
 * Saves the result as an AuditRun record and returns it immediately.
 *
 * Body: { url: string, projectUrlId?: string, pageType?: string }
 *
 * Note: This runs Lighthouse synchronously. Expect 30–80s response time for both.
 */
export async function POST(request: NextRequest) {
  const log = childLogger({ stage: "on-demand-audit" });

  let body: RunAuditRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { url, projectUrlId, pageType = "ad-hoc" } = body;

  // Validate URL
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "url is required" }, { status: 422 });
  }

  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: `Invalid URL: ${url}` }, { status: 422 });
  }

  const parsedUrl = new URL(url);
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return NextResponse.json(
      { error: "URL must use http or https protocol" },
      { status: 422 },
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
      return NextResponse.json(
        { error: "projectUrlId not found" },
        { status: 404 },
      );
    }
    projectId = projectUrl.projectId;
  }

  try {
    const mobileResult = await executeAuditForDevice({
      url,
      projectUrlId,
      projectId,
      pageType,
      device: "mobile",
      log,
    });

    const desktopResult = await executeAuditForDevice({
      url,
      projectUrlId,
      projectId,
      pageType,
      device: "desktop",
      log,
    });

    return NextResponse.json({
      mobile: mobileResult,
      desktop: desktopResult,
    });
  } catch (error) {
    console.error(`POST /api/audits/run error:`, error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
