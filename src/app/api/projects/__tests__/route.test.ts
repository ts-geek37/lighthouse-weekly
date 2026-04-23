/**
 * Unit tests for Project CRUD API routes.
 * Mocks Prisma client to test route handlers in isolation.
 */

import { GET, POST } from '../route';
import { GET as GET_ID, PUT, DELETE } from '../[id]/route';
import { PATCH } from '../[id]/status/route';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    project: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    projectUrl: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

import { prisma } from '@/lib/prisma';

// Cast to any to avoid Prisma's complex generic type constraints on mock methods
const mockPrisma = prisma as any;

describe('GET /api/projects', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 200 with array of projects', async () => {
    const mockProjects = [
      {
        id: 'proj-1',
        title: 'Test Project',
        description: 'Test description',
        owner: 'Alice',
        priority: 'high',
        environment: 'Production',
        isActive: true,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        urls: [
          {
            id: 'url-1',
            projectId: 'proj-1',
            url: 'https://example.com',
            pageType: 'homepage',
            priority: 'high',
            createdAt: new Date('2025-01-01'),
          },
        ],
      },
    ];

    mockPrisma.project.findMany.mockResolvedValue(mockProjects as any);

    const req = new Request('http://localhost/api/projects', { method: 'GET' });
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe('proj-1');
    expect(data[0].urls).toHaveLength(1);
  });

  it('returns 500 on database error', async () => {
    mockPrisma.project.findMany.mockRejectedValue(new Error('DB connection failed'));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Internal server error');
  });
});

describe('POST /api/projects', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 201 with created project on valid input', async () => {
    const validBody = {
      title: 'New Project',
      description: 'Description',
      owner: 'Bob',
      priority: 'medium',
      environment: 'Production',
      urls: [{ url: 'https://example.com', pageType: 'homepage', priority: 'high' }],
    };

    const mockCreatedProject = {
      id: 'proj-new',
      title: validBody.title,
      description: validBody.description,
      owner: validBody.owner,
      priority: validBody.priority,
      environment: validBody.environment,
      isActive: true,
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01'),
      urls: [
        {
          id: 'url-new',
          projectId: 'proj-new',
          url: validBody.urls[0].url,
          pageType: validBody.urls[0].pageType,
          priority: validBody.urls[0].priority,
          createdAt: new Date('2025-01-01'),
        },
      ],
    };

    mockPrisma.$transaction.mockImplementation(async (callback: any) => {
      return callback(mockPrisma);
    });

    mockPrisma.project.create.mockResolvedValue({
      id: 'proj-new',
      title: validBody.title,
      description: validBody.description,
      owner: validBody.owner,
      priority: validBody.priority,
      environment: validBody.environment as any,
      isActive: true,
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01'),
    } as any);

    mockPrisma.project.findUnique.mockResolvedValue(mockCreatedProject as any);

    const req = new Request('http://localhost/api/projects', {
      method: 'POST',
      body: JSON.stringify(validBody),
    });

    const response = await POST(req as any);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.id).toBe('proj-new');
    expect(data.title).toBe(validBody.title);
  });

  it('returns 422 with validation errors on invalid URL', async () => {
    const invalidBody = {
      title: 'Project',
      owner: 'Alice',
      environment: 'Production',
      urls: [{ url: 'ftp://invalid.com', pageType: 'homepage' }],
    };

    const req = new Request('http://localhost/api/projects', {
      method: 'POST',
      body: JSON.stringify(invalidBody),
    });

    const response = await POST(req as any);
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.error).toBe('Validation failed');
    expect(data.details).toContain('Invalid URL: ftp://invalid.com');
  });

  it('returns 422 when more than 5 URLs', async () => {
    const invalidBody = {
      title: 'Project',
      owner: 'Alice',
      environment: 'Production',
      urls: [
        { url: 'https://example.com/1', pageType: 'page1' },
        { url: 'https://example.com/2', pageType: 'page2' },
        { url: 'https://example.com/3', pageType: 'page3' },
        { url: 'https://example.com/4', pageType: 'page4' },
        { url: 'https://example.com/5', pageType: 'page5' },
        { url: 'https://example.com/6', pageType: 'page6' },
      ],
    };

    const req = new Request('http://localhost/api/projects', {
      method: 'POST',
      body: JSON.stringify(invalidBody),
    });

    const response = await POST(req as any);
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.error).toBe('Validation failed');
    expect(data.details).toContain('Maximum 5 URLs allowed per project');
  });

  it('returns 422 when title is missing', async () => {
    const invalidBody = {
      owner: 'Alice',
      environment: 'Production',
      urls: [{ url: 'https://example.com', pageType: 'homepage' }],
    };

    const req = new Request('http://localhost/api/projects', {
      method: 'POST',
      body: JSON.stringify(invalidBody),
    });

    const response = await POST(req as any);
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.error).toBe('Validation failed');
    expect(data.details).toContain('title is required');
  });

  it('returns 500 on database error', async () => {
    const validBody = {
      title: 'Project',
      owner: 'Alice',
      environment: 'Production',
      urls: [{ url: 'https://example.com', pageType: 'homepage' }],
    };

    mockPrisma.$transaction.mockRejectedValue(new Error('DB error'));

    const req = new Request('http://localhost/api/projects', {
      method: 'POST',
      body: JSON.stringify(validBody),
    });

    const response = await POST(req as any);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Internal server error');
  });
});

