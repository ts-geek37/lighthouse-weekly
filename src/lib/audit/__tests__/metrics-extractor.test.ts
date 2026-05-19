/**
 * Unit tests for the metrics extractor.
 * Tests LHR field mapping, null handling, and opportunity extraction.
 */

import { extractMetrics } from '../metrics-extractor';
import { LighthouseResult } from '@/types';

const mockLog = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  fatal: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn(),
  child: jest.fn().mockReturnThis(),
} as any;

/** Builds a complete mock LHR with all fields present */
function buildFullLhr(overrides: Partial<{
  performanceScore: number;
  accessibilityScore: number;
  seoScore: number;
  bestPracticesScore: number;
  lcp: number;
  cls: number;
  inp: number;
  tbt: number;
  fcp: number;
  speedIndex: number;
  ttfb: number;
}> = {}): LighthouseResult {
  const o = {
    performanceScore: 0.81,
    accessibilityScore: 0.94,
    seoScore: 1.0,
    bestPracticesScore: 0.92,
    lcp: 2500,
    cls: 0.05,
    inp: 200,
    tbt: 150,
    fcp: 1200,
    speedIndex: 3000,
    ttfb: 150,
    ...overrides,
  };

  return {
    lighthouseVersion: '12.0.0',
    fetchTime: '2025-01-27T06:00:00.000Z',
    requestedUrl: 'https://example.com',
    finalUrl: 'https://example.com',
    categories: {
      performance: { score: o.performanceScore },
      accessibility: { score: o.accessibilityScore },
      seo: { score: o.seoScore },
      'best-practices': { score: o.bestPracticesScore },
    },
    audits: {
      'largest-contentful-paint': { id: 'largest-contentful-paint', title: 'LCP', description: '', score: 0.5, numericValue: o.lcp },
      'cumulative-layout-shift': { id: 'cumulative-layout-shift', title: 'CLS', description: '', score: 0.9, numericValue: o.cls },
      'interaction-to-next-paint': { id: 'interaction-to-next-paint', title: 'INP', description: '', score: 0.8, numericValue: o.inp },
      'total-blocking-time': { id: 'total-blocking-time', title: 'TBT', description: '', score: 0.7, numericValue: o.tbt },
      'first-contentful-paint': { id: 'first-contentful-paint', title: 'FCP', description: '', score: 0.8, numericValue: o.fcp },
      'speed-index': { id: 'speed-index', title: 'Speed Index', description: '', score: 0.6, numericValue: o.speedIndex },
      'server-response-time': { id: 'server-response-time', title: 'TTFB', description: '', score: 0.9, numericValue: o.ttfb },
      'unused-javascript': { id: 'unused-javascript', title: 'Remove unused JavaScript', description: 'Reduce unused JS', score: 0.3, details: { type: 'opportunity', overallSavingsMs: 500, overallSavingsBytes: 102400 } },
      'render-blocking-resources': { id: 'render-blocking-resources', title: 'Eliminate render-blocking resources', description: 'Remove render blocking', score: 0.4, details: { type: 'opportunity', overallSavingsMs: 300 } },
      'uses-optimized-images': { id: 'uses-optimized-images', title: 'Efficiently encode images', description: 'Optimize images', score: 0.5, details: { type: 'opportunity', overallSavingsBytes: 204800 } },
      'uses-long-cache-ttl': { id: 'uses-long-cache-ttl', title: 'Serve static assets with efficient cache policy', description: 'Improve caching', score: 0.6, details: { type: 'opportunity' } },
      'unused-css-rules': { id: 'unused-css-rules', title: 'Remove unused CSS', description: 'Reduce unused CSS', score: 0.7, details: { type: 'opportunity', overallSavingsMs: 100, overallSavingsBytes: 51200 } },
    },
  };
}

