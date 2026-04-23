// Environment configuration module for the Weekly Lighthouse Monitoring System
// Validates required env vars at startup and returns a typed AppConfig object.
// NEVER includes the actual values of DATABASE_URL or GROQ_API_KEY in error messages or logs.

export interface AppConfig {
  databaseUrl: string;
  groqApiKey: string;
  auditSchedule: string;
  reportOutputDir: string;
  markdownOutputEnabled: boolean;
}

export function loadConfig(): AppConfig {
  const missing: string[] = [];

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) missing.push('DATABASE_URL');

  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) missing.push('GROQ_API_KEY');

  const reportOutputDir = process.env.REPORT_OUTPUT_DIR;
  if (!reportOutputDir) missing.push('REPORT_OUTPUT_DIR');

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const auditSchedule = process.env.AUDIT_SCHEDULE ?? '0 6 * * 1';
  const markdownOutputEnabled = process.env.MARKDOWN_OUTPUT_ENABLED === 'true';

  return {
    databaseUrl: databaseUrl as string,
    groqApiKey: groqApiKey as string,
    auditSchedule,
    reportOutputDir: reportOutputDir as string,
    markdownOutputEnabled,
  };
}
