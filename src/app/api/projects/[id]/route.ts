import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateProjectSubmission } from '@/lib/validation/project';
import { ProjectResponse, Environment } from '@/types';

interface PrismaProject {
  id: string;
  title: string;
  description: string | null;
  owner: string;
  priority: string;
  environment: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  urls: PrismaProjectUrl[];
}

interface PrismaProjectUrl {
  id: string;
  projectId: string;
  url: string;
  pageType: string;
  priority: string;
  createdAt: Date;
}

function mapProjectToResponse(project: PrismaProject): ProjectResponse {
  return {
    id: project.id,
    title: project.title,
    description: project.description,
    owner: project.owner,
    priority: project.priority,
    environment: project.environment as Environment,
    isActive: project.isActive,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    urls: project.urls.map((u: PrismaProjectUrl) => ({
      id: u.id,
      url: u.url,
      pageType: u.pageType,
      priority: u.priority,
      createdAt: u.createdAt.toISOString(),
    })),
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const project = await prisma.project.findUnique({
      where: { id },
      include: { urls: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json(mapProjectToResponse(project));
  } catch (error) {
    console.error(`GET /api/projects/${id} error:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();

    const validation = validateProjectSubmission(body);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors },
        { status: 422 }
      );
    }

    const existingProject = await prisma.project.findUnique({
      where: { id },
    });

    if (!existingProject) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const updatedProject = await prisma.$transaction(async (tx: any) => {
      await tx.project.update({
        where: { id },
        data: {
          title: body.title,
          description: body.description || null,
          owner: body.owner,
          priority: body.priority || 'medium',
          environment: body.environment,
        },
      });

      await tx.projectUrl.deleteMany({
        where: { projectId: id },
      });

      if (body.urls && body.urls.length > 0) {
        await tx.projectUrl.createMany({
          data: body.urls.map((u: { url: string; pageType: string; priority?: string }) => ({
            projectId: id,
            url: u.url,
            pageType: u.pageType,
            priority: u.priority || 'medium',
          })),
        });
      }

      return tx.project.findUnique({
        where: { id },
        include: { urls: true },
      });
    });

    if (!updatedProject) {
      return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
    }

    return NextResponse.json(mapProjectToResponse(updatedProject));
  } catch (error) {
    console.error(`PUT /api/projects/${id} error:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const existingProject = await prisma.project.findUnique({
      where: { id },
    });

    if (!existingProject) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    await prisma.project.delete({
      where: { id },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error(`DELETE /api/projects/${id} error:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
