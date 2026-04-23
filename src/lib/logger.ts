import pino from 'pino';

export interface LogContext {
  stage?: string;
  projectId?: string;
  url?: string;
  auditRunId?: string;
}

export const logger = pino({
  level: 'info',
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function childLogger(context: LogContext): pino.Logger {
  return logger.child(context);
}
