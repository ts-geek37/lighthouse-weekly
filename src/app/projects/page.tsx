'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ProjectResponse } from '@/types';

const badgeClass = (tone: 'production' | 'staging' | 'active' | 'inactive'): string => {
  const classes = {
    production: 'bg-emerald-100 text-emerald-800',
    staging: 'bg-amber-100 text-amber-800',
    active: 'bg-emerald-100 text-emerald-800',
    inactive: 'bg-red-100 text-red-800',
  };

  return `inline-block rounded-full px-2.5 py-1 text-xs font-medium ${classes[tone]}`;
};

const actionClass = 'inline-block rounded border border-gray-200 bg-gray-100 px-2.5 py-1 text-xs text-gray-700 no-underline transition hover:bg-gray-200';

const ProjectsPage = () => {
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const response = await fetch('/api/projects');
        if (!response.ok) throw new Error('Failed to load projects');
        const data = await response.json() as ProjectResponse[];
        setProjects(data);
      } catch {
        setError('Failed to load projects');
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, []);

  const toggleStatus = async (id: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/projects/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });

      if (response.ok) {
        const updated = await response.json() as ProjectResponse;
        setProjects(previous => previous.map(project => (project.id === id ? updated : project)));
      }
    } catch {
      window.alert('Failed to update project status');
    }
  };

  const deleteProject = async (id: string) => {
    if (!window.confirm('Delete this project and all its audit data?')) return;

    try {
      const response = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (response.status === 204) {
        setProjects(previous => previous.filter(project => project.id !== id));
      }
    } catch {
      window.alert('Failed to delete project');
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl p-8">
        <p className="text-gray-500">Loading projects...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl p-8">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-6 sm:p-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="m-0 text-3xl font-bold text-gray-900">Lighthouse Monitoring</h1>
        <Link href="/projects/new" className="w-fit rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white no-underline transition hover:bg-blue-700">
          + Add Project
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white px-6 py-12 text-center text-gray-500">
          <p>No projects yet.</p>
          <Link href="/projects/new" className="mt-3 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white no-underline transition hover:bg-blue-700">
            Add your first project
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full min-w-[960px] border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Environment</th>
                <th className="px-4 py-3">URLs</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.map(project => (
                <tr key={project.id} className="border-b border-gray-100 last:border-b-0">
                  <td className="px-4 py-3 align-top text-sm">
                    <Link href={`/projects/${project.id}`} className="font-semibold text-blue-600 no-underline hover:underline">
                      {project.title}
                    </Link>
                    {project.description && (
                      <div className="mt-1 text-sm text-gray-500">{project.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top text-sm text-gray-700">
                    {project.owner}
                    {project.reportEmail && (
                      <div className="mt-1 text-sm text-gray-500">✉️ {project.reportEmail}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top text-sm">
                    <span className={badgeClass(project.environment === 'Production' ? 'production' : 'staging')}>
                      {project.environment}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top text-sm">
                    <ul className="m-0 list-disc space-y-1 pl-4">
                      {project.urls.map(urlEntry => (
                        <li key={urlEntry.id} className="text-sm">
                          <span className="text-gray-500">[{urlEntry.pageType}]</span>{' '}
                          <a href={urlEntry.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            {urlEntry.url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-4 py-3 align-top text-sm">
                    <span className={badgeClass(project.isActive ? 'active' : 'inactive')}>
                      {project.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top text-sm">
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/projects/${project.id}`} className={actionClass}>View</Link>
                      <Link href={`/projects/${project.id}/edit`} className={actionClass}>Edit</Link>
                      <button
                        type="button"
                        onClick={() => toggleStatus(project.id, project.isActive)}
                        className={actionClass}
                      >
                        {project.isActive ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteProject(project.id)}
                        className="inline-block rounded border border-red-300 bg-red-100 px-2.5 py-1 text-xs text-red-800 transition hover:bg-red-200"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ProjectsPage;
