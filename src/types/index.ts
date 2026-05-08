export type Environment = "Production" | "Staging";
export type AuditStatus = "success" | "failed";

export interface LighthouseAuditItem {
  url?: string;
  totalBytes?: number;
  wastedBytes?: number;
  wastedMs?: number;
  cacheLifetimeMs?: number;
  [key: string]: unknown;
}

export interface LighthouseAudit {
  id: string;
  title: string;
  description: string;
  score: number | null;
  numericValue?: number;
  displayValue?: string;
  details?: {
    type: string;
    overallSavingsMs?: number;
    overallSavingsBytes?: number;
    items?: LighthouseAuditItem[];
  };
}

export interface LighthouseResult {
  lighthouseVersion: string;
  fetchTime: string;
  requestedUrl: string;
  finalUrl: string;
  categories: {
    performance: { score: number | null };
    accessibility: { score: number | null };
    seo: { score: number | null };
    "best-practices": { score: number | null };
  };
  audits: Record<string, LighthouseAudit>;
  runtimeError?: { code: string; message: string };
}

export interface PipelineContext {
  cycleStartedAt: Date;
  auditRunIds: string[];
  failedUrls: Array<{ projectId: string; url: string; error: string }>;
}

export interface OpportunityItem {
  url: string;
  totalBytes?: number;
  wastedBytes?: number;
  wastedMs?: number;
  cacheLifetimeMs?: number;
}

export interface Opportunity {
  id: string;
  title: string;
  description: string;
  savingsMs?: number;
  savingsBytes?: number;
  /** Top offending resources from Lighthouse details.items (max 3) */
  items?: OpportunityItem[];
}

export interface AgentPrompt {
  opportunityId: string;
  opportunityTitle: string;
  rank: number; // 1-based, ordered by descending estimated impact
  savingsMs: number | null;
  savingsBytes: number | null;
  prompt: string;
}

export interface AiSummaryOutput {
  summary: string;
  agentPrompts: AgentPrompt[];
}

export interface ExtractedMetrics {
  performanceScore: number | null;
  accessibilityScore: number | null;
  seoScore: number | null;
  bestPracticesScore: number | null;
  lcp: number | null;
  cls: number | null;
  inpOrTbt: number | null;
  fcp: number | null;
  speedIndex: number | null;
  opportunities: Opportunity[];
}

export type MetricSituation =
  | "CRITICAL"
  | "POOR"
  | "AT_RISK"
  | "GOOD"
  | "EXCELLENT";

export type MetricClassification = Record<
  "lcp" | "cls" | "inpOrTbt" | "fcp" | "speedIndex",
  MetricSituation
>;

export interface PageTypeRule {
  criticalVitals: ("lcp" | "cls" | "inpOrTbt" | "fcp" | "speedIndex")[];
  primaryConcern: string;
  scoreFloor: number;
}

export interface CausalRule {
  affectsVitals: ("lcp" | "cls" | "inpOrTbt" | "fcp" | "speedIndex")[];
  condition: (metrics: ExtractedMetrics) => boolean;
  causalExplanation: (metrics: ExtractedMetrics) => string;
}

export interface ResolvedCausalRule {
  opportunityId: string;
  affectsVitals: ("lcp" | "cls" | "inpOrTbt" | "fcp" | "speedIndex")[];
  causalExplanation: string;
}

export interface DetectedSituation {
  tag: string;
  severity: "critical" | "warning" | "info";
  message: string;
}

export interface RuleEngineOutput {
  classifications: MetricClassification;
  situations: DetectedSituation[];
  resolvedCausalRules: ResolvedCausalRule[];
}

export type InvestigationStepFn = (
  metrics: ExtractedMetrics,
  situation: MetricSituation,
) => string;

export interface ApiError {
  error: string;
  details?: string[];
}

export interface ProjectUrlResponse {
  id: string;
  url: string;
  pageType: string;
  priority: string;
  createdAt: string;
}

export interface ProjectResponse {
  id: string;
  title: string;
  description: string | null;
  owner: string;
  priority: string;
  environment: Environment;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  urls: ProjectUrlResponse[];
}

export interface UrlReport {
  url: string;
  pageType: string;
  status: AuditStatus;
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
}

export interface ProjectReport {
  projectId: string;
  projectTitle: string;
  owner: string;
  environment: Environment;
  urls: UrlReport[];
}

export interface WeeklyReport {
  generatedAt: string;
  cycleStartedAt: string;
  projects: ProjectReport[];
}
