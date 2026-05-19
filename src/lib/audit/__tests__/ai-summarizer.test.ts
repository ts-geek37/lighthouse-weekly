/**
 * Unit tests for the AI summarizer.
 * Mocks groq-sdk to test retry logic, fallback behavior, and summary structure.
 */

import { generateSummary, AiSummaryInput, classifyMetric, classifyAllMetrics, detectSituations, resolveCausalRules, getInvestigationSteps, buildSummaryPrompt } from '../ai-summarizer';
import { ExtractedMetrics, Opportunity, RuleEngineOutput } from '@/types';
import fc from 'fast-check';

// Mock groq-sdk
jest.mock('groq-sdk', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  }));
});

import Groq from 'groq-sdk';

// Override setTimeout globally to resolve immediately in tests
beforeAll(() => {
  jest.spyOn(global, 'setTimeout').mockImplementation((fn: any) => {
    fn();
    return 0 as any;
  });
});
afterAll(() => {
  (global.setTimeout as any).mockRestore?.();
});

const mockLog = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  fatal: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn(),
  child: jest.fn().mockReturnThis(),
} as any;

function createMockGroqInstance() {
  const instance = new (Groq as any)();
  return instance.chat.completions.create as jest.MockedFunction<any>;
}

function buildTestInput(): AiSummaryInput {
  const metrics: ExtractedMetrics = {
    performanceScore: 81,
    accessibilityScore: 94,
    seoScore: 100,
    bestPracticesScore: 92,
    lcp: 2500,
    cls: 0.05,
    inpOrTbt: 200,
    fcp: 1200,
    speedIndex: 3000,
    opportunities: [
      { id: 'unused-javascript', title: 'Remove unused JavaScript', description: 'Reduce JS', savingsMs: 500 },
      { id: 'render-blocking-resources', title: 'Eliminate render-blocking resources', description: 'Remove blocking', savingsMs: 300 },
    ],
  };

  return { url: 'https://example.com', pageType: 'homepage', metrics };
}

function buildValidSummary(): string {
  return `## Good
- Strong SEO score of 100/100
- Accessibility score of 94/100 is healthy
- CLS of 0.05 is within recommended threshold

## Needs Attention
- LCP is 2500ms — at the good threshold boundary
- Render-blocking resources adding ~300ms to load time

## Recommended Fixes
- Remove unused JavaScript (~500ms savings)
- Eliminate render-blocking resources (~300ms savings)`;
}

