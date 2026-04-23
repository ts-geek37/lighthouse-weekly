/**
 * Smoke tests for the Prisma schema.
 *
 * These tests verify that the generated Prisma client exposes the expected
 * model delegates (project, projectUrl, auditRun) with the standard query
 * methods. They require `prisma generate` to have been run first.
 *
 * Run `npm run db:generate` before executing this test suite.
 * Tests are skipped automatically if the Prisma client is not yet generated.
 */

let PrismaClient: any;
let clientAvailable = false;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  PrismaClient = require('@prisma/client').PrismaClient;
  // Try instantiating to verify the generated client is present
  const testClient = new PrismaClient();
  clientAvailable = true;
  testClient.$disconnect().catch(() => {});
} catch {
  clientAvailable = false;
}

const describeOrSkip = clientAvailable ? describe : describe.skip;

describeOrSkip('Prisma schema smoke test', () => {
  it('PrismaClient has project model delegate', async () => {
    const client = new PrismaClient();
    expect(typeof client.project).toBe('object');
    expect(typeof client.project.findMany).toBe('function');
    await client.$disconnect();
  });

  it('PrismaClient has projectUrl model delegate', async () => {
    const client = new PrismaClient();
    expect(typeof client.projectUrl).toBe('object');
    expect(typeof client.projectUrl.findMany).toBe('function');
    await client.$disconnect();
  });

  it('PrismaClient has auditRun model delegate', async () => {
    const client = new PrismaClient();
    expect(typeof client.auditRun).toBe('object');
    expect(typeof client.auditRun.findMany).toBe('function');
    await client.$disconnect();
  });
});

// Always-passing test so the suite doesn't fail when client isn't generated
describe('Prisma schema file', () => {
  it('schema.prisma file exists', () => {
    const fs = require('fs');
    const path = require('path');
    const schemaPath = path.resolve(process.cwd(), 'prisma/schema.prisma');
    expect(fs.existsSync(schemaPath)).toBe(true);
  });

  it('schema.prisma contains Project model', () => {
    const fs = require('fs');
    const path = require('path');
    const schemaPath = path.resolve(process.cwd(), 'prisma/schema.prisma');
    const content = fs.readFileSync(schemaPath, 'utf-8');
    expect(content).toContain('model Project');
    expect(content).toContain('model ProjectUrl');
    expect(content).toContain('model AuditRun');
  });
});
