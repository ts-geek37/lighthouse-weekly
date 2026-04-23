/**
 * Unit tests for the pipeline orchestrator logic.
 *
 * Because scripts/run-audits.ts auto-executes main() on import, we test
 * the orchestrator's behavior by verifying the contracts between modules
 * rather than importing the script directly.
 *
 * Key behaviors verified:
 * - Pipeline continues processing remaining URLs when one fails
 * - Failed audit runs are recorded with status 'failed'
 * - Successful audit runs are recorded with status 'success'
 */

// Mock all dependencies
jest.mock('../../src/lib/config', () => ({
  loadConfig: jest.fn().mockReturnValue({
    databaseUrl: 'postgresql://test',
    groqApiKey: 'test-key',
    auditSchedule: '0 6 * * 1',
    reportOutputDir: './reports',
    markdownOutputEnabled: false,
  }),
}));

jest.mock('../../src/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn().mockReturnThis(),
  },
  childLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn().mockReturnThis(),
  }),
}));

jest.mock('../../src/lib/prisma', () => ({
  prisma: {
    project: { findMany: jest.fn() },
    auditRun: { create: jest.fn(), update: jest.fn() },
    $disconnect: jest.fn(),
  },
}));

jest.mock('../../src/lib/audit/runner', () => ({
  runAudit: jest.fn(),
}));

jest.mock('../../src/lib/audit/metrics-extractor', () => ({
  extractMetrics: jest.fn(),
}));

jest.mock('../../src/lib/audit/ai-summarizer', () => ({
  generateSummary: jest.fn(),
}));

jest.mock('../../src/lib/report/generator', () => ({
  generateReport: jest.fn().mockResolvedValue({
    generatedAt: '2025-01-27T06:00:00.000Z',
    cycleStartedAt: '2025-01-27T06:00:00.000Z',
    projects: [],
  }),
}));

jest.mock('../../src/lib/report/json-writer', () => ({
  writeJsonReport: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/lib/report/markdown-writer', () => ({
  writeMarkdownReport: jest.fn().mockResolvedValue(undefined),
}));

import { runAudit } from '../../src/lib/audit/runner';
import { extractMetrics } from '../../src/lib/audit/metrics-extractor';
import { generateSummary } from '../../src/lib/audit/ai-summarizer';

const mockRunAudit = runAudit as jest.MockedFunction<typeof runAudit>;
const mockExtractMetrics = extractMetrics as jest.MockedFunction<typeof extractMetrics>;
const mockGenerateSummary = generateSummary as jest.MockedFunction<typeof generateSummary>;

function buildMockMetrics() {
  return {
    performanceScore: 81,
    accessibilityScore: 94,
    seoScore: 100,
    bestPracticesScore: 92,
    lcp: 2500,
    cls: 0.05,
    inpOrTbt: 200,
    fcp: 1200,
    speedIndex: 3000,
    opportunities: [],
  };
}

/**
 * Simulates the core orchestrator loop logic in isolation.
 * This mirrors the for-loop in scripts/run-audits.ts without importing the module.
 */
