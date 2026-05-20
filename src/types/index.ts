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

export interface ThirdPartySummaryItem {
  entityName: string;
  transferSize: number;
  mainThreadTime: number;
  blockingTime: number;
}

export interface BootupTimeItem {
  url: string;
  total: number;
  scripting: number;
  scriptParseCompile: number;
}

export interface MainthreadWorkBreakdownItem {
  group: string;
  groupLabel: string;
  duration: number;
}

export interface DiagnosticsItem {
  numRequests?: number;
  numScripts?: number;
  numStylesheets?: number;
  numFonts?: number;
  numTasks?: number;
  rtt?: number;
  throughput?: number;
  maxRtt?: number;
  maxServerLatency?: number;
  totalByteWeight?: number;
  totalTaskTime?: number;
}

export interface NetworkRequestItem {
  url: string;
  protocol: string;
  startTime: number;
  endTime: number;
  transferSize: number;
  resourceSize: number;
  statusCode: number;
  mimeType: string;
  resourceType: string;
}

export interface LongTaskItem {
  url?: string;
  duration: number;
  startTime: number;
}

export interface DuplicatedJavascriptItem {
  source: string;
  wastedBytes: number;
  url: string;
}

export interface LegacyJavascriptItem {
  url: string;
  wastedBytes: number;
  signals: string[];
}

export interface RenderBlockingResourceItem {
  url: string;
  wastedMs: number;
  totalBytes: number;
}

export interface LcpElementItem {
  nodeLabel: string;
  path?: string;
  snippet?: string;
}

export interface LayoutShiftElementItem {
  nodeLabel: string;
  snippet?: string;
  score: number;
}

export interface ScreenshotThumbnailItem {
  data: string;
  timing: number;
}

export interface AdvancedDiagnostics {
  thirdPartySummary: ThirdPartySummaryItem[];
  bootupTime: BootupTimeItem[];
  mainthreadWorkBreakdown: MainthreadWorkBreakdownItem[];
  diagnostics: DiagnosticsItem | null;
  networkRequests: NetworkRequestItem[];
  longTasks: LongTaskItem[];
  duplicatedJavascript: DuplicatedJavascriptItem[];
  legacyJavascript: LegacyJavascriptItem[];
  renderBlockingResources: RenderBlockingResourceItem[];
  criticalRequestChains: Record<string, unknown> | null;
  lcpElement: LcpElementItem | null;
  layoutShiftElements: LayoutShiftElementItem[];
  screenshotThumbnails: ScreenshotThumbnailItem[];
  finalScreenshot: string | null;
  domSize: number | null;
  unusedJavascript: { url: string; wastedBytes: number; totalBytes: number }[];
  unusedCssRules: { url: string; wastedBytes: number; totalBytes: number }[];
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
  ttfb: number | null;
  opportunities: Opportunity[];
  advancedDiagnostics?: AdvancedDiagnostics;
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
  reportEmail: string | null;
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
    ttfb: number | null;
  };
  opportunities: Opportunity[];
  aiSummary: string | null;
  device: 'mobile' | 'desktop';
}

export interface ProjectReport {
  projectId: string;
  projectTitle: string;
  owner: string;
  environment: Environment;
  reportEmail: string | null;
  urls: UrlReport[];
}

export interface WeeklyReport {
  generatedAt: string;
  cycleStartedAt: string;
  projects: ProjectReport[];
}
