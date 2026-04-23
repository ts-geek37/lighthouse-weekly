/**
 * Unit tests for the Lighthouse audit runner.
 * Mocks chrome-launcher and lighthouse to test retry logic and error handling.
 */

import { runAudit } from '../runner';

// Mock chrome-launcher
jest.mock('chrome-launcher', () => ({
  launch: jest.fn(),
}));

// Mock lighthouse
jest.mock('lighthouse', () => jest.fn());

import { launch } from 'chrome-launcher';
import lighthouse from 'lighthouse';

const mockLaunch = launch as jest.MockedFunction<typeof launch>;
const mockLighthouse = lighthouse as jest.MockedFunction<typeof lighthouse>;

function createMockChrome(port = 9222) {
  return {
    port,
    kill: jest.fn().mockResolvedValue(undefined),
    pid: 12345,
    process: {} as any,
  };
}

function createMockLhr() {
  return {
    lighthouseVersion: '12.0.0',
    fetchTime: '2025-01-27T06:00:00.000Z',
    requestedUrl: 'https://example.com',
    finalUrl: 'https://example.com',
    categories: {
      performance: { score: 0.81 },
      accessibility: { score: 0.94 },
      seo: { score: 1.0 },
      'best-practices': { score: 0.92 },
    },
    audits: {},
  };
}

// Minimal mock logger
const mockLog = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  fatal: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn(),
  child: jest.fn().mockReturnThis(),
} as any;

describe('runAudit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('successful audit', () => {
    it('returns success with lhr on first attempt', async () => {
      const mockChrome = createMockChrome();
      const mockLhr = createMockLhr();

      mockLaunch.mockResolvedValue(mockChrome as any);
      mockLighthouse.mockResolvedValue({ lhr: mockLhr, report: '{}', artifacts: {} } as any);

      const result = await runAudit({ url: 'https://example.com' }, mockLog);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.lhr).toEqual(mockLhr);
      }
    });

    it('calls lighthouse with correct options', async () => {
      const mockChrome = createMockChrome(9222);
      mockLaunch.mockResolvedValue(mockChrome as any);
      mockLighthouse.mockResolvedValue({ lhr: createMockLhr(), report: '{}', artifacts: {} } as any);

      await runAudit({ url: 'https://example.com' }, mockLog);

      expect(mockLighthouse).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({
          port: 9222,
          output: 'json',
          onlyCategories: ['performance', 'accessibility', 'seo', 'best-practices'],
          logLevel: 'silent',
        })
      );
    });

    it('always kills Chrome in finally block on success', async () => {
      const mockChrome = createMockChrome();
      mockLaunch.mockResolvedValue(mockChrome as any);
      mockLighthouse.mockResolvedValue({ lhr: createMockLhr(), report: '{}', artifacts: {} } as any);

      await runAudit({ url: 'https://example.com' }, mockLog);

      expect(mockChrome.kill).toHaveBeenCalledTimes(1);
    });

    it('always kills Chrome in finally block on failure', async () => {
      const mockChrome = createMockChrome();
      mockLaunch.mockResolvedValue(mockChrome as any);
      mockLighthouse.mockRejectedValue(new Error('Audit failed'));

      await runAudit({ url: 'https://example.com', maxRetries: 0 }, mockLog);

      expect(mockChrome.kill).toHaveBeenCalledTimes(1);
    });
  });

  describe('retry behavior', () => {
    it('retries on failure and succeeds on second attempt', async () => {
      const mockChrome = createMockChrome();
      mockLaunch.mockResolvedValue(mockChrome as any);

      // First call fails, second succeeds
      mockLighthouse
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValueOnce({ lhr: createMockLhr(), report: '{}', artifacts: {} } as any);

      const result = await runAudit({ url: 'https://example.com', maxRetries: 2 }, mockLog);

      expect(result.success).toBe(true);
      expect(mockLighthouse).toHaveBeenCalledTimes(2);
    });

    it('invokes lighthouse exactly 3 times on persistent failure (1 initial + 2 retries)', async () => {
      const mockChrome = createMockChrome();
      mockLaunch.mockResolvedValue(mockChrome as any);
      mockLighthouse.mockRejectedValue(new Error('Persistent failure'));

      const result = await runAudit({ url: 'https://example.com', maxRetries: 2 }, mockLog);

      expect(result.success).toBe(false);
      expect(mockLighthouse).toHaveBeenCalledTimes(3);
    });

    it('returns failure result after all retries exhausted', async () => {
      const mockChrome = createMockChrome();
      mockLaunch.mockResolvedValue(mockChrome as any);
      mockLighthouse.mockRejectedValue(new Error('Always fails'));

      const result = await runAudit({ url: 'https://example.com', maxRetries: 2 }, mockLog);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Always fails');
      }
    });

    it('logs warn for each retry attempt', async () => {
      const mockChrome = createMockChrome();
      mockLaunch.mockResolvedValue(mockChrome as any);
      mockLighthouse.mockRejectedValue(new Error('Failure'));

      await runAudit({ url: 'https://example.com', maxRetries: 2 }, mockLog);

      // warn is called twice per retry: once for "will retry" and once for "retrying"
      // With 2 retries that's at least 2 warn calls
      expect(mockLog.warn.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('logs error after all retries exhausted', async () => {
      const mockChrome = createMockChrome();
      mockLaunch.mockResolvedValue(mockChrome as any);
      mockLighthouse.mockRejectedValue(new Error('Failure'));

      await runAudit({ url: 'https://example.com', maxRetries: 2 }, mockLog);

      expect(mockLog.error).toHaveBeenCalledTimes(1);
    });

    it('kills Chrome on each attempt (3 kills for 3 attempts)', async () => {
      const mockChrome = createMockChrome();
      mockLaunch.mockResolvedValue(mockChrome as any);
      mockLighthouse.mockRejectedValue(new Error('Failure'));

      await runAudit({ url: 'https://example.com', maxRetries: 2 }, mockLog);

      expect(mockChrome.kill).toHaveBeenCalledTimes(3);
    });
  });

  describe('with maxRetries: 0', () => {
    it('makes exactly 1 attempt and returns failure', async () => {
      const mockChrome = createMockChrome();
      mockLaunch.mockResolvedValue(mockChrome as any);
      mockLighthouse.mockRejectedValue(new Error('Failure'));

      const result = await runAudit({ url: 'https://example.com', maxRetries: 0 }, mockLog);

      expect(result.success).toBe(false);
      expect(mockLighthouse).toHaveBeenCalledTimes(1);
    });
  });
});
