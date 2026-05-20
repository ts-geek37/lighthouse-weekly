"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ScoreBadge } from "@/components/ScoreBadge";
import { AgentPrompt, AdvancedDiagnostics } from "@/types";
import { AgentPromptCard } from "@/components/AgentPromptCard";

import { ScoreComparisonCards } from "@/components/weekly-intelligence/ScoreComparisonCards";
import { VitalsComparisonTable } from "@/components/weekly-intelligence/VitalsComparisonTable";
import { RegressionList } from "@/components/weekly-intelligence/RegressionList";
import { OpportunityDiffList } from "@/components/weekly-intelligence/OpportunityDiffList";
import { DeterministicRecommendationList } from "@/components/weekly-intelligence/DeterministicRecommendationList";
import { AiInsightPanel } from "@/components/weekly-intelligence/AiInsightPanel";
import { TrendChart } from "@/components/weekly-intelligence/TrendChart";
import { ProjectComparisonReport } from "@/lib/comparison/comparisonTypes";

interface AuditDetail {
  id: string;
  status: string;
  url: string;
  pageType: string;
  projectId: string;
  projectTitle: string;
  projectOwner: string;
  environment: string;
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
  opportunities: Array<{
    id: string;
    title: string;
    description: string;
    savingsMs?: number;
    savingsBytes?: number;
  }>;
  agentPrompts: AgentPrompt[];
  aiSummary: string | null;
  advancedDiagnostics?: AdvancedDiagnostics;
  createdAt: string;
  device: "mobile" | "desktop";
  siblingRunId: string | null;
}

const formatMs = (value: number | null): string =>
  value === null
    ? "N/A"
    : value >= 1000
      ? `${(value / 1000).toFixed(2)}s`
      : `${value.toFixed(2)}ms`;

const vitalStatus = (
  metric: string,
  value: number | null,
): "good" | "needs-improvement" | "poor" | "unknown" => {
  if (value === null) return "unknown";
  const thresholds: Record<string, [number, number]> = {
    lcp: [2500, 4000],
    cls: [0.1, 0.25],
    inpOrTbt: [200, 500],
    fcp: [1800, 3000],
    speedIndex: [3400, 5800],
  };
  const [good, poor] = thresholds[metric] ?? [Infinity, Infinity];
  if (value <= good) return "good";
  if (value <= poor) return "needs-improvement";
  return "poor";
};

const vitalColors = {
  good: "#065f46",
  "needs-improvement": "#92400e",
  poor: "#991b1b",
  unknown: "#9ca3af",
};
const vitalBg = {
  good: "#d1fae5",
  "needs-improvement": "#fef3c7",
  poor: "#fee2e2",
  unknown: "#f3f4f6",
};

const renderMarkdown = (text: string): React.ReactNode[] => {
  const blocks: React.ReactNode[] = [];
  let currentList: React.ReactNode[] = [];

  const pushList = () => {
    if (currentList.length > 0) {
      blocks.push(
        <ul
          key={`ul-${blocks.length}`}
          className="mb-2 list-disc pl-5 text-gray-600"
        >
          {currentList}
        </ul>,
      );
      currentList = [];
    }
  };

  text.split("\n").forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) {
      pushList();
      return;
    }

    if (trimmed.startsWith("## ")) {
      pushList();
      const title = trimmed.replace("## ", "");
      let icon = "💡";
      if (title.toLowerCase().includes("good")) icon = "✅";
      else if (
        title.toLowerCase().includes("needs attention") ||
        title.toLowerCase().includes("issue")
      )
        icon = "⚠️";
      else if (
        title.toLowerCase().includes("investigate") ||
        title.toLowerCase().includes("action")
      )
        icon = "🛠️";
      blocks.push(
        <h3 key={i} className="mb-3 mt-4 text-lg font-semibold text-gray-900">
          {icon} {title}
        </h3>,
      );
    } else if (trimmed.startsWith("# ")) {
      pushList();
      blocks.push(
        <h2
          key={i}
          className="mb-4 mt-6 border-b border-gray-200 pb-2 text-xl font-bold text-gray-950"
        >
          {trimmed.replace("# ", "")}
        </h2>,
      );
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const content = trimmed.slice(2);
      currentList.push(
        <li
          key={i}
          className="mb-1"
          dangerouslySetInnerHTML={{
            __html: content
              .replace(
                /\*\*(.*?)\*\*/g,
                '<strong class="font-semibold">$1</strong>',
              )
              .replace(
                /`(.*?)`/g,
                '<code class="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-sm">$1</code>',
              ),
          }}
        />,
      );
    } else {
      pushList();
      blocks.push(
        <p
          key={i}
          className="mb-3 text-gray-600"
          dangerouslySetInnerHTML={{
            __html: trimmed
              .replace(
                /\*\*(.*?)\*\*/g,
                '<strong class="font-semibold">$1</strong>',
              )
              .replace(
                /`(.*?)`/g,
                '<code class="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-sm">$1</code>',
              ),
          }}
        />,
      );
    }
  });
  pushList();

  return blocks;
};