describe('extractMetrics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('category scores', () => {
    it('scales performance score from 0-1 to 0-100', () => {
      const lhr = buildFullLhr({ performanceScore: 0.81 });
      const metrics = extractMetrics(lhr, mockLog);
      expect(metrics.performanceScore).toBe(81);
    });

    it('scales accessibility score from 0-1 to 0-100', () => {
      const lhr = buildFullLhr({ accessibilityScore: 0.94 });
      const metrics = extractMetrics(lhr, mockLog);
      expect(metrics.accessibilityScore).toBe(94);
    });

    it('scales SEO score from 0-1 to 0-100', () => {
      const lhr = buildFullLhr({ seoScore: 1.0 });
      const metrics = extractMetrics(lhr, mockLog);
      expect(metrics.seoScore).toBe(100);
    });

    it('scales best-practices score from 0-1 to 0-100', () => {
      const lhr = buildFullLhr({ bestPracticesScore: 0.92 });
      const metrics = extractMetrics(lhr, mockLog);
      expect(metrics.bestPracticesScore).toBe(92);
    });

    it('returns null for missing performance score and logs warn', () => {
      const lhr = buildFullLhr();
      lhr.categories.performance = { score: null };
      const metrics = extractMetrics(lhr, mockLog);
      expect(metrics.performanceScore).toBeNull();
      expect(mockLog.warn).toHaveBeenCalledWith(
        expect.objectContaining({ missingField: 'performance' }),
        expect.any(String)
      );
    });
  });

  describe('Core Web Vitals', () => {
    it('extracts LCP numericValue directly', () => {
      const lhr = buildFullLhr({ lcp: 2500 });
      const metrics = extractMetrics(lhr, mockLog);
      expect(metrics.lcp).toBe(2500);
    });

    it('extracts CLS numericValue directly', () => {
      const lhr = buildFullLhr({ cls: 0.05 });
      const metrics = extractMetrics(lhr, mockLog);
      expect(metrics.cls).toBe(0.05);
    });

    it('extracts FCP numericValue directly', () => {
      const lhr = buildFullLhr({ fcp: 1200 });
      const metrics = extractMetrics(lhr, mockLog);
      expect(metrics.fcp).toBe(1200);
    });

    it('extracts Speed Index numericValue directly', () => {
      const lhr = buildFullLhr({ speedIndex: 3000 });
      const metrics = extractMetrics(lhr, mockLog);
      expect(metrics.speedIndex).toBe(3000);
    });

    it('uses INP when present', () => {
      const lhr = buildFullLhr({ inp: 200, tbt: 150 });
      const metrics = extractMetrics(lhr, mockLog);
      expect(metrics.inpOrTbt).toBe(200);
    });

    it('falls back to TBT when INP is absent', () => {
      const lhr = buildFullLhr({ tbt: 150 });
      delete lhr.audits['interaction-to-next-paint'];
      const metrics = extractMetrics(lhr, mockLog);
      expect(metrics.inpOrTbt).toBe(150);
    });

    it('returns null for inpOrTbt when both INP and TBT are absent and logs warn', () => {
      const lhr = buildFullLhr();
      delete lhr.audits['interaction-to-next-paint'];
      delete lhr.audits['total-blocking-time'];
      const metrics = extractMetrics(lhr, mockLog);
      expect(metrics.inpOrTbt).toBeNull();
      expect(mockLog.warn).toHaveBeenCalledWith(
        expect.objectContaining({ missingField: 'inp_or_tbt' }),
        expect.any(String)
      );
    });

    it('returns null for missing LCP and logs warn', () => {
      const lhr = buildFullLhr();
      delete lhr.audits['largest-contentful-paint'];
      const metrics = extractMetrics(lhr, mockLog);
      expect(metrics.lcp).toBeNull();
      expect(mockLog.warn).toHaveBeenCalledWith(
        expect.objectContaining({ missingField: 'largest-contentful-paint' }),
        expect.any(String)
      );
    });
  });

  describe('opportunities', () => {
    it('extracts all 5 opportunity audit IDs', () => {
      const lhr = buildFullLhr();
      const metrics = extractMetrics(lhr, mockLog);
      expect(metrics.opportunities).toHaveLength(5);
      const ids = metrics.opportunities.map((o) => o.id);
      expect(ids).toContain('unused-javascript');
      expect(ids).toContain('render-blocking-resources');
      expect(ids).toContain('uses-optimized-images');
      expect(ids).toContain('uses-long-cache-ttl');
      expect(ids).toContain('unused-css-rules');
    });

    it('includes savingsMs when present', () => {
      const lhr = buildFullLhr();
      const metrics = extractMetrics(lhr, mockLog);
      const unusedJs = metrics.opportunities.find((o) => o.id === 'unused-javascript');
      expect(unusedJs?.savingsMs).toBe(500);
    });

    it('includes savingsBytes when present', () => {
      const lhr = buildFullLhr();
      const metrics = extractMetrics(lhr, mockLog);
      const unusedJs = metrics.opportunities.find((o) => o.id === 'unused-javascript');
      expect(unusedJs?.savingsBytes).toBe(102400);
    });

    it('logs warn for missing opportunity audit and skips it', () => {
      const lhr = buildFullLhr();
      delete lhr.audits['unused-javascript'];
      const metrics = extractMetrics(lhr, mockLog);
      expect(metrics.opportunities).toHaveLength(4);
      expect(mockLog.warn).toHaveBeenCalledWith(
        expect.objectContaining({ missingField: 'unused-javascript' }),
        expect.any(String)
      );
    });

    it('round-trips opportunities through JSON serialization', () => {
      const lhr = buildFullLhr();
      const metrics = extractMetrics(lhr, mockLog);
      const serialized = JSON.stringify(metrics.opportunities);
      const deserialized = JSON.parse(serialized);
      expect(deserialized).toHaveLength(metrics.opportunities.length);
      for (let i = 0; i < metrics.opportunities.length; i++) {
        expect(deserialized[i].id).toBe(metrics.opportunities[i].id);
        expect(deserialized[i].title).toBe(metrics.opportunities[i].title);
        expect(deserialized[i].description).toBe(metrics.opportunities[i].description);
      }
    });
  });

  describe('full LHR with all fields present', () => {
    it('returns all non-null metrics', () => {
      const lhr = buildFullLhr();
      const metrics = extractMetrics(lhr, mockLog);
      expect(metrics.performanceScore).not.toBeNull();
      expect(metrics.accessibilityScore).not.toBeNull();
      expect(metrics.seoScore).not.toBeNull();
      expect(metrics.bestPracticesScore).not.toBeNull();
      expect(metrics.lcp).not.toBeNull();
      expect(metrics.cls).not.toBeNull();
      expect(metrics.inpOrTbt).not.toBeNull();
      expect(metrics.fcp).not.toBeNull();
      expect(metrics.speedIndex).not.toBeNull();
      expect(metrics.opportunities.length).toBeGreaterThan(0);
    });

    it('emits no warn logs when all fields are present', () => {
      const lhr = buildFullLhr();
      extractMetrics(lhr, mockLog);
      expect(mockLog.warn).not.toHaveBeenCalled();
    });
  });
});
