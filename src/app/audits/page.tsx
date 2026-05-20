'use client';

import { useEffect, useState } from 'react';
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

export default function AuditHistoryPage() {
  const [runs, setRuns] = useState<AuditRun[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [projectFilter, setProjectFilter] = useState('');

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (projectFilter) params.set('projectId', projectFilter);

    fetch(`/api/audits?${params}`)
      .then(r => r.json())
      .then(data => {
        setRuns(data.data ?? []);
        setPagination(data.pagination ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page, projectFilter]);

  // Get unique projects from current results for filter
  const projects = Array.from(
    new Map(runs.map(r => [r.projectId, r.projectTitle])).entries()
  );

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Audit History</h1>
        <Link href="/audits/new" style={styles.runBtn}>▶ Run Audit</Link>
      </div>

      <div style={styles.toolbar}>
        <select
          style={styles.filterSelect}
          value={projectFilter}
          onChange={e => { setProjectFilter(e.target.value); setPage(1); }}
        >
          <option value="">All projects</option>
          {projects.map(([id, title]) => (
            <option key={id} value={id}>{title}</option>
          ))}
        </select>
        {pagination && (
          <span style={styles.count}>{pagination.total} audit{pagination.total !== 1 ? 's' : ''}</span>
        )}
      </div>

      {loading ? (
        <p style={{ color: '#6b7280' }}>Loading audit history…</p>
      ) : runs.length === 0 ? (
        <div style={styles.empty}>
          <p>No audits yet.</p>
          <Link href="/audits/new" style={styles.runBtn}>Run your first audit</Link>
        </div>
      ) : (
        <>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>URL</th>
                <th style={styles.th}>Project</th>
                <th style={styles.th}>Perf</th>
                <th style={styles.th}>A11y</th>
                <th style={styles.th}>SEO</th>
                <th style={styles.th}>BP</th>
                <th style={styles.th}>Date</th>
                <th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {runs.map(run => (
                <tr key={run.id} style={styles.tr}>
                  <td style={styles.td}>
                    <a href={run.url} target="_blank" rel="noopener noreferrer" style={styles.urlLink}>
                      {run.url.length > 50 ? run.url.slice(0, 50) + '…' : run.url}
                    </a>
                  </td>
                  <td style={styles.td}>
                    <div style={{ fontSize: '0.875rem' }}>{run.projectTitle}</div>
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{run.environment}</div>
                  </td>
                  <td style={{ ...styles.td, textAlign: 'center' }}>
                    {run.status === 'failed'
                      ? <span style={styles.failedBadge}>Failed</span>
                      : <ScoreBadge score={run.performanceScore} size="sm" />}
                  </td>
                  <td style={{ ...styles.td, textAlign: 'center' }}>
                    {run.status !== 'failed' && <ScoreBadge score={run.accessibilityScore} size="sm" />}
                  </td>
                  <td style={{ ...styles.td, textAlign: 'center' }}>
                    {run.status !== 'failed' && <ScoreBadge score={run.seoScore} size="sm" />}
                  </td>
                  <td style={{ ...styles.td, textAlign: 'center' }}>
                    {run.status !== 'failed' && <ScoreBadge score={run.bestPracticesScore} size="sm" />}
                  </td>
                  <td style={{ ...styles.td, fontSize: '0.8rem', color: '#6b7280', whiteSpace: 'nowrap' as const }}>
                    {new Date(run.createdAt).toLocaleDateString()}<br />
                    {new Date(run.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td style={styles.td}>
                    <Link href={`/audits/${run.id}`} style={styles.viewLink}>View →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {pagination && pagination.totalPages > 1 && (
            <div style={styles.pagination}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={styles.pageBtn}
              >
                ← Prev
              </button>
              <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                Page {page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
                style={styles.pageBtn}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: '1200px', margin: '0 auto', padding: '2rem', fontFamily: 'system-ui, sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' },
  title: { margin: 0, fontSize: '1.75rem', fontWeight: 700, color: '#111827' },
  runBtn: { background: '#2563eb', color: '#fff', padding: '0.5rem 1rem', borderRadius: '6px', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500 },
  toolbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  filterSelect: { padding: '0.4rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', background: '#fff' },
  count: { fontSize: '0.875rem', color: '#6b7280' },
  empty: { textAlign: 'center' as const, padding: '3rem', color: '#6b7280' },
  table: { width: '100%', borderCollapse: 'collapse' as const, background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' },
  th: { textAlign: 'left' as const, padding: '0.75rem 1rem', borderBottom: '2px solid #e5e7eb', fontWeight: 600, fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.05em', background: '#f9fafb' },
  tr: { borderBottom: '1px solid #f3f4f6' },
  td: { padding: '0.75rem 1rem', verticalAlign: 'middle' as const },
  pageTypeBadge: { display: 'inline-block', background: '#f3f4f6', color: '#6b7280', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', marginBottom: '0.2rem' },
  urlLink: { fontSize: '0.85rem', color: '#2563eb', textDecoration: 'none' },
  failedBadge: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#fee2e2', color: '#991b1b', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 500 },
  viewLink: { color: '#2563eb', textDecoration: 'none', fontSize: '0.875rem', whiteSpace: 'nowrap' as const },
  pagination: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1.5rem' },
  pageBtn: { padding: '0.4rem 0.9rem', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontSize: '0.875rem' },
};