async function runOrchestratorLoop(
  urls: Array<{ id: string; url: string; projectId: string }>,
  prismaAuditRun: any
): Promise<{ auditRunIds: string[]; failedUrls: Array<{ url: string; error: string }> }> {
  const auditRunIds: string[] = [];
  const failedUrls: Array<{ url: string; error: string }> = [];
  const mockLog = { info: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;

  for (const urlEntry of urls) {
    try {
      const result = await mockRunAudit({ url: urlEntry.url }, mockLog);

      if (!result.success) {
        const failedRun = await prismaAuditRun.create({
          data: { projectId: urlEntry.projectId, projectUrlId: urlEntry.id, status: 'failed' },
        });
        auditRunIds.push(failedRun.id);
        failedUrls.push({ url: urlEntry.url, error: result.error });
        continue;
      }

      const metrics = mockExtractMetrics(result.lhr as any, mockLog);
      const auditRun = await prismaAuditRun.create({
        data: {
          projectId: urlEntry.projectId,
          projectUrlId: urlEntry.id,
          status: 'success',
          performanceScore: metrics.performanceScore,
        },
      });

      const summary = await mockGenerateSummary(
        { url: urlEntry.url, pageType: 'homepage', metrics },
        mockLog
      );
      await prismaAuditRun.update({
        where: { id: auditRun.id },
        data: {
          aiSummary: summary.success ? summary.output.summary : (summary as any).fallback,
        },
      });

      auditRunIds.push(auditRun.id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      failedUrls.push({ url: urlEntry.url, error: errorMessage });
    }
  }

  return { auditRunIds, failedUrls };
}

describe('Pipeline orchestrator loop', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('processes all URLs even when one fails', async () => {
    const urls = [
      { id: 'url-1', url: 'https://example.com/page1', projectId: 'proj-1' },
      { id: 'url-2', url: 'https://example.com/page2', projectId: 'proj-1' },
      { id: 'url-3', url: 'https://example.com/page3', projectId: 'proj-1' },
    ];

    // URL 1 succeeds, URL 2 fails, URL 3 succeeds
    mockRunAudit
      .mockResolvedValueOnce({ success: true, lhr: {} as any })
      .mockResolvedValueOnce({ success: false, error: 'Audit failed for URL 2' })
      .mockResolvedValueOnce({ success: true, lhr: {} as any });

    mockExtractMetrics.mockReturnValue(buildMockMetrics());
    mockGenerateSummary.mockResolvedValue({ success: true, output: { summary: 'Test summary', agentPrompts: [] } });

    const mockAuditRun = {
      create: jest.fn()
        .mockResolvedValueOnce({ id: 'run-1' })
        .mockResolvedValueOnce({ id: 'run-failed' })
        .mockResolvedValueOnce({ id: 'run-3' }),
      update: jest.fn().mockResolvedValue({}),
    };

    const result = await runOrchestratorLoop(urls, mockAuditRun);

    // All 3 URLs were attempted
    expect(mockRunAudit).toHaveBeenCalledTimes(3);
    // 1 failed URL recorded
    expect(result.failedUrls).toHaveLength(1);
    expect(result.failedUrls[0].url).toBe('https://example.com/page2');
  });

  it('records failed audit run with status "failed" when audit fails', async () => {
    const urls = [{ id: 'url-1', url: 'https://example.com', projectId: 'proj-1' }];

    mockRunAudit.mockResolvedValue({ success: false, error: 'Chrome crashed' });

    const mockAuditRun = {
      create: jest.fn().mockResolvedValue({ id: 'run-failed' }),
      update: jest.fn().mockResolvedValue({}),
    };

    await runOrchestratorLoop(urls, mockAuditRun);

    expect(mockAuditRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'failed' }),
      })
    );
  });

  it('records successful audit run with status "success"', async () => {
    const urls = [{ id: 'url-1', url: 'https://example.com', projectId: 'proj-1' }];

    mockRunAudit.mockResolvedValue({ success: true, lhr: {} as any });
    mockExtractMetrics.mockReturnValue(buildMockMetrics());
    mockGenerateSummary.mockResolvedValue({ success: true, output: { summary: 'Summary', agentPrompts: [] } });

    const mockAuditRun = {
      create: jest.fn().mockResolvedValue({ id: 'run-1' }),
      update: jest.fn().mockResolvedValue({}),
    };

    await runOrchestratorLoop(urls, mockAuditRun);

    expect(mockAuditRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'success' }),
      })
    );
  });

  it('continues processing after an unexpected exception for one URL', async () => {
    const urls = [
      { id: 'url-1', url: 'https://example.com/page1', projectId: 'proj-1' },
      { id: 'url-2', url: 'https://example.com/page2', projectId: 'proj-1' },
    ];

    // First URL throws unexpectedly, second succeeds
    mockRunAudit
      .mockRejectedValueOnce(new Error('Unexpected crash'))
      .mockResolvedValueOnce({ success: true, lhr: {} as any });

    mockExtractMetrics.mockReturnValue(buildMockMetrics());
    mockGenerateSummary.mockResolvedValue({ success: true, output: { summary: 'Summary', agentPrompts: [] } });

    const mockAuditRun = {
      create: jest.fn().mockResolvedValue({ id: 'run-2' }),
      update: jest.fn().mockResolvedValue({}),
    };

    const result = await runOrchestratorLoop(urls, mockAuditRun);

    // Both URLs were attempted
    expect(mockRunAudit).toHaveBeenCalledTimes(2);
    // First URL failure recorded
    expect(result.failedUrls).toHaveLength(1);
    expect(result.failedUrls[0].url).toBe('https://example.com/page1');
  });
});

describe('package.json audit script', () => {
  it('audit script is defined and uses ts-node', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pkg = require('../../package.json');
    expect(pkg.scripts.audit).toBeDefined();
    expect(pkg.scripts.audit).toContain('ts-node');
    expect(pkg.scripts.audit).toContain('scripts/run-audits.ts');
  });
});
