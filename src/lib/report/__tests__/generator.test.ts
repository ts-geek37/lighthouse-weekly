/**
 * Unit tests for the report generator.
 * Mocks Prisma to test grouping, filtering, and failed run handling.
 */

import { generateReport } from '../generator';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    auditRun: {
      findMany: jest.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';

const mockPrisma = prisma as any;

const mockLog = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  fatal: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn(),
  child: jest.fn().mockReturnThis(),
} as any;

describe('generateReport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('groups audit runs by project', async () => {
    const cycleStartedAt = new Date('2025-01-27T06:00:00.000Z');

    mockPrisma.auditRun.findMany.mockResolvedValue([
      {
        id: 'run-1',
        projectId: 'proj-1',
        projectUrlId: 'url-1',
        status: 'success',
        performanceScore: 81,
        accessibilityScore: 94,
        seoScore: 100,
        bestPracticesScore: 92,
        lcp: 2500,
        cls: 0.05,
        inpOrTbt: 200,
        fcp: 1200,
        speedIndex: 3000,
        opportunitiesJson: [],
        aiSummary: 'Summary 1',
        createdAt: new Date('2025-01-27T06:10:00.000Z'),
        project: { id: 'proj-1', title: 'Project A', owner: 'Alice', environment: 'Production' as any },
        projectUrl: { id: 'url-1', url: 'https://a.com', pageType: 'homepage' },
      },
      {
        id: 'run-2',
        projectId: 'proj-2',
        projectUrlId: 'url-2',
        status: 'success',
        performanceScore: 75,
        accessibilityScore: 90,
        seoScore: 95,
        bestPracticesScore: 88,
        lcp: 3000,
        cls: 0.1,
        inpOrTbt: 250,
        fcp: 1500,
        speedIndex: 3500,
        opportunitiesJson: [],
        aiSummary: 'Summary 2',
        createdAt: new Date('2025-01-27T06:15:00.000Z'),
        project: { id: 'proj-2', title: 'Project B', owner: 'Bob', environment: 'Staging' as any },
        projectUrl: { id: 'url-2', url: 'https://b.com', pageType: 'login' },
      },
    ] as any);

    const report = await generateReport(['run-1', 'run-2'], cycleStartedAt, mockLog);

    expect(report.projects).toHaveLength(2);
    expect(report.projects[0].projectId).toBe('proj-1');
    expect(report.projects[1].projectId).toBe('proj-2');
  });

  it('includes failed runs with status "failed" and null metrics', async () => {
    const cycleStartedAt = new Date('2025-01-27T06:00:00.000Z');

    mockPrisma.auditRun.findMany.mockResolvedValue([
      {
        id: 'run-failed',
        projectId: 'proj-1',
        projectUrlId: 'url-1',
        status: 'failed',
        performanceScore: null,
        accessibilityScore: null,
        seoScore: null,
        bestPracticesScore: null,
        lcp: null,
        cls: null,
        inpOrTbt: null,
        fcp: null,
        speedIndex: null,
        opportunitiesJson: null,
        aiSummary: null,
        createdAt: new Date('2025-01-27T06:10:00.000Z'),
        project: { id: 'proj-1', title: 'Project A', owner: 'Alice', environment: 'Production' as any },
        projectUrl: { id: 'url-1', url: 'https://a.com', pageType: 'homepage' },
      },
    ] as any);

    const report = await generateReport(['run-failed'], cycleStartedAt, mockLog);

    expect(report.projects).toHaveLength(1);
    expect(report.projects[0].urls).toHaveLength(1);
    expect(report.projects[0].urls[0].status).toBe('failed');
    expect(report.projects[0].urls[0].performanceScore).toBeNull();
  });

  it('filters to only records with createdAt >= cycleStartedAt', async () => {
    const cycleStartedAt = new Date('2025-01-27T06:00:00.000Z');

    mockPrisma.auditRun.findMany.mockResolvedValue([
      {
        id: 'run-1',
        projectId: 'proj-1',
        projectUrlId: 'url-1',
        status: 'success',
        performanceScore: 81,
        accessibilityScore: 94,
        seoScore: 100,
        bestPracticesScore: 92,
        lcp: 2500,
        cls: 0.05,
        inpOrTbt: 200,
        fcp: 1200,
        speedIndex: 3000,
        opportunitiesJson: [],
        aiSummary: 'Summary',
        createdAt: new Date('2025-01-27T06:10:00.000Z'),
        project: { id: 'proj-1', title: 'Project A', owner: 'Alice', environment: 'Production' as any },
        projectUrl: { id: 'url-1', url: 'https://a.com', pageType: 'homepage' },
      },
    ] as any);

    await generateReport(['run-1'], cycleStartedAt, mockLog);

    expect(mockPrisma.auditRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: { gte: cycleStartedAt },
        }),
      })
    );
  });

  it('includes all required fields for each URL report', async () => {
    const cycleStartedAt = new Date('2025-01-27T06:00:00.000Z');

    mockPrisma.auditRun.findMany.mockResolvedValue([
      {
        id: 'run-1',
        projectId: 'proj-1',
        projectUrlId: 'url-1',
        status: 'success',
        performanceScore: 81,
        accessibilityScore: 94,
        seoScore: 100,
        bestPracticesScore: 92,
        lcp: 2500,
        cls: 0.05,
        inpOrTbt: 200,
        fcp: 1200,
        speedIndex: 3000,
        opportunitiesJson: [{ id: 'unused-js', title: 'Remove unused JS', description: 'Reduce JS' }],
        aiSummary: 'Summary text',
        createdAt: new Date('2025-01-27T06:10:00.000Z'),
        project: { id: 'proj-1', title: 'Project A', owner: 'Alice', environment: 'Production' as any },
        projectUrl: { id: 'url-1', url: 'https://a.com', pageType: 'homepage' },
      },
    ] as any);

    const report = await generateReport(['run-1'], cycleStartedAt, mockLog);

    const urlReport = report.projects[0].urls[0];
    expect(urlReport).toHaveProperty('url');
    expect(urlReport).toHaveProperty('pageType');
    expect(urlReport).toHaveProperty('status');
    expect(urlReport).toHaveProperty('performanceScore');
    expect(urlReport).toHaveProperty('accessibilityScore');
    expect(urlReport).toHaveProperty('seoScore');
    expect(urlReport).toHaveProperty('bestPracticesScore');
    expect(urlReport).toHaveProperty('coreWebVitals');
    expect(urlReport.coreWebVitals).toHaveProperty('lcp');
    expect(urlReport.coreWebVitals).toHaveProperty('cls');
    expect(urlReport.coreWebVitals).toHaveProperty('inpOrTbt');
    expect(urlReport.coreWebVitals).toHaveProperty('fcp');
    expect(urlReport.coreWebVitals).toHaveProperty('speedIndex');
    expect(urlReport).toHaveProperty('opportunities');
    expect(urlReport).toHaveProperty('aiSummary');
  });

  it('sets generatedAt to current ISO timestamp', async () => {
    const cycleStartedAt = new Date('2025-01-27T06:00:00.000Z');

    mockPrisma.auditRun.findMany.mockResolvedValue([]);

    const report = await generateReport([], cycleStartedAt, mockLog);

    expect(typeof report.generatedAt).toBe('string');
    expect(report.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('sets cycleStartedAt to the provided date as ISO string', async () => {
    const cycleStartedAt = new Date('2025-01-27T06:00:00.000Z');

    mockPrisma.auditRun.findMany.mockResolvedValue([]);

    const report = await generateReport([], cycleStartedAt, mockLog);

    expect(report.cycleStartedAt).toBe('2025-01-27T06:00:00.000Z');
  });
});