describe('generateSummary', () => {
  let mockCreate: jest.MockedFunction<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreate = createMockGroqInstance();
    (Groq as jest.MockedClass<typeof Groq>).mockImplementation(() => ({
      chat: { completions: { create: mockCreate } },
    }) as any);
  });

  afterEach(() => {
    // nothing to clear
  });

  describe('successful call', () => {
    it('returns success with summary string on first attempt', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: buildValidSummary() } }],
      });

      const result = await generateSummary(buildTestInput(), mockLog);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(typeof result.output.summary).toBe('string');
        expect(result.output.summary.length).toBeGreaterThan(0);
      }
    });

    it('calls Groq API with temperature: 0.2', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: buildValidSummary() } }],
      });

      await generateSummary(buildTestInput(), mockLog);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ temperature: 0.2 })
      );
    });

    it('calls Groq API with correct model', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: buildValidSummary() } }],
      });

      await generateSummary(buildTestInput(), mockLog);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'llama-3.3-70b-versatile' })
      );
    });

    it('generates agent prompts for each opportunity', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: buildValidSummary() } }],
      });

      const result = await generateSummary(buildTestInput(), mockLog);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.agentPrompts).toHaveLength(2);
        expect(result.output.agentPrompts[0].opportunityId).toBe('unused-javascript');
        expect(result.output.agentPrompts[0].prompt).toContain('Investigation');
        expect(result.output.agentPrompts[0].prompt).toContain('root cause');
      }
    });

    it('sorts agent prompts by savings (highest first)', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: buildValidSummary() } }],
      });

      const result = await generateSummary(buildTestInput(), mockLog);

      expect(result.success).toBe(true);
      if (result.success) {
        // unused-javascript has 500ms savings, render-blocking has 300ms — should be first
        expect(result.output.agentPrompts[0].opportunityId).toBe('unused-javascript');
        expect(result.output.agentPrompts[1].opportunityId).toBe('render-blocking-resources');
      }
    });

    it('logs info on successful generation', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: buildValidSummary() } }],
      });

      await generateSummary(buildTestInput(), mockLog);

      expect(mockLog.info).toHaveBeenCalledWith(
        expect.objectContaining({ stage: 'ai-summarizer', url: 'https://example.com' }),
        expect.any(String)
      );
    });
  });

  describe('retry behavior', () => {
    it('retries once after first failure and succeeds', async () => {
      mockCreate
        .mockRejectedValueOnce(new Error('API rate limit'))
        .mockResolvedValueOnce({
          choices: [{ message: { content: buildValidSummary() } }],
        });

      const result = await generateSummary(buildTestInput(), mockLog);

      expect(result.success).toBe(true);
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('makes exactly 2 API calls total (1 initial + 1 retry)', async () => {
      mockCreate
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValueOnce({
          choices: [{ message: { content: buildValidSummary() } }],
        });

      await generateSummary(buildTestInput(), mockLog);

      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('logs warn on first failure before retry', async () => {
      mockCreate
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValueOnce({
          choices: [{ message: { content: buildValidSummary() } }],
        });

      await generateSummary(buildTestInput(), mockLog);

      expect(mockLog.warn).toHaveBeenCalledWith(
        expect.objectContaining({ stage: 'ai-summarizer', url: 'https://example.com' }),
        expect.any(String)
      );
    });
  });

  describe('fallback on persistent failure', () => {
    it('returns fallback when both attempts fail', async () => {
      mockCreate.mockRejectedValue(new Error('Persistent API failure'));

      const result = await generateSummary(buildTestInput(), mockLog);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.fallback).toContain('AI summary generation failed');
        expect(result.fallback).toContain('https://example.com');
      }
    });

    it('makes exactly 2 API calls before returning fallback', async () => {
      mockCreate.mockRejectedValue(new Error('Always fails'));

      await generateSummary(buildTestInput(), mockLog);

      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('logs error after all retries exhausted', async () => {
      mockCreate.mockRejectedValue(new Error('Always fails'));

      await generateSummary(buildTestInput(), mockLog);

      expect(mockLog.error).toHaveBeenCalledWith(
        expect.objectContaining({ stage: 'ai-summarizer', url: 'https://example.com' }),
        expect.any(String)
      );
    });
  });
});

// ─── 10.1 classifyMetric ──────────────────────────────────────────────────────

describe('classifyMetric', () => {
  // LCP thresholds: good=2500, poor=4000
  it('returns CRITICAL when value > poor threshold', () => {
    expect(classifyMetric('lcp', 4001)).toBe('CRITICAL');
  });
  it('returns POOR when good < value <= poor', () => {
    expect(classifyMetric('lcp', 3000)).toBe('POOR');
    expect(classifyMetric('lcp', 4000)).toBe('POOR');
  });
  it('returns AT_RISK when 80–100% of good threshold', () => {
    // 80% of 2500 = 2000, so 2001–2500 is AT_RISK
    expect(classifyMetric('lcp', 2001)).toBe('AT_RISK');
    expect(classifyMetric('lcp', 2500)).toBe('AT_RISK');
  });
  it('returns EXCELLENT when <= 60% of good threshold', () => {
    // 60% of 2500 = 1500
    expect(classifyMetric('lcp', 1500)).toBe('EXCELLENT');
    expect(classifyMetric('lcp', 100)).toBe('EXCELLENT');
  });
  it('returns GOOD for values between 60% and 80% of good threshold', () => {
    // 60% of 2500 = 1500, 80% = 2000
    expect(classifyMetric('lcp', 1800)).toBe('GOOD');
  });
  it('returns GOOD for null input', () => {
    expect(classifyMetric('lcp', null)).toBe('GOOD');
    expect(classifyMetric('cls', null)).toBe('GOOD');
  });
  it('works correctly for CLS (good=0.1, poor=0.25)', () => {
    expect(classifyMetric('cls', 0.3)).toBe('CRITICAL');
    expect(classifyMetric('cls', 0.15)).toBe('POOR');
    expect(classifyMetric('cls', 0.09)).toBe('AT_RISK'); // 90% of 0.1
    expect(classifyMetric('cls', 0.05)).toBe('EXCELLENT'); // 50% of 0.1
  });

  // Property: classifyMetric is total — always returns a valid MetricSituation
  it('property: always returns a valid MetricSituation for any non-negative number', () => {
    const validSituations = ['CRITICAL', 'POOR', 'AT_RISK', 'GOOD', 'EXCELLENT'];
    fc.assert(
      fc.property(
        fc.constantFrom('lcp' as const, 'cls' as const, 'inpOrTbt' as const, 'fcp' as const, 'speedIndex' as const),
        fc.float({ min: 0, max: 10000, noNaN: true }),
        (key, value) => {
          const result = classifyMetric(key, value);
          return validSituations.includes(result);
        }
      )
    );
  });

  // Property: classifyMetric is monotone — higher values never produce a better classification
  it('property: higher values never produce a better classification', () => {
    const order = ['EXCELLENT', 'GOOD', 'AT_RISK', 'POOR', 'CRITICAL'];
    fc.assert(
      fc.property(
        fc.constantFrom('lcp' as const, 'fcp' as const, 'inpOrTbt' as const, 'speedIndex' as const),
        fc.float({ min: 0, max: 5000, noNaN: true }),
        fc.float({ min: 0, max: 5000, noNaN: true }),
        (key, a, b) => {
          const lower = Math.min(a, b);
          const higher = Math.max(a, b);
          const lowerSit = classifyMetric(key, lower);
          const higherSit = classifyMetric(key, higher);
          return order.indexOf(lowerSit) <= order.indexOf(higherSit);
        }
      )
    );
  });
});

// ─── 10.2 + 10.3 detectSituations ────────────────────────────────────────────

describe('detectSituations', () => {
  function baseMetrics(): ExtractedMetrics {
    return {
      performanceScore: 90,
      accessibilityScore: 95,
      seoScore: 100,
      bestPracticesScore: 92,
      lcp: 1000,
      cls: 0.02,
      inpOrTbt: 100,
      fcp: 800,
      speedIndex: 2000,
      opportunities: [],
    };
  }

  it('detects SCORE_BELOW_FLOOR for homepage with score < 85', () => {
    const metrics = { ...baseMetrics(), performanceScore: 72 };
    const result = detectSituations(metrics, 'homepage', []);
    expect(result.some(s => s.tag === 'SCORE_BELOW_FLOOR')).toBe(true);
    expect(result.find(s => s.tag === 'SCORE_BELOW_FLOOR')?.severity).toBe('critical');
  });

  it('does NOT detect SCORE_BELOW_FLOOR when score >= floor', () => {
    const metrics = { ...baseMetrics(), performanceScore: 90 };
    const result = detectSituations(metrics, 'homepage', []);
    expect(result.some(s => s.tag === 'SCORE_BELOW_FLOOR')).toBe(false);
  });

  it('does NOT detect SCORE_BELOW_FLOOR when performanceScore is null', () => {
    const metrics = { ...baseMetrics(), performanceScore: null };
    const result = detectSituations(metrics, 'homepage', []);
    expect(result.some(s => s.tag === 'SCORE_BELOW_FLOOR')).toBe(false);
  });

  it('detects FALSE_GREEN when all critical vitals good but high-impact opportunity exists', () => {
    const opps: Opportunity[] = [{ id: 'unused-javascript', title: 'JS', description: 'desc', savingsMs: 600 }];
    const result = detectSituations(baseMetrics(), 'homepage', opps);
    expect(result.some(s => s.tag === 'FALSE_GREEN')).toBe(true);
  });

  it('does NOT detect FALSE_GREEN when no high-impact opportunities', () => {
    const opps: Opportunity[] = [{ id: 'unused-javascript', title: 'JS', description: 'desc', savingsMs: 100 }];
    const result = detectSituations(baseMetrics(), 'homepage', opps);
    expect(result.some(s => s.tag === 'FALSE_GREEN')).toBe(false);
  });

  it('detects CLS_IMAGE_COMBINED when CLS is POOR and image opp present', () => {
    const metrics = { ...baseMetrics(), cls: 0.2 }; // POOR (> 0.1 good, <= 0.25 poor)
    const opps: Opportunity[] = [{ id: 'uses-optimized-images', title: 'Images', description: 'desc' }];
    const result = detectSituations(metrics, 'homepage', opps);
    expect(result.some(s => s.tag === 'CLS_IMAGE_COMBINED')).toBe(true);
  });

  it('does NOT detect CLS_IMAGE_COMBINED when CLS is GOOD', () => {
    const opps: Opportunity[] = [{ id: 'uses-optimized-images', title: 'Images', description: 'desc' }];
    const result = detectSituations(baseMetrics(), 'homepage', opps);
    expect(result.some(s => s.tag === 'CLS_IMAGE_COMBINED')).toBe(false);
  });

  it('detects TBT_BUNDLE_PROBLEM when inpOrTbt is CRITICAL and unused-js present', () => {
    const metrics = { ...baseMetrics(), inpOrTbt: 600 }; // CRITICAL (> 500 poor)
    const opps: Opportunity[] = [{ id: 'unused-javascript', title: 'JS', description: 'desc' }];
    const result = detectSituations(metrics, 'homepage', opps);
    expect(result.some(s => s.tag === 'TBT_BUNDLE_PROBLEM')).toBe(true);
  });

  it('does NOT detect TBT_BUNDLE_PROBLEM when inpOrTbt is AT_RISK', () => {
    const metrics = { ...baseMetrics(), inpOrTbt: 180 }; // AT_RISK (90% of 200)
    const opps: Opportunity[] = [{ id: 'unused-javascript', title: 'JS', description: 'desc' }];
    const result = detectSituations(metrics, 'homepage', opps);
    expect(result.some(s => s.tag === 'TBT_BUNDLE_PROBLEM')).toBe(false);
  });

  it('detects LCP_RENDER_BLOCKED with critical severity when LCP is POOR', () => {
    const metrics = { ...baseMetrics(), lcp: 3000 }; // POOR
    const opps: Opportunity[] = [{ id: 'render-blocking-resources', title: 'Render', description: 'desc' }];
    const result = detectSituations(metrics, 'homepage', opps);
    const sit = result.find(s => s.tag === 'LCP_RENDER_BLOCKED');
    expect(sit).toBeDefined();
    expect(sit?.severity).toBe('critical');
  });

  it('detects LCP_RENDER_BLOCKED with warning severity when LCP is AT_RISK', () => {
    const metrics = { ...baseMetrics(), lcp: 2200 }; // AT_RISK (88% of 2500)
    const opps: Opportunity[] = [{ id: 'render-blocking-resources', title: 'Render', description: 'desc' }];
    const result = detectSituations(metrics, 'homepage', opps);
    const sit = result.find(s => s.tag === 'LCP_RENDER_BLOCKED');
    expect(sit).toBeDefined();
    expect(sit?.severity).toBe('warning');
  });

  it('does NOT detect LCP_RENDER_BLOCKED when LCP is GOOD', () => {
    const opps: Opportunity[] = [{ id: 'render-blocking-resources', title: 'Render', description: 'desc' }];
    const result = detectSituations(baseMetrics(), 'homepage', opps);
    expect(result.some(s => s.tag === 'LCP_RENDER_BLOCKED')).toBe(false);
  });

  // 10.3 No duplicate tags
  it('never returns duplicate tags', () => {
    const metrics = { ...baseMetrics(), performanceScore: 72, cls: 0.2, inpOrTbt: 600, lcp: 3000 };
    const opps: Opportunity[] = [
      { id: 'uses-optimized-images', title: 'Images', description: 'desc' },
      { id: 'unused-javascript', title: 'JS', description: 'desc', savingsMs: 600 },
      { id: 'render-blocking-resources', title: 'Render', description: 'desc' },
    ];
    const result = detectSituations(metrics, 'homepage', opps);
    const tags = result.map(s => s.tag);
    expect(new Set(tags).size).toBe(tags.length);
  });

  // Property: detectSituations is idempotent
  it('property: calling twice with same inputs returns structurally equal arrays', () => {
    const metrics = baseMetrics();
    const opps: Opportunity[] = [{ id: 'unused-javascript', title: 'JS', description: 'desc', savingsMs: 600 }];
    const r1 = detectSituations(metrics, 'homepage', opps);
    const r2 = detectSituations(metrics, 'homepage', opps);
    expect(r1).toEqual(r2);
  });
});

// ─── 10.4 resolveCausalRules ──────────────────────────────────────────────────

describe('resolveCausalRules', () => {
  function baseMetrics(): ExtractedMetrics {
    return {
      performanceScore: 90, accessibilityScore: 95, seoScore: 100, bestPracticesScore: 92,
      lcp: 2000, cls: 0.05, inpOrTbt: 150, fcp: 1200, speedIndex: 2500, opportunities: [],
    };
  }

  it('returns resolved rule when condition is true', () => {
    const opps: Opportunity[] = [{ id: 'unused-javascript', title: 'JS', description: 'desc' }];
    const result = resolveCausalRules(baseMetrics(), opps);
    expect(result).toHaveLength(1);
    expect(result[0].opportunityId).toBe('unused-javascript');
    expect(typeof result[0].causalExplanation).toBe('string');
    expect(result[0].causalExplanation.length).toBeGreaterThan(0);
  });

  it('returns empty array when condition is false', () => {
    // uses-optimized-images condition: lcp !== null || cls !== null
    // Make both null to force false
    const metrics = { ...baseMetrics(), lcp: null, cls: null };
    const opps: Opportunity[] = [{ id: 'uses-optimized-images', title: 'Images', description: 'desc' }];
    const result = resolveCausalRules(metrics, opps);
    expect(result).toHaveLength(0);
  });

  it('silently skips opportunities with no matching rule', () => {
    const opps: Opportunity[] = [{ id: 'unknown-opportunity-xyz', title: 'Unknown', description: 'desc' }];
    expect(() => resolveCausalRules(baseMetrics(), opps)).not.toThrow();
    expect(resolveCausalRules(baseMetrics(), opps)).toHaveLength(0);
  });

  it('returns at most one entry per opportunity ID', () => {
    const opps: Opportunity[] = [
      { id: 'unused-javascript', title: 'JS', description: 'desc' },
      { id: 'render-blocking-resources', title: 'Render', description: 'desc' },
      { id: 'uses-long-cache-ttl', title: 'Cache', description: 'desc' },
    ];
    const result = resolveCausalRules(baseMetrics(), opps);
    const ids = result.map(r => r.opportunityId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses-long-cache-ttl always resolves (condition always true)', () => {
    const metrics = { ...baseMetrics(), lcp: null, cls: null, inpOrTbt: null, fcp: null, speedIndex: null };
    const opps: Opportunity[] = [{ id: 'uses-long-cache-ttl', title: 'Cache', description: 'desc' }];
    const result = resolveCausalRules(metrics, opps);
    expect(result).toHaveLength(1);
  });
});

// ─── 10.5 buildSummaryPrompt ──────────────────────────────────────────────────

describe('buildSummaryPrompt', () => {
  function baseInput(): AiSummaryInput {
    return {
      url: 'https://example.com',
      pageType: 'homepage',
      metrics: {
        performanceScore: 72,
        accessibilityScore: 95,
        seoScore: 100,
        bestPracticesScore: 92,
        lcp: 3000,
        cls: 0.05,
        inpOrTbt: 150,
        fcp: 1200,
        speedIndex: 2500,
        opportunities: [],
      },
    };
  }

  it('contains SYSTEM CONCLUSIONS block when situations are non-empty', () => {
    const ruleOutput: RuleEngineOutput = {
      classifications: { lcp: 'POOR', cls: 'EXCELLENT', inpOrTbt: 'GOOD', fcp: 'GOOD', speedIndex: 'GOOD' },
      situations: [{ tag: 'SCORE_BELOW_FLOOR', severity: 'critical', message: 'Score is 72, below 85 floor' }],
      resolvedCausalRules: [],
    };
    const prompt = buildSummaryPrompt(baseInput(), ruleOutput);
    expect(prompt.user).toContain('SYSTEM CONCLUSIONS');
    expect(prompt.user).toContain('SCORE_BELOW_FLOOR');
    expect(prompt.user).toContain('[CRITICAL]');
  });

  it('does NOT contain SYSTEM CONCLUSIONS block when situations are empty', () => {
    const ruleOutput: RuleEngineOutput = {
      classifications: { lcp: 'GOOD', cls: 'GOOD', inpOrTbt: 'GOOD', fcp: 'GOOD', speedIndex: 'GOOD' },
      situations: [],
      resolvedCausalRules: [],
    };
    const prompt = buildSummaryPrompt(baseInput(), ruleOutput);
    expect(prompt.user).not.toContain('SYSTEM CONCLUSIONS');
  });

  it('contains METRIC CLASSIFICATIONS block', () => {
    const ruleOutput: RuleEngineOutput = {
      classifications: { lcp: 'POOR', cls: 'EXCELLENT', inpOrTbt: 'GOOD', fcp: 'GOOD', speedIndex: 'GOOD' },
      situations: [],
      resolvedCausalRules: [],
    };
    const prompt = buildSummaryPrompt(baseInput(), ruleOutput);
    expect(prompt.user).toContain('METRIC CLASSIFICATIONS');
  });

  it('contains instruction not to contradict SYSTEM CONCLUSIONS', () => {
    const ruleOutput: RuleEngineOutput = {
      classifications: { lcp: 'GOOD', cls: 'GOOD', inpOrTbt: 'GOOD', fcp: 'GOOD', speedIndex: 'GOOD' },
      situations: [],
      resolvedCausalRules: [],
    };
    const prompt = buildSummaryPrompt(baseInput(), ruleOutput);
    expect(prompt.user).toContain('pre-verified facts');
  });
});

// ─── 10.6 getInvestigationSteps ───────────────────────────────────────────────

describe('getInvestigationSteps', () => {
  function baseMetrics(): ExtractedMetrics {
    return {
      performanceScore: 90, accessibilityScore: 95, seoScore: 100, bestPracticesScore: 92,
      lcp: 2000, cls: 0.05, inpOrTbt: 600, fcp: 1200, speedIndex: 2500, opportunities: [],
    };
  }

  it('unused-javascript returns different text for CRITICAL vs AT_RISK', () => {
    const critical = getInvestigationSteps('unused-javascript', baseMetrics(), 'CRITICAL');
    const atRisk = getInvestigationSteps('unused-javascript', baseMetrics(), 'AT_RISK');
    expect(critical).not.toBe(atRisk);
    expect(critical).toContain('Prioritize this immediately');
    expect(atRisk).toContain('technical debt');
  });

  it('render-blocking-resources returns different text for CRITICAL vs GOOD', () => {
    const critical = getInvestigationSteps('render-blocking-resources', { ...baseMetrics(), lcp: 5000 }, 'CRITICAL');
    const good = getInvestigationSteps('render-blocking-resources', { ...baseMetrics(), lcp: 1000 }, 'GOOD');
    expect(critical).not.toBe(good);
    expect(critical).toContain('CRITICAL');
  });

  it('unknown opportunity ID returns generic fallback', () => {
    const result = getInvestigationSteps('some-unknown-audit', baseMetrics(), 'GOOD');
    expect(result).toContain('some-unknown-audit');
  });
});
