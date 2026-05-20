'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ScoreBadge } from '@/components/ScoreBadge';

interface AuditRun {
  id: string;
  status: string;
  url: string;
  pageType: string;
  projectId: string;
  projectTitle: string;
  environment: string;
  performanceScore: number | null;
  accessibilityScore: number | null;
  seoScore: number | null;
  bestPracticesScore: number | null;
  createdAt: string;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface AuditHistoryResponse {
  data?: AuditRun[];
  pagination?: Pagination;
}

const tableHeadClass = 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500';
const tableCellClass = 'px-4 py-3 align-middle';

const AuditHistoryPage = () => {
  const [runs, setRuns] = useState<AuditRun[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [projectFilter, setProjectFilter] = useState('');

  useEffect(() => {
    const loadAudits = async () => {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (projectFilter) params.set('projectId', projectFilter);

      try {
        const response = await fetch(`/api/audits?${params}`);
        if (!response.ok) throw new Error('Failed to load audit history');
        const data = await response.json() as AuditHistoryResponse;
        setRuns(data.data ?? []);
        setPagination(data.pagination ?? null);
      } finally {
        setLoading(false);
      }
    };

    loadAudits().catch(() => setLoading(false));
  }, [page, projectFilter]);

  const projects = useMemo(
    () => Array.from(new Map(runs.map(run => [run.projectId, run.projectTitle])).entries()),
    [runs],
  );

  const handleProjectFilterChange = (value: string) => {
    setProjectFilter(value);
    setPage(1);
  };

  return (
    <div className="mx-auto max-w-6xl p-6 sm:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="m-0 text-3xl font-bold text-gray-900">Audit History</h1>
        <Link href="/audits/new" className="w-fit rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white no-underline transition hover:bg-blue-700">
          ▶ Run Audit
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <select
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 outline-none"
          value={projectFilter}
          onChange={event => handleProjectFilterChange(event.target.value)}
        >
          <option value="">All projects</option>
          {projects.map(([id, title]) => (
            <option key={id} value={id}>{title}</option>
          ))}
        </select>
        {pagination && (
          <span className="text-sm text-gray-500">{pagination.total} audit{pagination.total !== 1 ? 's' : ''}</span>
        )}
      </div>

      {loading ? (
        <p className="text-gray-500">Loading audit history...</p>
      ) : runs.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white px-6 py-12 text-center text-gray-500">
          <p>No audits yet.</p>
          <Link href="/audits/new" className="mt-3 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white no-underline transition hover:bg-blue-700">
            Run your first audit
          </Link>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full min-w-[860px] border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-200 bg-gray-50">
                  <th className={tableHeadClass}>URL</th>
                  <th className={tableHeadClass}>Project</th>
                  <th className={`${tableHeadClass} text-center`}>Perf</th>
                  <th className={`${tableHeadClass} text-center`}>A11y</th>
                  <th className={`${tableHeadClass} text-center`}>SEO</th>
                  <th className={`${tableHeadClass} text-center`}>BP</th>
                  <th className={tableHeadClass}>Date</th>
                  <th className={tableHeadClass}></th>
                </tr>
              </thead>
              <tbody>
                {runs.map(run => (
                  <tr key={run.id} className="border-b border-gray-100 last:border-b-0">
                    <td className={tableCellClass}>
                      <a href={run.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 no-underline hover:underline">
                        {run.url.length > 50 ? `${run.url.slice(0, 50)}...` : run.url}
                      </a>
                    </td>
                    <td className={tableCellClass}>
                      <div className="text-sm text-gray-800">{run.projectTitle}</div>
                      <div className="text-xs text-gray-400">{run.environment}</div>
                    </td>
                    <td className={`${tableCellClass} text-center`}>
                      {run.status === 'failed'
                        ? <span className="inline-flex items-center justify-center rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-800">Failed</span>
                        : <ScoreBadge score={run.performanceScore} size="sm" />}
                    </td>
                    <td className={`${tableCellClass} text-center`}>
                      {run.status !== 'failed' && <ScoreBadge score={run.accessibilityScore} size="sm" />}
                    </td>
                    <td className={`${tableCellClass} text-center`}>
                      {run.status !== 'failed' && <ScoreBadge score={run.seoScore} size="sm" />}
                    </td>
                    <td className={`${tableCellClass} text-center`}>
                      {run.status !== 'failed' && <ScoreBadge score={run.bestPracticesScore} size="sm" />}
                    </td>
                    <td className={`${tableCellClass} whitespace-nowrap text-sm text-gray-500`}>
                      {new Date(run.createdAt).toLocaleDateString()}<br />
                      {new Date(run.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className={tableCellClass}>
                      <Link href={`/audits/${run.id}`} className="whitespace-nowrap text-sm text-blue-600 no-underline hover:underline">
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => setPage(current => Math.max(1, current - 1))}
                disabled={page === 1}
                className="rounded-md border border-gray-300 bg-white px-3.5 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                ← Prev
              </button>
              <span className="text-sm text-gray-500">Page {page} of {pagination.totalPages}</span>
              <button
                type="button"
                onClick={() => setPage(current => Math.min(pagination.totalPages, current + 1))}
                disabled={page === pagination.totalPages}
                className="rounded-md border border-gray-300 bg-white px-3.5 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AuditHistoryPage;
