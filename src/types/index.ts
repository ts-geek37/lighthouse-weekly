// Shared TypeScript type definitions for the Weekly Lighthouse Monitoring System
// Mirrors Prisma's generated types but adds domain-specific shapes

export type Environment = 'Production' | 'Staging';
export type AuditStatus = 'success' | 'failed';

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
    items?: unknown[];
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
    'best-practices': { score: number | null };
  };
  audits: Record<string, LighthouseAudit>;
  runtimeError?: { code: string; message: string };
}

export interface PipelineContext {
  cycleStartedAt: Date;
  auditRunIds: string[];
  failedUrls: Array<{ projectId: string; url: string; error: string }>;
}

export interface Opportunity {
  id: string;
  title: string;
  description: string;
  savingsMs?: number;
  savingsBytes?: number;
}

// Agent investigation prompt — one per top opportunity
export interface AgentPrompt {
  opportunityId: string;
  opportunityTitle: string;
  savingsMs: number | null;
  savingsBytes: number | null;
  prompt: string; // full investigation prompt text, ready to paste into a code agent
}

export interface AiSummaryOutput {
  summary: string;            // human-readable Good/Needs Attention/Recommended Fixes
  agentPrompts: AgentPrompt[]; // investigation prompts for code agents
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

// Agent investigation prompt — one per top opportunity
export interface AgentPrompt {
  opportunityId: string;
  opportunityTitle: string;
  savingsMs: number | null;
  savingsBytes: number | null;
  prompt: string; // full investigation prompt text, ready to paste into a code agent
}

export interface AiSummaryOutput {
  summary: string;       // human-readable Good / Needs Attention / Recommended Fixes
  agentPrompts: AgentPrompt[]; // investigation prompts sorted by estimated savings
}

// API response types

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

// Report types

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
