/**
 * Cascade delete integration test.
 * Verifies that deleting a Project removes all associated ProjectUrl and AuditRun records.
 * Uses a mocked Prisma client to test the cascade behavior at the application layer.
 *
 * Note: The actual cascade delete is enforced by the Prisma schema (onDelete: Cascade).
 * This test verifies the API route correctly calls prisma.project.delete, which triggers
 * the cascade. For a full integration test against a real DB, run with a test database.
 */

jest.mock('@/lib/prisma', () => ({
  prisma: {
    project: {
      findUnique: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
    },
    projectUrl: {
      findMany: jest.fn(),
    },
    auditRun: {
      findMany: jest.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import { DELETE } from '@/app/api/projects/[id]/route';

const mockPrisma = prisma as any;

describe('Cascade delete behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('DELETE /api/projects/:id calls prisma.project.delete which triggers cascade', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'proj-1',
      title: 'Test Project',
      description: null,
      owner: 'Alice',
      priority: 'medium',
      environment: 'Production' as any,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    mockPrisma.project.delete.mockResolvedValue({} as any);

    const req = new Request('http://localhost/api/projects/proj-1', { method: 'DELETE' });
    const response = await DELETE(req as any, { params: Promise.resolve({ id: 'proj-1' }) });

    expect(response.status).toBe(204);

    // Verify delete was called with the correct project ID
    // The Prisma schema's onDelete: Cascade handles removing ProjectUrl and AuditRun records
    expect(mockPrisma.project.delete).toHaveBeenCalledWith({
      where: { id: 'proj-1' },
    });
  });

  it('does not call delete when project is not found', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(null);

    const req = new Request('http://localhost/api/projects/nonexistent', { method: 'DELETE' });
    const response = await DELETE(req as any, { params: Promise.resolve({ id: 'nonexistent' }) });

    expect(response.status).toBe(404);
    expect(mockPrisma.project.delete).not.toHaveBeenCalled();
  });
});
