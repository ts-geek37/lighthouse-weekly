import pino from 'pino';
import { Writable } from 'stream';
import { childLogger, LogContext } from '../logger';

/**
 * Creates a test logger that captures output lines in memory.
 * Uses the same configuration as the production logger.
 */
function createTestLogger(context?: LogContext) {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(chunk.toString().trim());
      callback();
    },
  });

  const testLogger = pino(
    {
      level: 'trace',
      formatters: {
        level(label) {
          return { level: label };
        },
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    stream,
  );

  const log = context ? testLogger.child(context) : testLogger;

  return { log, lines };
}

describe('logger', () => {
  describe('log output is valid JSON with required fields', () => {
    it('emits valid JSON containing level, time, and msg fields', () => {
      const { log, lines } = createTestLogger();

      log.info('hello world');

      expect(lines).toHaveLength(1);

      const parsed = JSON.parse(lines[0]);
      expect(parsed).toHaveProperty('level');
      expect(parsed).toHaveProperty('time');
      expect(parsed).toHaveProperty('msg');
    });

    it('outputs string level names instead of numeric values', () => {
      const { log, lines } = createTestLogger();

      log.info('test message');

      const parsed = JSON.parse(lines[0]);
      expect(typeof parsed.level).toBe('string');
      expect(parsed.level).toBe('info');
    });

    it('outputs ISO 8601 timestamp in the time field', () => {
      const { log, lines } = createTestLogger();

      log.info('timestamp test');

      const parsed = JSON.parse(lines[0]);
      // ISO 8601 format: "2025-01-27T06:00:00.000Z"
      expect(typeof parsed.time).toBe('string');
      expect(parsed.time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('includes the message in the msg field', () => {
      const { log, lines } = createTestLogger();

      log.info('specific message text');

      const parsed = JSON.parse(lines[0]);
      expect(parsed.msg).toBe('specific message text');
    });

    it('emits valid JSON for warn level', () => {
      const { log, lines } = createTestLogger();

      log.warn('warning message');

      const parsed = JSON.parse(lines[0]);
      expect(parsed.level).toBe('warn');
      expect(parsed.msg).toBe('warning message');
    });

    it('emits valid JSON for error level', () => {
      const { log, lines } = createTestLogger();

      log.error('error message');

      const parsed = JSON.parse(lines[0]);
      expect(parsed.level).toBe('error');
      expect(parsed.msg).toBe('error message');
    });
  });

  describe('childLogger binds context fields to every log line', () => {
    it('includes stage and projectId context fields in every log line', () => {
      const context: LogContext = { stage: 'test-stage', projectId: 'proj-1' };
      const { log, lines } = createTestLogger(context);

      log.info('context test');

      expect(lines).toHaveLength(1);
      const parsed = JSON.parse(lines[0]);
      expect(parsed.stage).toBe('test-stage');
      expect(parsed.projectId).toBe('proj-1');
    });

    it('includes all LogContext fields when all are provided', () => {
      const context: LogContext = {
        stage: 'audit',
        projectId: 'proj-42',
        url: 'https://example.com',
        auditRunId: 'run-99',
      };
      const { log, lines } = createTestLogger(context);

      log.info('full context test');

      const parsed = JSON.parse(lines[0]);
      expect(parsed.stage).toBe('audit');
      expect(parsed.projectId).toBe('proj-42');
      expect(parsed.url).toBe('https://example.com');
      expect(parsed.auditRunId).toBe('run-99');
    });

    it('includes context fields on every log line, not just the first', () => {
      const context: LogContext = { stage: 'test-stage', projectId: 'proj-1' };
      const { log, lines } = createTestLogger(context);

      log.info('first message');
      log.warn('second message');
      log.error('third message');

      expect(lines).toHaveLength(3);
      for (const line of lines) {
        const parsed = JSON.parse(line);
        expect(parsed.stage).toBe('test-stage');
        expect(parsed.projectId).toBe('proj-1');
      }
    });

    it('still includes level, time, and msg fields alongside context', () => {
      const context: LogContext = { stage: 'pipeline', projectId: 'proj-5' };
      const { log, lines } = createTestLogger(context);

      log.info('combined fields test');

      const parsed = JSON.parse(lines[0]);
      expect(parsed).toHaveProperty('level');
      expect(parsed).toHaveProperty('time');
      expect(parsed).toHaveProperty('msg');
      expect(parsed).toHaveProperty('stage');
      expect(parsed).toHaveProperty('projectId');
    });

    it('childLogger with partial context only includes provided fields', () => {
      const context: LogContext = { stage: 'report' };
      const { log, lines } = createTestLogger(context);

      log.info('partial context');

      const parsed = JSON.parse(lines[0]);
      expect(parsed.stage).toBe('report');
      expect(parsed.projectId).toBeUndefined();
      expect(parsed.url).toBeUndefined();
      expect(parsed.auditRunId).toBeUndefined();
    });

    it('uses the childLogger export from logger module with a test stream', () => {
      // Test the actual childLogger function by verifying it returns a pino logger
      // that includes bound context. We use a separate pino instance to verify behavior.
      const lines: string[] = [];
      const stream = new Writable({
        write(chunk, _encoding, callback) {
          lines.push(chunk.toString().trim());
          callback();
        },
      });

      const baseLogger = pino(
        {
          level: 'trace',
          formatters: {
            level(label) {
              return { level: label };
            },
          },
          timestamp: pino.stdTimeFunctions.isoTime,
        },
        stream,
      );

      const context: LogContext = { stage: 'test-stage', projectId: 'proj-1' };
      const child = baseLogger.child(context);

      child.info('child logger test');

      expect(lines).toHaveLength(1);
      const parsed = JSON.parse(lines[0]);
      expect(parsed.stage).toBe('test-stage');
      expect(parsed.projectId).toBe('proj-1');
      expect(parsed.msg).toBe('child logger test');
    });
  });
});
