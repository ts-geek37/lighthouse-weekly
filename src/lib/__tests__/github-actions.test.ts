/**
 * Smoke test: verifies the GitHub Actions workflow YAML has the correct
 * schedule trigger and concurrency group configuration.
 */
import * as fs from 'fs';
import * as path from 'path';

describe('GitHub Actions workflow smoke test', () => {
  let workflowContent: string;

  beforeAll(() => {
    const workflowPath = path.resolve(process.cwd(), '.github/workflows/weekly-audit.yml');
    workflowContent = fs.readFileSync(workflowPath, 'utf-8');
  });

  it('has a schedule trigger with cron expression', () => {
    expect(workflowContent).toContain('schedule:');
    expect(workflowContent).toContain('cron:');
  });

  it('has a workflow_dispatch trigger for manual runs', () => {
    expect(workflowContent).toContain('workflow_dispatch:');
  });

  it('has a concurrency group defined', () => {
    expect(workflowContent).toContain('concurrency:');
    expect(workflowContent).toContain('group: weekly-lighthouse-audit');
  });

  it('has cancel-in-progress set to false', () => {
    expect(workflowContent).toContain('cancel-in-progress: false');
  });

  it('uses npm run audit command', () => {
    expect(workflowContent).toContain('npm run audit');
  });

  it('uploads reports as artifact', () => {
    expect(workflowContent).toContain('upload-artifact');
    expect(workflowContent).toContain('reports/');
  });
});
