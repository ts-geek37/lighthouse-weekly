/**
 * Smoke test: verifies .env.example contains all required variable names.
 */
import * as fs from 'fs';
import * as path from 'path';

describe('.env.example smoke test', () => {
  let envExampleContent: string;

  beforeAll(() => {
    const envPath = path.resolve(process.cwd(), '.env.example');
    envExampleContent = fs.readFileSync(envPath, 'utf-8');
  });

  const requiredVars = [
    'DATABASE_URL',
    'GROQ_API_KEY',
    'REPORT_OUTPUT_DIR',
    'AUDIT_SCHEDULE',
    'MARKDOWN_OUTPUT_ENABLED',
  ];

  for (const varName of requiredVars) {
    it(`contains ${varName}`, () => {
      expect(envExampleContent).toContain(varName);
    });
  }
});
