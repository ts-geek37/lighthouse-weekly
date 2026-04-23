/**
 * Unit tests for the AI summarizer.
 * Mocks groq-sdk to test retry logic, fallback behavior, and summary structure.
 */

import { generateSummary, AiSummaryInput } from '../ai-summarizer';
import { ExtractedMetrics } from '@/types';

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

    it('calls Groq API with temperature: 0', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: buildValidSummary() } }],
      });

      await generateSummary(buildTestInput(), mockLog);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ temperature: 0 })
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
