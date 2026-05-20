import { prisma } from "@/lib/prisma";
import Groq from "groq-sdk";
import { childLogger } from "@/lib/logger";
import { Opportunity, AgentPrompt, MetricSituation } from "@/types";
import { getInvestigationSteps } from "../audit/ai-summarizer";
import {
  UrlComparisonResult,
  ProjectComparisonReport,
  MetricChange,
  RegressionItem,
  ImprovementItem,
  DeterministicRecommendation,
} from "./comparisonTypes";
import { compareAllMetrics } from "./compareMetrics";
import {
  diffOpportunities,
  detectRegressionsAndImprovements,
  generateRecommendations,
} from "./detectRegressions";
import { buildComparisonPrompt } from "./generateComparisonPrompt";

const log = childLogger({ stage: "weekly-intelligence-service" });

export class WeeklyIntelligenceService {
  /**
   * Generates or fetches the numerical weekly performance intelligence report for a project.
   */
  static async getComparisonReport(projectId: string, device: "mobile" | "desktop" = "mobile"): Promise<ProjectComparisonReport> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        urls: {
          orderBy: { priority: "asc" },
        },
      },
    });

    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const urlReports: UrlComparisonResult[] = [];

    for (const projectUrl of project.urls) {
      // 1. Fetch latest 2 successful runs for the specific device
      const runs = await prisma.auditRun.findMany({
        where: {
          projectUrlId: projectUrl.id,
          status: "success",
          device,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 2,
      });

      // 2. Fetch last 10 successful runs for trend charts for the specific device
      const historicalRunsData = await prisma.auditRun.findMany({
        where: {
          projectUrlId: projectUrl.id,
          status: "success",
          device,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 10,
      });

      const historicalRuns = historicalRunsData.map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        performanceScore: r.performanceScore,
        lcp: r.lcp,
        cls: r.cls,
        inpOrTbt: r.inpOrTbt,
      })).reverse(); // Oldest first for chart rendering

      if (runs.length < 2) {
        urlReports.push({
          projectUrlId: projectUrl.id,
          url: projectUrl.url,
          pageType: projectUrl.pageType,
          hasEnoughData: false,
          latestCreatedAt: runs[0]?.createdAt || null,
          previousCreatedAt: null,
          metrics: null,
          regressions: [],
          improvements: [],
          opportunities: { new: [], resolved: [] },
          recommendations: [],
          agentPrompts: [],
          aiInsight: null,
          historicalRuns,
        });
        continue;
      }

      const latestRun = runs[0];
      const previousRun = runs[1];

      // Cast opportunitiesJson
      const prevOpps: Opportunity[] = JSON.parse(JSON.stringify(previousRun.opportunitiesJson)) || [];
      const currOpps: Opportunity[] = JSON.parse(JSON.stringify(latestRun.opportunitiesJson)) || [];

      // 3. Run comparison calculations
      const metricsMap = compareAllMetrics(
        previousRun as any,
        latestRun as any
      ) as UrlComparisonResult["metrics"];

      const { newOpps, resolvedOpps } = diffOpportunities(prevOpps, currOpps);

      const { regressions, improvements } = detectRegressionsAndImprovements(
        metricsMap!,
        newOpps
      );

      const recommendations = generateRecommendations(
        metricsMap!,
        currOpps,
        newOpps
      );

      // 4. Handle snapshot caching
      let snapshot = await prisma.weeklyIntelligenceSnapshot.findUnique({
        where: {
          projectUrlId_latestRunId_previousRunId: {
            projectUrlId: projectUrl.id,
            latestRunId: latestRun.id,
            previousRunId: previousRun.id,
          },
        },
      });

      if (!snapshot) {
        try {
          snapshot = await prisma.weeklyIntelligenceSnapshot.create({
            data: {
              projectId,
              projectUrlId: projectUrl.id,
              latestRunId: latestRun.id,
              previousRunId: previousRun.id,
              metricsJson: metricsMap as any,
              regressionsJson: regressions as any,
              improvementsJson: improvements as any,
              aiInsight: null,
            },
          });
        } catch (err) {
          log.warn({ err, projectUrlId: projectUrl.id }, "Concurrency error writing snapshot — ignoring");
        }
      }

      // Generate dynamic comparison-specific agent prompts
      const weeklyAgentPrompts: AgentPrompt[] = [];
      let promptRank = 1;

      // 1. Regressions
      if (metricsMap) {
        const sortedRegressions = [...regressions].sort((a, b) => {
          const severityOrder = { high: 3, medium: 2, low: 1 };
          return severityOrder[b.severity] - severityOrder[a.severity];
        });

        for (const reg of sortedRegressions) {
          const change = metricsMap[reg.metric as keyof typeof metricsMap];
          if (!change) continue;

          const prevStr = change.previous !== null ? `${change.previous}${change.unit}` : "N/A";
          const currStr = change.current !== null ? `${change.current}${change.unit}` : "N/A";
          const deltaStr = change.delta !== null ? (change.delta > 0 ? `+${change.delta}` : `${change.delta}`) : "0";
          const pctStr = change.percentage !== null ? ` (${change.percentage > 0 ? `+${change.percentage}` : `${change.percentage}`}% change)` : "";

          const metricAbbrev = getMetricAbbrev(reg.metric);
          const steps = getRegressionSteps(reg.metric);
          const prompt = `# Performance Regression Attribution Brief — Priority ${promptRank}

## 1. Regression Context
A performance regression has been detected comparing the baseline week against the current week.
- Metric Affected: ${reg.label} (${metricAbbrev})
- Baseline: ${prevStr}
- Current: ${currStr}
- Delta: ${deltaStr}${change.unit}${pctStr}
- Severity: ${reg.severity.toUpperCase()}
- Confidence: ${reg.confidence.toUpperCase()}

## 2. Metric Impact
${reg.message}

## 3. Audited Page
- URL: ${projectUrl.url} (${projectUrl.pageType})

## 4. Investigation Objective
Perform an evidence-backed regression attribution analysis to locate the exact commit, file, component, function, or configuration change introduced during the last week that caused this ${metricAbbrev} degradation. Do NOT write or implement fixes.

## 5. Investigation Requirements
You are a senior staff performance engineer. You must:
- Force comparative reasoning: explain how the baseline state differed from the regression state.
- Identify the exact rendering paths, bundle differences, database queries, edge caching, or network overhead that degraded.
- Avoid speculative explanations; every assertion must be backed by codebase evidence (such as file paths, lines of code, or configuration keys).

## 6. Repository Investigation Areas
Based on the metric type (${reg.metric}), focus your investigation on:
${steps}

## 7. Required Investigation Workflow
1. **Locate the delta**: Use grep or ripgrep to search for recent changes in components, styles, imports, server configurations, or data-fetching logic related to this page.
2. **Trace the execution path**: Trace how these changes affect the critical rendering path, hydration cycle, network behavior, or main-thread block time.
3. **Establish baseline vs current differences**: Contrast the old implementation patterns against the newly introduced code to pinpoint the regression source.

## 8. Evidence Requirements
Every finding must include:
- The exact file path (1-indexed line references where appropriate)
- The name of the component, function, hook, middleware, or config key
- A concrete explanation of how this change contributed to the ${deltaStr}${change.unit} latency shift or metric degradation
- Confidence calibration (High/Medium/Low) for each suspected cause

## 9. Constraints
- **Do NOT implement code changes or refactors.**
- Do NOT generate generic optimization summaries.
- Ground all findings strictly in the codebase files that exist in the repository.

## 10. Expected Deliverable
Provide a structured engineering report matching the exact format below:

### Executive Summary
[A concise summary of the regression attribution findings]

### Primary Root Cause
[The primary code or configuration change responsible for the degradation, with supporting technical reasoning]

### Secondary Contributing Factors
[Any secondary code changes, network latency shifts, or asset size increases that compounded the issue]

### Technical Evidence
[Code snippets, file changes, bundle size differences, or execution trace timings backing up the attribution]

### Affected Files & Components
[Markdown table showing File Path | Component/Hook Name | Suspected Commit/PR (if known) | Latency/Weight Impact]

### Recommended Remediation Strategy
[Specific, actionable architectural or code-level suggestions to restore baseline performance, without writing the code]

### Confidence Assessment
[High/Medium/Low with rationale based on evidence strength]

### Expected Performance Recovery
[Estimated recovery amount in milliseconds/points upon successful remediation]`;

          weeklyAgentPrompts.push({
            opportunityId: `regression-${reg.metric}`,
            opportunityTitle: `Regression: ${reg.label} Degraded (${deltaStr}${change.unit})`,
            rank: promptRank,
            savingsMs: null,
            savingsBytes: null,
            prompt,
          });
          promptRank++;
        }
      }

      // 2. New Opportunities
      const sortedNewOpps = [...newOpps].sort((a, b) => {
        const aVal = (a.savingsMs ?? 0) + (a.savingsBytes ?? 0) / 1000;
        const bVal = (b.savingsMs ?? 0) + (b.savingsBytes ?? 0) / 1000;
        return bVal - aVal;
      });

      for (const opp of sortedNewOpps) {
        const oppSituation =
          opp.id === "unused-javascript"
            ? "CRITICAL"
            : opp.id === "render-blocking-resources"
            ? "CRITICAL"
            : ("GOOD" as MetricSituation);

        const steps = getInvestigationSteps(opp.id, {
          performanceScore: null,
          accessibilityScore: null,
          seoScore: null,
          bestPracticesScore: null,
          lcp: null,
          cls: null,
          inpOrTbt: null,
          fcp: null,
          speedIndex: null,
          ttfb: null,
          opportunities: [],
        }, oppSituation);

        const savings: string[] = [];
        if (opp.savingsMs) savings.push(`~${opp.savingsMs}ms load time`);
        if (opp.savingsBytes) savings.push(`~${Math.round(opp.savingsBytes / 1024)}KB transfer size`);
        const savingsStr = savings.length ? savings.join(" / ") : "N/A";
        const oppMetricImpact = getOpportunityMetric(opp.id);

        const prompt = `# New Performance Opportunity Analysis Brief — Priority ${promptRank}

## 1. Opportunity Context
A new performance optimization opportunity was flagged in the latest audit run (this was not present in the baseline run).
- Opportunity: ${opp.title}
- Estimated Savings: ${savingsStr}
- Target Metric Impact: ${oppMetricImpact}

## 2. Metric Impact
${opp.description}

## 3. Audited Page
- URL: ${projectUrl.url} (${projectUrl.pageType})

## 4. Investigation Objective
Perform an evidence-backed analysis to locate where this performance optimization opportunity was introduced in the codebase (e.g. newly imported package, CSS rules, render-blocking asset, or unoptimized image tag). Do NOT write or implement fixes.

## 5. Investigation Requirements
You are a senior staff performance engineer. You must:
- Trace the page dependencies, layout assets, or script elements to identify the exact files or configurations responsible for introducing this opportunity.
- Quantify the impact (e.g. transfer size, compilation time, layout shifts) of the unoptimized resources.
- Avoid speculative explanations; every assertion must be backed by codebase evidence (such as file paths, imports, or elements).

## 6. Repository Investigation Areas
Based on this opportunity type (${opp.id}), focus your investigation on:
${steps}

## 7. Required Investigation Workflow
1. **Scan page bundle & assets**: Trace the imports, media queries, or script tags loaded on the audited page.
2. **Detect unoptimized assets**: Search for the resources flagged by Lighthouse inside the codebase.
3. **Compare execution options**: Explain why the current implementation is suboptimal compared to the recommended optimized path.

## 8. Evidence Requirements
Every finding must include:
- The exact file path and import path (or line number) of the unoptimized asset/code
- The component, hook, or asset name
- A concrete explanation of why it is suboptimal and how it affects page metrics
- Confidence calibration (High/Medium/Low) for each identified resource

## 9. Constraints
- **Do NOT implement code changes or refactors.**
- Do NOT generate generic optimization advice.
- Ground all findings strictly in codebase files that exist in the repository.

## 10. Expected Deliverable
Provide a structured engineering report matching the exact format below:

### Executive Summary
[A concise summary of the optimization opportunity attribution findings]

### Primary Root Cause
[The primary code pattern, dependency, or media asset that introduced this opportunity]

### Secondary Contributing Factors
[Any secondary code configurations or layout details that compound the impact]

### Technical Evidence
[Code snippets, file paths, bundle size calculations, or styling details backing up the opportunity]

### Affected Files & Components
[Markdown table showing File Path | Component/Asset Name | Suspected Commit/PR (if known) | Estimated Savings]

### Recommended Remediation Strategy
[Specific, actionable suggestions to resolve the Lighthouse finding (e.g., dynamic imports, image formatting, preload directives)]

### Confidence Assessment
[High/Medium/Low with rationale based on evidence strength]

### Expected Performance Recovery
[Estimated recovery amount in milliseconds/points upon successful remediation]`;

        weeklyAgentPrompts.push({
          opportunityId: opp.id,
          opportunityTitle: `New Opportunity: ${opp.title}`,
          rank: promptRank,
          savingsMs: opp.savingsMs ?? null,
          savingsBytes: opp.savingsBytes ?? null,
          prompt,
        });
        promptRank++;
      }

      urlReports.push({
        projectUrlId: projectUrl.id,
        url: projectUrl.url,
        pageType: projectUrl.pageType,
        hasEnoughData: true,
        latestCreatedAt: latestRun.createdAt,
        previousCreatedAt: previousRun.createdAt,
        metrics: metricsMap,
        regressions,
        improvements,
        opportunities: {
          new: newOpps,
          resolved: resolvedOpps,
        },
        recommendations,
        agentPrompts: weeklyAgentPrompts,
        aiInsight: snapshot?.aiInsight || null,
        historicalRuns,
      });
    }

    return {
      projectId: project.id,
      projectTitle: project.title,
      urls: urlReports,
    };
  }

  /**
   * Triggers the Groq LLM to generate AI regression insights, and caches the result in the snapshot.
   */
  static async getOrGenerateAiInsight(
    projectUrlId: string,
    latestRunId: string,
    previousRunId: string
  ): Promise<string> {
    const snapshot = await prisma.weeklyIntelligenceSnapshot.findUnique({
      where: {
        projectUrlId_latestRunId_previousRunId: {
          projectUrlId,
          latestRunId,
          previousRunId,
        },
      },
      include: {
        projectUrl: true,
      },
    });

    if (!snapshot) {
      throw new Error(`Snapshot not found for URL ID: ${projectUrlId}, Latest: ${latestRunId}, Previous: ${previousRunId}`);
    }

    if (snapshot.aiInsight) {
      return snapshot.aiInsight;
    }

    const latestRun = await prisma.auditRun.findUnique({ where: { id: latestRunId } });
    const previousRun = await prisma.auditRun.findUnique({ where: { id: previousRunId } });

    if (!latestRun || !previousRun) {
      throw new Error("Audit runs for snapshot not found");
    }

    const prevOpps: Opportunity[] = JSON.parse(JSON.stringify(previousRun.opportunitiesJson)) || [];
    const currOpps: Opportunity[] = JSON.parse(JSON.stringify(latestRun.opportunitiesJson)) || [];

    const metricsMap = compareAllMetrics(previousRun as any, latestRun as any) as UrlComparisonResult["metrics"];
    const { newOpps, resolvedOpps } = diffOpportunities(prevOpps, currOpps);
    const { regressions, improvements } = detectRegressionsAndImprovements(metricsMap!, newOpps);
    const recommendations = generateRecommendations(metricsMap!, currOpps, newOpps);

    // Call Groq API
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      log.warn("GROQ_API_KEY is not defined in environment variables — returning mock summary");
      const fallbackSummary = "## Executive Summary\nPerformance analysis could not be generated because the AI service API key is missing. Please check your environment variables.\n\n## Performance Analysis & Hypotheses\nUnable to construct hypotheses without AI.\n\n## Prioritized Recommended Actions\n1. Review the deterministic recommendations below for details.\n\nAnalysis Confidence: LOW - AI key missing";
      
      await prisma.weeklyIntelligenceSnapshot.update({
        where: { id: snapshot.id },
        data: { aiInsight: fallbackSummary },
      });
      return fallbackSummary;
    }

    const groq = new Groq({ apiKey });
    const prompts = buildComparisonPrompt(
      snapshot.projectUrl.url,
      snapshot.projectUrl.pageType,
      metricsMap!,
      regressions,
      improvements,
      newOpps,
      resolvedOpps,
      recommendations
    );

    try {
      const completion = await groq.chat.completions.create({
        messages: [
          { role: "system", content: prompts.system },
          { role: "user", content: prompts.user },
        ],
        model: "llama-3.3-70b-versatile",
        temperature: 0.1,
      });

      // console.log("Prompt tokens:", completion.usage?.prompt_tokens);
      // console.log("Completion tokens:", completion.usage?.completion_tokens);
      // console.log("Total tokens:", completion.usage?.total_tokens);

      const aiInsight = completion.choices[0]?.message?.content || "Failed to generate AI insights.";

      await prisma.weeklyIntelligenceSnapshot.update({
        where: { id: snapshot.id },
        data: { aiInsight },
      });

      return aiInsight;
    } catch (err) {
      log.error({ err }, "Failed to generate AI insights via Groq");
      throw new Error(`Groq LLM call failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

function getRegressionSteps(metric: string): string {
  switch (metric) {
    case "lcp":
      return `- Bundle & asset differences: check for newly added script/stylesheet dependencies blocking critical path.
- Rendering-path changes: inspect server components or layout templates for newly added heavy DOM elements above the fold.
- Image delivery: verify if modern image preloading or lazy-loading settings were altered.`;
    case "cls":
      return `- Layout instability analysis: identify recently added layout structures (like ad spots, image wrappers, headers) lacking fixed height/width aspect ratios.
- Font styling changes: verify web font declarations for missing font-display or preload directives causing late layout shift.
- Rendering behavior: audit conditional rendering or client-side mounting above the fold.`;
    case "inpOrTbt":
      return `- Main-thread blocking: locate new heavy script packages, synchronous event listeners (scroll, resize, interactive elements), or client-side calculation loops on mount.
- Hydration differences: trace Next.js hydration overhead or dynamic layout shifts.
- Code compilation: check for bloated imports or webpack chunk splitting modifications.`;
    case "fcp":
      return `- Rendering path: audit recently added styles, fonts, or assets that block initial layout painting.
- Dependency additions: identify newly imported packages loaded synchronously inside Next.js document/root files.`;
    case "ttfb":
      return `- Server-side latency: analyze server-side data fetching changes (getServerSideProps, next/headers usages, slow edge api calls).
- Database queries: trace new slow queries, database joins, N+1 loading patterns, or Prisma client calls.
- Middleware: check for new authentication, logging, redirect, or rewrite logic in Next.js middleware.`;
    default:
      return `- Codebase changes: check for changes introduced in files affecting the page rendering cycle.
- Configurations: review any environment or dependency updates impacting the "${metric}" score.`;
  }
}

function getMetricAbbrev(metric: string): string {
  switch (metric.toLowerCase()) {
    case "performance":
    case "performancescore":
      return "Performance Score";
    case "accessibility":
    case "accessibilityscore":
      return "Accessibility Score";
    case "seo":
    case "seoscore":
      return "SEO Score";
    case "bestpractices":
    case "bestpracticesscore":
      return "Best Practices Score";
    case "lcp":
      return "LCP";
    case "cls":
      return "CLS";
    case "inportbt":
    case "tbt":
      return "INP/TBT";
    case "fcp":
      return "FCP";
    case "speedindex":
      return "Speed Index";
    case "ttfb":
      return "TTFB";
    default:
      return metric.toUpperCase();
  }
}

function getOpportunityMetric(oppId: string): string {
  switch (oppId) {
    case "unused-javascript":
    case "unused-css-rules":
      return "INP/TBT (Main-thread blocking and execution cost)";
    case "render-blocking-resources":
      return "FCP / LCP (Render blocking behavior)";
    case "offscreen-images":
    case "modern-image-formats":
    case "uses-responsive-images":
    case "optimized-images":
      return "LCP (Largest Contentful Paint payload size)";
    case "unminified-javascript":
    case "unminified-css":
      return "FCP / LCP (Payload size)";
    case "uses-text-compression":
      return "TTFB / FCP (Payload compression)";
    case "uses-long-cache-ttl":
      return "FCP / LCP (Asset load caching)";
    case "efficient-animated-content":
      return "LCP (Video/GIF payload size)";
    default:
      return "General Performance";
  }
}
