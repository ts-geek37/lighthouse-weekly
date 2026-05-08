'use client';

import { use, useEffect, useState } from 'react';
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
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [project, setProject] = useState<ProjectResponse | null>(null);
  const [recentAudits, setRecentAudits] = useState<RecentAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${id}`).then(r => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.json();
      }),
      fetch(`/api/audits?projectId=${id}&limit=10`).then(r => r.json()),
    ])
      .then(([projectData, auditsData]) => {
        if (projectData) setProject(projectData);
        setRecentAudits(auditsData?.data ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  async function toggleStatus() {
    if (!project) return;
    const res = await fetch(`/api/projects/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !project.isActive }),
    });
    if (res.ok) {
      const updated = await res.json();
      setProject(updated);
    }
  }

  if (loading) return <div style={styles.container}><p>Loading project…</p></div>;
  if (notFound || !project) return (
    <div style={styles.container}>
      <p>Project not found.</p>
      <Link href="/projects" style={styles.back}>← Back to projects</Link>
    </div>
  );

  // Group recent audits by URL
  const auditsByUrl = project.urls.map(urlEntry => ({
    urlEntry,
    audits: recentAudits.filter(a => a.url === urlEntry.url).slice(0, 3),
  }));

  return (
    <div style={styles.container}>
      {/* Breadcrumb */}
      <div style={styles.breadcrumb}>
        <Link href="/projects" style={styles.back}>Projects</Link>
        <span style={styles.sep}>/</span>
        <span style={{ color: '#374151' }}>{project.title}</span>
      </div>

      {/* Header */}
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.title}>{project.title}</h1>
          {project.description && (
            <p style={{ margin: '0.25rem 0 0', color: '#6b7280', fontSize: '0.9rem' }}>{project.description}</p>
          )}
          <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={styles.metaBadge}>{project.owner}</span>
            <span style={{
              ...styles.metaBadge,
              background: project.environment === 'Production' ? '#d1fae5' : '#fef3c7',
              color: project.environment === 'Production' ? '#065f46' : '#92400e',
            }}>
              {project.environment}
            </span>
            <span style={{
              ...styles.metaBadge,
              background: project.isActive ? '#d1fae5' : '#fee2e2',
              color: project.isActive ? '#065f46' : '#991b1b',
            }}>
              {project.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link href="/audits/new" style={styles.runBtn}>▶ Run Audit</Link>
          <Link href={`/projects/${id}/edit`} style={styles.editBtn}>Edit</Link>
          <button onClick={toggleStatus} style={styles.toggleBtn}>
            {project.isActive ? 'Disable' : 'Enable'}
          </button>
        </div>
      </div>

      {/* Monitored URLs */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Monitored URLs</h2>
        {project.urls.length === 0 ? (
          <p style={{ color: '#6b7280' }}>No URLs configured. <Link href={`/projects/${project.id}/edit`}>Add some →</Link></p>
        ) : (
          <div style={styles.urlsGrid}>
            {auditsByUrl.map(({ urlEntry, audits }) => {
              const latest = audits[0];
              return (
                <div key={urlEntry.id} style={styles.urlCard}>
                  <div style={styles.urlCardHeader}>
                    <div>
                      <span style={styles.pageTypeBadge}>{urlEntry.pageType}</span>
                      <a href={urlEntry.url} target="_blank" rel="noopener noreferrer" style={styles.urlLink}>
                        {urlEntry.url}
                      </a>
                    </div>
                    <Link
                      href={`/audits/new?projectUrlId=${urlEntry.id}`}
                      style={styles.runSmallBtn}
                    >
                      ▶ Run
                    </Link>
                  </div>

                  {latest ? (
                    <div style={styles.latestScores}>
                      <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.5rem' }}>
                        Latest: {new Date(latest.createdAt).toLocaleDateString()}
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {[
                          { label: 'Perf', score: latest.performanceScore },
                          { label: 'A11y', score: latest.accessibilityScore },
                          { label: 'SEO', score: latest.seoScore },
                          { label: 'BP', score: latest.bestPracticesScore },
                        ].map(({ label, score }) => (
                          <div key={label} style={{ textAlign: 'center' as const }}>
                            <ScoreBadge score={score} size="sm" />
                            <div style={{ fontSize: '0.65rem', color: '#9ca3af', marginTop: '0.15rem' }}>{label}</div>
                          </div>
                        ))}
                        <Link href={`/audits/${latest.id}`} style={styles.viewLink}>View →</Link>
                      </div>
                    </div>
                  ) : (
                    <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: '#9ca3af' }}>No audits yet</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent audit history */}
      {recentAudits.length > 0 && (
        <div style={styles.section}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h2 style={{ ...styles.sectionTitle, margin: 0 }}>Recent Audits</h2>
            <Link href={`/audits?projectId=${project.id}`} style={{ fontSize: '0.875rem', color: '#2563eb', textDecoration: 'none' }}>
              View all →
            </Link>
          </div>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>URL</th>
                <th style={styles.th}>Perf</th>
                <th style={styles.th}>A11y</th>
                <th style={styles.th}>SEO</th>
                <th style={styles.th}>BP</th>
                <th style={styles.th}>Date</th>
                <th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {recentAudits.map(run => (
                <tr key={run.id} style={styles.tr}>
                  <td style={styles.td}>
                    <span style={styles.pageTypeBadge}>{run.pageType}</span>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                      {run.url.length > 45 ? run.url.slice(0, 45) + '…' : run.url}
                    </div>
                  </td>
                  <td style={{ ...styles.td, textAlign: 'center' as const }}>
                    {run.status === 'failed'
                      ? <span style={{ fontSize: '0.75rem', color: '#991b1b' }}>Failed</span>
                      : <ScoreBadge score={run.performanceScore} size="sm" />}
                  </td>
                  <td style={{ ...styles.td, textAlign: 'center' as const }}>
                    {run.status !== 'failed' && <ScoreBadge score={run.accessibilityScore} size="sm" />}
                  </td>
                  <td style={{ ...styles.td, textAlign: 'center' as const }}>
                    {run.status !== 'failed' && <ScoreBadge score={run.seoScore} size="sm" />}
                  </td>
                  <td style={{ ...styles.td, textAlign: 'center' as const }}>
                    {run.status !== 'failed' && <ScoreBadge score={run.bestPracticesScore} size="sm" />}
                  </td>
                  <td style={{ ...styles.td, fontSize: '0.8rem', color: '#6b7280' }}>
                    {new Date(run.createdAt).toLocaleDateString()}
                  </td>
                  <td style={styles.td}>
                    <Link href={`/audits/${run.id}`} style={styles.viewLink}>View →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: '1100px', margin: '0 auto', padding: '2rem', fontFamily: 'system-ui, sans-serif' },
  breadcrumb: { display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1.5rem', fontSize: '0.875rem' },
  back: { color: '#6b7280', textDecoration: 'none' },
  sep: { color: '#d1d5db' },
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', gap: '1rem' },
  title: { margin: '0 0 0.25rem', fontSize: '1.75rem' },
  metaBadge: { display: 'inline-block', background: '#f3f4f6', color: '#374151', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 500 },
  runBtn: { background: '#2563eb', color: '#fff', padding: '0.5rem 1rem', borderRadius: '6px', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500 },
  editBtn: { background: '#f3f4f6', color: '#374151', padding: '0.5rem 1rem', borderRadius: '6px', textDecoration: 'none', fontSize: '0.875rem' },
  toggleBtn: { background: '#f3f4f6', color: '#374151', padding: '0.5rem 1rem', borderRadius: '6px', border: 'none', fontSize: '0.875rem', cursor: 'pointer' },
  section: { marginBottom: '2.5rem' },
  sectionTitle: { margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: 600, color: '#111827' },
  urlsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' },
  urlCard: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1rem' },
  urlCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', gap: '0.5rem' },
  pageTypeBadge: { display: 'inline-block', background: '#e5e7eb', color: '#6b7280', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', marginRight: '0.4rem' },
  urlLink: { fontSize: '0.8rem', color: '#2563eb', textDecoration: 'none', wordBreak: 'break-all' as const },
  runSmallBtn: { background: '#eff6ff', color: '#2563eb', padding: '0.25rem 0.6rem', borderRadius: '4px', textDecoration: 'none', fontSize: '0.75rem', whiteSpace: 'nowrap' as const, flexShrink: 0 },
  latestScores: { marginTop: '0.5rem' },
  viewLink: { color: '#2563eb', textDecoration: 'none', fontSize: '0.8rem', alignSelf: 'center' as const },
  table: { width: '100%', borderCollapse: 'collapse' as const, background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' },
  th: { textAlign: 'left' as const, padding: '0.6rem 0.75rem', borderBottom: '2px solid #e5e7eb', fontWeight: 600, fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.05em', background: '#f9fafb' },
  tr: { borderBottom: '1px solid #f3f4f6' },
  td: { padding: '0.6rem 0.75rem', verticalAlign: 'middle' as const },
};
