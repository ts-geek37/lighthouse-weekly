import { Opportunity, AgentPrompt } from "@/types";

export type MetricDirection = "lower_is_better" | "higher_is_better";

export interface MetricNormalizationConfig {
  metric: string;
  label: string;
  unit: string;
  direction: MetricDirection;
  poorThreshold: number;
  weight: number; // importance weight (1 to 5)
}

export interface MetricChange {
  metric: string;
  label: string;
  unit: string;
  previous: number | null;
  current: number | null;
  delta: number | null;
  percentage: number | null;
  status: "improved" | "regressed" | "stable" | "critical";
  severity: "low" | "medium" | "high";
}

export interface RegressionItem {
  metric: string;
  label: string;
  message: string;
  severity: "low" | "medium" | "high";
  confidence: "low" | "medium" | "high";
}

export interface ImprovementItem {
  metric: string;
  label: string;
  message: string;
}

export interface DeterministicRecommendation {
  priority: "high" | "medium" | "low";
  issue: string;
  suggestedFixes: string[];
}

export interface UrlComparisonResult {
  projectUrlId: string;
  url: string;
  pageType: string;
  hasEnoughData: boolean;
  latestCreatedAt: Date | null;
  previousCreatedAt: Date | null;
  metrics: {
    performanceScore: MetricChange;
    accessibilityScore: MetricChange;
    seoScore: MetricChange;
    bestPracticesScore: MetricChange;
    lcp: MetricChange;
    cls: MetricChange;
    inpOrTbt: MetricChange;
    fcp: MetricChange;
    ttfb: MetricChange;
  } | null;
  regressions: RegressionItem[];
  improvements: ImprovementItem[];
  opportunities: {
    new: Opportunity[];
    resolved: Opportunity[];
  };
  recommendations: DeterministicRecommendation[];
  agentPrompts: AgentPrompt[];
  aiInsight: string | null;
  historicalRuns: Array<{
    id: string;
    createdAt: Date;
    performanceScore: number | null;
    lcp: number | null;
    cls: number | null;
    inpOrTbt: number | null;
  }>;
}

export interface ProjectComparisonReport {
  projectId: string;
  projectTitle: string;
  urls: UrlComparisonResult[];
}
