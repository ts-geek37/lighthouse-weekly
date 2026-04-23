import * as fs from 'fs';
import * as path from 'path';
import type { Logger } from 'pino';
import { WeeklyReport } from '@/types';

/**
 * Writes a WeeklyReport as a JSON file to the specified output directory.
 * File is named report-YYYY-MM-DD.json using the ISO 8601 date of generatedAt.
 * Throws on I/O error (caller should handle with process.exit(1)).
 */
export async function writeJsonReport(
  report: WeeklyReport,
  outputDir: string,
  log: Logger
): Promise<void> {
  const date = report.generatedAt.slice(0, 10); // YYYY-MM-DD
  const filename = `report-${date}.json`;
  const filePath = path.join(outputDir, filename);

  try {
    // Ensure output directory exists
    await fs.promises.mkdir(outputDir, { recursive: true });

    const content = JSON.stringify(report, null, 2);
    await fs.promises.writeFile(filePath, content, 'utf-8');

    log.info({ stage: 'json-writer', filePath }, `JSON report written: ${filename}`);
  } catch (err) {
    log.error({ stage: 'json-writer', filePath, err }, `Failed to write JSON report to ${filePath}`);
    throw err;
  }
}