describe('GET /api/projects/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 200 with project when found', async () => {
    const mockProject = {
      id: 'proj-1',
      title: 'Test Project',
      description: 'Test',
      owner: 'Alice',
      priority: 'high',
      environment: 'Production',
      isActive: true,
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01'),
      urls: [],
    };

    mockPrisma.project.findUnique.mockResolvedValue(mockProject as any);

    const req = new Request('http://localhost/api/projects/proj-1', { method: 'GET' });
    const response = await GET_ID(req as any, { params: Promise.resolve({ id: 'proj-1' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe('proj-1');
  });

  it('returns 404 when not found', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(null);

    const req = new Request('http://localhost/api/projects/nonexistent', { method: 'GET' });
    const response = await GET_ID(req as any, { params: Promise.resolve({ id: 'nonexistent' }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Project not found');
  });
});

describe('PUT /api/projects/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 200 with updated project on valid input', async () => {
    const validBody = {
      title: 'Updated Project',
      owner: 'Alice',
      environment: 'Staging',
      urls: [{ url: 'https://updated.com', pageType: 'homepage' }],
    };

    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'proj-1',
      title: 'Old Title',
      description: null,
      owner: 'Alice',
      priority: 'medium',
      environment: 'Production' as any,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    mockPrisma.$transaction.mockImplementation(async (callback: any) => {
      return callback(mockPrisma);
    });

    mockPrisma.project.update.mockResolvedValue({} as any);
    mockPrisma.projectUrl.deleteMany.mockResolvedValue({ count: 0 } as any);
    mockPrisma.projectUrl.createMany.mockResolvedValue({ count: 1 } as any);

    const updatedProject = {
      id: 'proj-1',
      title: validBody.title,
      description: null,
      owner: validBody.owner,
      priority: 'medium',
      environment: validBody.environment,
      isActive: true,
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-02'),
      urls: [
        {
          id: 'url-1',
          projectId: 'proj-1',
          url: validBody.urls[0].url,
          pageType: validBody.urls[0].pageType,
          priority: 'medium',
          createdAt: new Date('2025-01-02'),
        },
      ],
    };

    (mockPrisma.project.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 'proj-1',
      title: 'Old Title',
      description: null,
      owner: 'Alice',
      priority: 'medium',
      environment: 'Production' as any,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any).mockResolvedValueOnce(updatedProject as any);

    const req = new Request('http://localhost/api/projects/proj-1', {
      method: 'PUT',
      body: JSON.stringify(validBody),
    });

    const response = await PUT(req as any, { params: Promise.resolve({ id: 'proj-1' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.title).toBe(validBody.title);
  });

  it('returns 422 on validation failure', async () => {
    const invalidBody = {
      title: 'Project',
      owner: 'Alice',
      environment: 'Production',
      urls: [{ url: 'invalid-url', pageType: 'homepage' }],
    };

    mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1' } as any);

    const req = new Request('http://localhost/api/projects/proj-1', {
      method: 'PUT',
      body: JSON.stringify(invalidBody),
    });

    const response = await PUT(req as any, { params: Promise.resolve({ id: 'proj-1' }) });
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.error).toBe('Validation failed');
  });

  it('returns 404 when not found', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(null);

    const validBody = {
      title: 'Project',
      owner: 'Alice',
      environment: 'Production',
      urls: [],
    };

    const req = new Request('http://localhost/api/projects/nonexistent', {
      method: 'PUT',
      body: JSON.stringify(validBody),
    });

    const response = await PUT(req as any, { params: Promise.resolve({ id: 'nonexistent' }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Project not found');
  });
});

describe('DELETE /api/projects/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 204 on success', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1' } as any);
    mockPrisma.project.delete.mockResolvedValue({} as any);

    const req = new Request('http://localhost/api/projects/proj-1', { method: 'DELETE' });
    const response = await DELETE(req as any, { params: Promise.resolve({ id: 'proj-1' }) });

    expect(response.status).toBe(204);
    expect(response.body).toBeNull();
  });

  it('returns 404 when not found', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(null);

    const req = new Request('http://localhost/api/projects/nonexistent', { method: 'DELETE' });
    const response = await DELETE(req as any, { params: Promise.resolve({ id: 'nonexistent' }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Project not found');
  });
});

describe('PATCH /api/projects/:id/status', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 200 with updated project when isActive is boolean', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1' } as any);

    const updatedProject = {
      id: 'proj-1',
      title: 'Project',
      description: null,
      owner: 'Alice',
      priority: 'medium',
      environment: 'Production',
      isActive: false,
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-02'),
      urls: [],
    };

    mockPrisma.project.update.mockResolvedValue(updatedProject as any);

    const req = new Request('http://localhost/api/projects/proj-1/status', {
      method: 'PATCH',
      body: JSON.stringify({ isActive: false }),
    });

    const response = await PATCH(req as any, { params: Promise.resolve({ id: 'proj-1' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.isActive).toBe(false);
  });

  it('returns 400 when isActive is not a boolean', async () => {
    const req = new Request('http://localhost/api/projects/proj-1/status', {
      method: 'PATCH',
      body: JSON.stringify({ isActive: 'true' }),
    });

    const response = await PATCH(req as any, { params: Promise.resolve({ id: 'proj-1' }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('isActive must be a boolean');
  });

  it('returns 404 when not found', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(null);

    const req = new Request('http://localhost/api/projects/nonexistent/status', {
      method: 'PATCH',
      body: JSON.stringify({ isActive: true }),
    });

    const response = await PATCH(req as any, { params: Promise.resolve({ id: 'nonexistent' }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Project not found');
  });
});
