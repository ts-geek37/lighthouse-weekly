'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ProjectResponse } from '@/types';
import { ScoreBadge } from '@/components/ScoreBadge';

interface RecentAudit {
  id: string;
  status: string;
  url: string;
  pageType: string;
  performanceScore: number | null;
  accessibilityScore: number | null;
  seoScore: number | null;
  bestPracticesScore: number | null;
  createdAt: string;
  device: 'mobile' | 'desktop';
}

interface AuditListResponse {
  data?: RecentAudit[];
}

const metaBadgeClass = 'inline-block rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700';

const environmentClass = (environment: string): string =>
  environment === 'Production'
    ? 'bg-emerald-100 text-emerald-800'
    : 'bg-amber-100 text-amber-800';

const statusClass = (isActive: boolean): string =>
  isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800';

const deviceBadgeClass = (device: RecentAudit['device']): string =>
  device === 'desktop'
    ? 'border-blue-200 bg-blue-50 text-blue-800'
    : 'border-rose-200 bg-rose-50 text-rose-800';

const ProjectDetailPage = ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = use(params);
  const [project, setProject] = useState<ProjectResponse | null>(null);
  const [recentAudits, setRecentAudits] = useState<RecentAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const loadProject = async () => {
      try {
        const [projectResponse, auditsResponse] = await Promise.all([
          fetch(`/api/projects/${id}`),
          fetch(`/api/audits?projectId=${id}&limit=10`),
        ]);

        if (projectResponse.status === 404) {
          setNotFound(true);
          return;
        }

        if (!projectResponse.ok) throw new Error('Failed to load project');

        const projectData = await projectResponse.json() as ProjectResponse;
        const auditsData = auditsResponse.ok ? await auditsResponse.json() as AuditListResponse : null;

        setProject(projectData);
        setRecentAudits(auditsData?.data ?? []);
      } finally {
        setLoading(false);
      }
    };

    loadProject().catch(() => setLoading(false));
  }, [id]);

  const toggleStatus = async () => {
    if (!project) return;

    const response = await fetch(`/api/projects/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !project.isActive }),
    });

    if (response.ok) {
      const updated = await response.json() as ProjectResponse;
      setProject(updated);
    }
  };

  const auditsByUrl = useMemo(() => {
    if (!project) return [];

    return project.urls.map(urlEntry => ({
      urlEntry,
      audits: recentAudits.filter(audit => audit.url === urlEntry.url).slice(0, 3),
    }));
  }, [project, recentAudits]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl p-8">
        <p className="text-gray-500">Loading project...</p>
      </div>
    );
  }

  if (notFound || !project) {
    return (
      <div className="mx-auto max-w-6xl p-8">
        <p>Project not found.</p>
        <Link href="/projects" className="text-sm text-gray-500 no-underline hover:text-gray-800">
          ← Back to projects
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-6 sm:p-8">
      <div className="mb-6 flex items-center gap-2 text-sm">
        <Link href="/projects" className="text-gray-500 no-underline hover:text-gray-800">Projects</Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-700">{project.title}</span>
      </div>

      <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="mb-1 text-3xl font-bold text-gray-900">{project.title}</h1>
          {project.description && (
            <p className="mt-1 text-sm text-gray-500">{project.description}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className={metaBadgeClass}>{project.owner}</span>
            <span className={`${metaBadgeClass} ${environmentClass(project.environment)}`}>{project.environment}</span>
            <span className={`${metaBadgeClass} ${statusClass(project.isActive)}`}>{project.isActive ? 'Active' : 'Inactive'}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/audits/new" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white no-underline transition hover:bg-blue-700">
            ▶ Run Audit
          </Link>
          <Link href={`/projects/${id}/edit`} className="rounded-md bg-gray-100 px-4 py-2 text-sm text-gray-700 no-underline transition hover:bg-gray-200">
            Edit
          </Link>
          <button type="button" onClick={toggleStatus} className="rounded-md bg-gray-100 px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-200">
            {project.isActive ? 'Disable' : 'Enable'}
          </button>
        </div>
      </header>

      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Monitored URLs</h2>
        {project.urls.length === 0 ? (
          <p className="text-sm text-gray-500">
            No URLs configured. <Link href={`/projects/${project.id}/edit`} className="text-blue-600">Add some →</Link>
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-[repeat(auto-fill,minmax(320px,1fr))]">
            {auditsByUrl.map(({ urlEntry, audits }) => {
              const latest = audits[0];

              return (
                <article key={urlEntry.id} className="rounded-lg border border-gray-200 bg-white p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="mr-2 inline-block rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-500">{urlEntry.pageType}</span>
                      <a href={urlEntry.url} target="_blank" rel="noopener noreferrer" className="break-all text-sm text-blue-600 no-underline hover:underline">
                        {urlEntry.url}
                      </a>
                    </div>
                    <Link href={`/audits/new?projectUrlId=${urlEntry.id}`} className="shrink-0 rounded bg-blue-50 px-2.5 py-1 text-xs text-blue-600 no-underline transition hover:bg-blue-100">
                      ▶ Run
                    </Link>
                  </div>

                  {latest ? (
                    <div className="mt-2">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="text-xs text-gray-400">
                          Latest: {new Date(latest.createdAt).toLocaleDateString()}
                        </div>
                        <span className={`inline-block rounded border px-1.5 py-0.5 text-[0.65rem] font-medium ${deviceBadgeClass(latest.device)}`}>
                          {latest.device === 'desktop' ? '💻 Desktop' : '📱 Mobile'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {[
                          { label: 'Perf', score: latest.performanceScore },
                          { label: 'A11y', score: latest.accessibilityScore },
                          { label: 'SEO', score: latest.seoScore },
                          { label: 'BP', score: latest.bestPracticesScore },
                        ].map(({ label, score }) => (
                          <div key={label} className="text-center">
                            <ScoreBadge score={score} size="sm" />
                            <div className="mt-0.5 text-[0.65rem] text-gray-400">{label}</div>
                          </div>
                        ))}
                        <Link href={`/audits/${latest.id}`} className="self-center text-xs text-blue-600 no-underline hover:underline">
                          View →
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-gray-400">No audits yet</p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {recentAudits.length > 0 && (
        <section className="mb-10">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="m-0 text-lg font-semibold text-gray-900">Recent Audits</h2>
            <Link href={`/audits?projectId=${project.id}`} className="text-sm text-blue-600 no-underline hover:underline">
              View all →
            </Link>
          </div>
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full min-w-[760px] border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  <th className="px-3 py-2.5">URL</th>
                  <th className="px-3 py-2.5 text-center">Perf</th>
                  <th className="px-3 py-2.5 text-center">A11y</th>
                  <th className="px-3 py-2.5 text-center">SEO</th>
                  <th className="px-3 py-2.5 text-center">BP</th>
                  <th className="px-3 py-2.5">Date</th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {recentAudits.map(run => (
                  <tr key={run.id} className="border-b border-gray-100 last:border-b-0">
                    <td className="px-3 py-2.5 align-middle">
                      <div className="mb-1 flex items-center gap-1.5">
                        <span className="inline-block rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-500">{run.pageType}</span>
                        <span className={`inline-block rounded border px-1.5 py-0.5 text-xs ${deviceBadgeClass(run.device)}`}>
                          {run.device === 'desktop' ? '💻 Desktop' : '📱 Mobile'}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500">
                        {run.url.length > 45 ? `${run.url.slice(0, 45)}...` : run.url}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center align-middle">
                      {run.status === 'failed'
                        ? <span className="text-xs text-red-800">Failed</span>
                        : <ScoreBadge score={run.performanceScore} size="sm" />}
                    </td>
                    <td className="px-3 py-2.5 text-center align-middle">
                      {run.status !== 'failed' && <ScoreBadge score={run.accessibilityScore} size="sm" />}
                    </td>
                    <td className="px-3 py-2.5 text-center align-middle">
                      {run.status !== 'failed' && <ScoreBadge score={run.seoScore} size="sm" />}
                    </td>
                    <td className="px-3 py-2.5 text-center align-middle">
                      {run.status !== 'failed' && <ScoreBadge score={run.bestPracticesScore} size="sm" />}
                    </td>
                    <td className="px-3 py-2.5 align-middle text-sm text-gray-500">
                      {new Date(run.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <Link href={`/audits/${run.id}`} className="text-xs text-blue-600 no-underline hover:underline">
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};

export default ProjectDetailPage;