const AuditDetailPage = ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = use(params);
  const [mobileAudit, setMobileAudit] = useState<AuditDetail | null>(null);
  const [desktopAudit, setDesktopAudit] = useState<AuditDetail | null>(null);
  const [activeDevice, setActiveDevice] = useState<"mobile" | "desktop">(
    "mobile",
  );
  const [activeTab, setActiveTab] = useState<"overview" | "official">(
    "overview",
  );
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [comparisonReport, setComparisonReport] =
    useState<ProjectComparisonReport | null>(null);
  const [loadingComparison, setLoadingComparison] = useState(false);

  const setAuditForDevice = (data: AuditDetail) => {
    if (data.device === "mobile") {
      setMobileAudit(data);
    } else {
      setDesktopAudit(data);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const fetchAuditPair = async () => {
      setLoading(true);
      setNotFound(false);
      setMobileAudit(null);
      setDesktopAudit(null);
      setComparisonReport(null);

      try {
        const response = await fetch(`/api/audits/${id}`);
        if (response.status === 404) {
          if (!cancelled) {
            setNotFound(true);
            setLoading(false);
          }
          return;
        }
        if (!response.ok) throw new Error("Failed to fetch audit");

        const data: AuditDetail = await response.json();
        if (cancelled) return;

        setAuditForDevice(data);
        setActiveDevice(data.device);

        if (data.siblingRunId) {
          const siblingResponse = await fetch(
            `/api/audits/${data.siblingRunId}`,
          );
          if (siblingResponse.ok) {
            const sibling: AuditDetail = await siblingResponse.json();
            if (cancelled) return;
            setAuditForDevice(sibling);
            if (sibling.device === "mobile") {
              setActiveDevice("mobile");
            }
          }
        }
      } catch (err) {
        console.error("Error fetching audit detail:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAuditPair();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const audit =
    activeDevice === "mobile"
      ? (mobileAudit ?? desktopAudit)
      : (desktopAudit ?? mobileAudit);

  useEffect(() => {
    if (!audit?.projectId) return;

    let cancelled = false;
    setLoadingComparison(true);
    setComparisonReport(null);

    fetch(
      `/api/projects/${audit.projectId}/weekly-intelligence?device=${activeDevice}`,
    )
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch comparison");
        return r.json();
      })
      .then((data) => {
        if (!cancelled) setComparisonReport(data);
      })
      .catch((err) => {
        if (!cancelled) console.error("Error fetching comparison report:", err);
      })
      .finally(() => {
        if (!cancelled) setLoadingComparison(false);
      });

    return () => {
      cancelled = true;
    };
  }, [audit?.projectId, activeDevice]);

  if (loading)
    return (
      <div className="mx-auto max-w-6xl p-8">
        <p className="text-gray-500">Loading audit...</p>
      </div>
    );

  if (notFound)
    return (
      <div className="mx-auto max-w-6xl p-8">
        <p>Audit not found.</p>
        <Link
          href="/audits"
          className="text-sm text-gray-500 no-underline hover:text-gray-800"
        >
          Back to history
        </Link>
      </div>
    );

  if (!audit) return null;

  const activeUrlReport = comparisonReport?.urls.find(
    (u) => u.url === audit.url,
  );

  const vitals = [
    {
      key: "lcp",
      label: "LCP",
      value: audit.coreWebVitals.lcp,
      desc: "Largest Contentful Paint",
    },
    {
      key: "cls",
      label: "CLS",
      value: audit.coreWebVitals.cls,
      desc: "Cumulative Layout Shift",
    },
    {
      key: "inpOrTbt",
      label: "INP/TBT",
      value: audit.coreWebVitals.inpOrTbt,
      desc: "INP / Total Blocking Time",
    },
    {
      key: "fcp",
      label: "FCP",
      value: audit.coreWebVitals.fcp,
      desc: "First Contentful Paint",
    },
    {
      key: "speedIndex",
      label: "Speed Index",
      value: audit.coreWebVitals.speedIndex,
      desc: "Speed Index",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl p-6 sm:p-8">
      <div className="mb-6 flex items-center gap-2 text-sm">
        <Link
          href="/projects"
          className="text-gray-500 no-underline hover:text-gray-800"
        >
          Projects
        </Link>
        <span className="text-gray-300">/</span>
        <Link
          href={`/projects/${audit.projectId}`}
          className="text-gray-500 no-underline hover:text-gray-800"
        >
          {audit.projectTitle}
        </Link>
        <span className="text-gray-300">/</span>
        <Link
          href="/audits"
          className="text-gray-500 no-underline hover:text-gray-800"
        >
          Audits
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-700">Detail</span>
      </div>

      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="mb-1 text-3xl font-bold text-gray-900">
            {audit.pageType} Audit
          </h1>
          <a
            href={audit.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-base text-blue-600 no-underline hover:underline"
          >
            {audit.url}
          </a>
          <div className="mt-1 text-sm text-gray-500">
            {audit.projectTitle} · {audit.environment} · {audit.projectOwner} ·{" "}
            {new Date(audit.createdAt).toLocaleString()}
          </div>
        </div>
        {audit.status !== "failed" && (
          <div className="flex gap-2">
            {audit.status === "failed" && (
              <span className="rounded-md bg-red-100 px-3 py-1.5 text-sm font-medium text-red-800">
                Audit Failed
              </span>
            )}
            <Link
              href="/audits/new"
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 no-underline transition hover:bg-gray-50"
            >
              ↺ Re-run
            </Link>
          </div>
        )}
      </div>

      {audit.status !== "failed" && (
        <div className="mb-6 flex w-fit rounded-lg border border-gray-200 bg-gray-50 p-1">
          <button
            onClick={() => setActiveDevice("mobile")}
            disabled={!mobileAudit}
            className={`flex items-center rounded-md px-4 py-2 text-sm font-medium transition ${activeDevice === "mobile" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"}`}
            title={!mobileAudit ? "No mobile audit run found." : undefined}
          >
            📱 Mobile
          </button>
          <button
            onClick={() => setActiveDevice("desktop")}
            disabled={!desktopAudit}
            className={`flex items-center rounded-md px-4 py-2 text-sm font-medium transition ${activeDevice === "desktop" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"}`}
            title={!desktopAudit ? "No desktop audit run found." : undefined}
          >
            💻 Desktop {!desktopAudit && "(N/A)"}
          </button>
        </div>
      )}

      {audit.status === "failed" ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800">
          This audit failed. No metrics are available. Re-run the audit using
          the button above.
        </div>
      ) : (
        <>
          <div className="mb-6 flex w-fit rounded-lg border border-gray-200 bg-gray-50 p-1">
            <button
              onClick={() => setActiveTab("overview")}
              className={`rounded-md px-4 py-2 text-sm font-medium transition ${activeTab === "overview" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab("official")}
              className={`rounded-md px-4 py-2 text-sm font-medium transition ${activeTab === "official" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
            >
              Official Report
            </button>
          </div>

          <div className="mt-8">
            {activeTab === "overview" && (
              <>
                <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {[
                    { label: "Performance", score: audit.performanceScore },
                    { label: "Accessibility", score: audit.accessibilityScore },
                    {
                      label: "Best Practices",
                      score: audit.bestPracticesScore,
                    },
                    { label: "SEO", score: audit.seoScore },
                  ].map(({ label, score }) => (
                    <div
                      key={label}
                      className="rounded-lg border border-gray-200 bg-white p-5 text-center"
                    >
                      <ScoreBadge score={score} size="lg" />
                      <div className="mt-2 text-xs text-gray-500">{label}</div>
                    </div>
                  ))}
                </div>

                <div className="mb-10">
                  <h2 className="mb-4 text-lg font-semibold text-gray-900">
                    Core Web Vitals
                  </h2>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    {vitals.map(({ key, label, value, desc }) => {
                      const status = vitalStatus(key, value);
                      return (
                        <div
                          key={key}
                          className="rounded-lg border border-gray-200 p-4 text-center"
                          style={{ backgroundColor: vitalBg[status] }}
                        >
                          <div className="mb-1 text-xs text-gray-600">
                            {label}
                          </div>
                          <div
                            className="text-xl font-bold"
                            style={{ color: vitalColors[status] }}
                          >
                            {key === "cls"
                              ? value !== null
                                ? value.toFixed(2)
                                : "N/A"
                              : formatMs(value)}
                          </div>
                          <div className="mt-1 text-[0.7rem] text-gray-500">
                            {desc}
                          </div>
                          {status !== "unknown" && (
                            <div
                              className="mt-1 text-[0.7rem] font-semibold capitalize"
                              style={{ color: vitalColors[status] }}
                            >
                              {status.replace("-", " ")}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {audit.aiSummary && (
                  <div className="mb-10">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600 text-xl">
                        🤖
                      </div>
                      <h2 className="m-0 text-lg font-semibold text-gray-900">
                        AI Engineering Summary
                      </h2>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-white p-6">
                      {renderMarkdown(audit.aiSummary)}
                    </div>
                  </div>
                )}

                {audit.opportunities.length > 0 && (
                  <div className="mb-10">
                    <h2 className="mb-4 text-lg font-semibold text-gray-900">
                      Optimization Opportunities
                    </h2>
                    <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
                      {audit.opportunities.map((opp) => (
                        <div
                          key={opp.id}
                          className="flex items-start justify-between gap-4 p-4"
                        >
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900">
                              {opp.title}
                            </div>
                            <div className="mt-1 text-xs text-gray-600">
                              {opp.description}
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-2">
                            {opp.savingsMs !== undefined &&
                              opp.savingsMs > 0 && (
                                <span className="inline-flex items-center rounded-md bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">
                                  <svg
                                    width="12"
                                    height="12"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    className="mr-1"
                                  >
                                    <circle cx="12" cy="12" r="10" />
                                    <polyline points="12 6 12 12 16 14" />
                                  </svg>
                                  {formatMs(opp.savingsMs)}
                                </span>
                              )}
                            {opp.savingsBytes !== undefined &&
                              opp.savingsBytes > 0 && (
                                <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-800">
                                  <svg
                                    width="12"
                                    height="12"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    className="mr-1"
                                  >
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="17 8 12 3 7 8" />
                                    <line x1="12" y1="3" x2="12" y2="15" />
                                  </svg>
                                  {(opp.savingsBytes / 1024).toFixed(2)} KB
                                </span>
                              )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(() => {
                  const promptsToDisplay =
                    activeUrlReport &&
                    activeUrlReport.hasEnoughData &&
                    activeUrlReport.agentPrompts &&
                    activeUrlReport.agentPrompts.length > 0
                      ? activeUrlReport.agentPrompts
                      : audit.agentPrompts;

                  const isWeeklyPrompts =
                    activeUrlReport &&
                    activeUrlReport.hasEnoughData &&
                    activeUrlReport.agentPrompts &&
                    activeUrlReport.agentPrompts.length > 0;

                  if (!promptsToDisplay || promptsToDisplay.length === 0)
                    return null;

                  return (
                    <div className="mb-10">
                      <h2 className="mb-1 text-lg font-semibold text-gray-900">
                        {isWeeklyPrompts
                          ? "🤖 Comparative Agent Prompts"
                          : "🤖 Agent Investigation Prompts"}
                      </h2>
                      <p className="mb-4 text-xs text-gray-500">
                        {isWeeklyPrompts
                          ? "These prompts are optimized for AI coding agents to investigate the performance regressions."
                          : "Paste these into your AI coding agent (Cursor, Copilot, Claude, etc.) to investigate root causes."}
                      </p>
                      <div className="flex flex-col gap-4">
                        {promptsToDisplay.map((prompt, i) => (
                          <AgentPromptCard
                            key={prompt.opportunityId}
                            prompt={prompt}
                            index={i}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })()}

                <div className="border-t border-gray-200 pt-10">
                  <div className="mb-6">
                    <h2 className="m-0 text-xl font-semibold text-gray-900">
                      📊 Weekly Intelligence
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                      Comparing this audit against previous baselines.
                    </p>
                  </div>

                  {loadingComparison ? (
                    <p className="text-gray-500">
                      Loading comparison details...
                    </p>
                  ) : !activeUrlReport ? (
                    <p className="text-gray-500">
                      No comparison data available.
                    </p>
                  ) : !activeUrlReport.hasEnoughData ? (
                    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
                      <h3 className="m-0 mb-2 text-base font-medium text-gray-700">
                        Insufficient Data
                      </h3>
                      <p className="m-0 text-sm text-gray-500">
                        Need at least two successful audits to analyze changes.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-8">
                      <ScoreComparisonCards
                        metrics={{
                          performanceScore:
                            activeUrlReport.metrics!.performanceScore,
                          accessibilityScore:
                            activeUrlReport.metrics!.accessibilityScore,
                          seoScore: activeUrlReport.metrics!.seoScore,
                          bestPracticesScore:
                            activeUrlReport.metrics!.bestPracticesScore,
                        }}
                      />
                      <div className="grid gap-6 lg:grid-cols-2">
                        <VitalsComparisonTable
                          metrics={{
                            lcp: activeUrlReport.metrics!.lcp,
                            cls: activeUrlReport.metrics!.cls,
                            inpOrTbt: activeUrlReport.metrics!.inpOrTbt,
                            fcp: activeUrlReport.metrics!.fcp,
                            ttfb: activeUrlReport.metrics!.ttfb,
                          }}
                        />
                        <TrendChart
                          historicalRuns={activeUrlReport.historicalRuns}
                        />
                      </div>
                      <AiInsightPanel
                        projectId={audit.projectId}
                        projectUrlId={activeUrlReport.projectUrlId}
                        latestRunId={
                          activeUrlReport.historicalRuns[
                            activeUrlReport.historicalRuns.length - 1
                          ]?.id
                        }
                        previousRunId={
                          activeUrlReport.historicalRuns[
                            activeUrlReport.historicalRuns.length - 2
                          ]?.id
                        }
                        initialAiInsight={activeUrlReport.aiInsight}
                      />
                      <RegressionList
                        regressions={activeUrlReport.regressions}
                        improvements={activeUrlReport.improvements}
                      />
                      <OpportunityDiffList
                        opportunities={{
                          new: activeUrlReport.opportunities.new,
                          resolved: activeUrlReport.opportunities.resolved,
                        }}
                      />
                      {activeUrlReport.recommendations &&
                        activeUrlReport.recommendations.length > 0 && (
                          <DeterministicRecommendationList
                            recommendations={activeUrlReport.recommendations}
                          />
                        )}
                    </div>
                  )}
                </div>
              </>
            )}

            {activeTab === "official" && (
              <div className="h-[calc(100vh-200px)] min-h-200 overflow-hidden rounded-lg border border-gray-200">
                <iframe
                  src={`/api/audits/${audit.id}/html`}
                  className="h-full w-full border-0"
                  title="Lighthouse Official HTML Report"
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AuditDetailPage;
