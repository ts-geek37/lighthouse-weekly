import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Project } from '@prisma/client';
import { ProjectResponse, Environment } from '@/types';

interface PrismaProjectUrl {
  id: string;
  projectId: string;
  url: string;
  pageType: string;
  priority: string;
  createdAt: Date;
}

function mapProjectToResponse(project: Project & { urls: PrismaProjectUrl[] }): ProjectResponse {
  return {
    id: project.id,
    title: project.title,
    description: project.description,
    owner: project.owner,
    priority: project.priority,
    environment: project.environment as Environment,
    reportEmail: (project as typeof project & { reportEmail: string | null }).reportEmail,
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();

    if (typeof body.isActive !== 'boolean') {
      return NextResponse.json(
        { error: 'isActive must be a boolean' },
        { status: 400 }
      );
    }

    const existingProject = await prisma.project.findUnique({
      where: { id },
    });

    if (!existingProject) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const updatedProject = await prisma.project.update({
      where: { id },
      data: { isActive: body.isActive },
      include: { urls: true },
    });

    return NextResponse.json(mapProjectToResponse(updatedProject));
  } catch (error) {
    console.error(`PATCH /api/projects/${id}/status error:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
