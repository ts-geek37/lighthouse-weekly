import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma, Project } from '@prisma/client';
import { validateProjectSubmission } from '@/lib/validation/project';
import { ProjectResponse, Environment } from '@/types';

interface PrismaProjectUrl {
  id: string;
  projectId: string;
  url: string;
  pageType: string;
  priority: string;
  createdAt: Date;
}

const mapProjectToResponse = (project: Project & { urls: PrismaProjectUrl[] }): ProjectResponse => ({
    id: project.id,
    title: project.title,
    description: project.description,
    owner: project.owner,
    priority: project.priority,
    environment: project.environment as Environment,
    reportEmail: project.reportEmail,
    isActive: project.isActive,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    urls: project.urls.map((u) => ({
      id: u.id,
      url: u.url,
      pageType: u.pageType,
      priority: u.priority,
      createdAt: u.createdAt.toISOString(),
    })),
});

export const GET = async () => {
  try {
    const projects = await prisma.project.findMany({
      include: { urls: true },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(projects.map(mapProjectToResponse));
  } catch (error) {
    console.error('GET /api/projects error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
};

export const POST = async (request: NextRequest) => {
  try {
    const body = await request.json();

    const validation = validateProjectSubmission(body);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors },
        { status: 422 }
      );
    }

    const project = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const newProject = await tx.project.create({
        data: {
          title: body.title,
          description: body.description || null,
          owner: body.owner,
          priority: body.priority || 'medium',
          environment: body.environment,
          reportEmail: body.reportEmail || null,
        },
      });

      if (body.urls && body.urls.length > 0) {
        await tx.projectUrl.createMany({
          data: body.urls.map((u: { url: string; pageType: string; priority?: string }) => ({
            projectId: newProject.id,
            url: u.url,
            pageType: u.pageType,
            priority: u.priority || 'medium',
          })),
        });
      }

      return tx.project.findUnique({
        where: { id: newProject.id },
        include: { urls: true },
      });
    });

    if (!project) {
      return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
    }

    return NextResponse.json(mapProjectToResponse(project), { status: 201 });
  } catch (error) {
    console.error('POST /api/projects error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
};
