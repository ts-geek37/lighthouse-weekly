/**
 * Smoke test: verifies the audit script key exists in package.json
 */
import * as fs from 'fs';
import * as path from 'path';

describe('package.json scripts smoke test', () => {
  let packageJson: { scripts?: Record<string, string> };

  beforeAll(() => {
    const pkgPath = path.resolve(process.cwd(), 'package.json');
    packageJson = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  });

  it('has an "audit" script defined', () => {
    expect(packageJson.scripts).toBeDefined();
    expect(packageJson.scripts!['audit']).toBeDefined();
  });

  it('audit script uses ts-node with tsconfig.scripts.json', () => {
    const auditScript = packageJson.scripts!['audit'];
    expect(auditScript).toContain('ts-node');
    expect(auditScript).toContain('tsconfig.scripts.json');
    expect(auditScript).toContain('scripts/run-audits.ts');
  });

  it('has a "test" script defined', () => {
    expect(packageJson.scripts!['test']).toBeDefined();
  });

  it('has a "db:generate" script defined', () => {
    expect(packageJson.scripts!['db:generate']).toBeDefined();
  });
});
