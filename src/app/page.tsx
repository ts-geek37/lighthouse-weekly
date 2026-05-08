'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ScoreBadge } from '@/components/ScoreBadge';

interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  totalAudits: number;
  recentAudits: Array<{
    id: string;
    url: string;
    pageType: string;
    projectTitle: string;
    performanceScore: number | null;
    accessibilityScore: number | null;
    seoScore: number | null;
    bestPracticesScore: number | null;
    status: string;
    createdAt: string;
  }>;
  lowScoreUrls: Array<{
    id: string;
    url: string;
    pageType: string;
    projectTitle: string;
    performanceScore: number | null;
    createdAt: string;
  }>;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/projects').then(r => r.json()),
      fetch('/api/audits?limit=5').then(r => r.json()),
      fetch('/api/audits?limit=100').then(r => r.json()),
    ])
      .then(([projects, recentData, allData]) => {
        const allAudits = allData?.data ?? [];
        const lowScore = allAudits
          .filter((a: any) => a.status === 'success' && a.performanceScore !== null && a.performanceScore < 50)
          .slice(0, 5);

        setStats({
          totalProjects: projects.length,
          activeProjects: projects.filter((p: any) => p.isActive).length,
          totalAudits: allData?.pagination?.total ?? 0,
          recentAudits: recentData?.data ?? [],
          lowScoreUrls: lowScore,
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={styles.container}>
      <p style={{ color: '#6b7280' }}>Loading dashboard…</p>
    </div>
  );

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Lighthouse Monitor</h1>
          <p style={styles.subtitle}>Weekly performance audits for your projects</p>
        </div>
        <Link href="/audits/new" style={styles.runBtn}>▶ Run Audit</Link>
      </div>

      {/* Stats row */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{stats?.totalProjects ?? 0}</div>
          <div style={styles.statLabel}>Total Projects</div>
          <Link href="/projects" style={styles.statLink}>Manage →</Link>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statValue, color: '#065f46' }}>{stats?.activeProjects ?? 0}</div>
          <div style={styles.statLabel}>Active Projects</div>
          <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>monitored weekly</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{stats?.totalAudits ?? 0}</div>
          <div style={styles.statLabel}>Total Audits</div>
          <Link href="/audits" style={styles.statLink}>View history →</Link>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statValue, color: stats?.lowScoreUrls.length ? '#991b1b' : '#065f46' }}>
            {stats?.lowScoreUrls.length ?? 0}
          </div>
          <div style={styles.statLabel}>URLs Below 50</div>
          <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>need attention</div>
        </div>
      </div>

      <div style={styles.twoCol}>
        {/* Recent audits */}
        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <h2 style={styles.panelTitle}>Recent Audits</h2>
            <Link href="/audits" style={styles.panelLink}>View all →</Link>
          </div>
          {!stats?.recentAudits.length ? (
            <p style={styles.empty}>No audits yet. <Link href="/audits/new">Run one →</Link></p>
          ) : (
            <div>
              {stats.recentAudits.map(run => (
                <Link key={run.id} href={`/audits/${run.id}`} style={styles.auditRow}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                      <span style={styles.pageTypeBadge}>{run.pageType}</span>
                      {run.projectTitle}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                      {run.url}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexShrink: 0 }}>
                    {run.status === 'failed'
                      ? <span style={{ fontSize: '0.75rem', color: '#991b1b', background: '#fee2e2', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>Failed</span>
                      : <ScoreBadge score={run.performanceScore} size="sm" />}
                    <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                      {new Date(run.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Needs attention */}
        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <h2 style={styles.panelTitle}>⚠️ Needs Attention</h2>
            <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Performance &lt; 50</span>
          </div>
          {!stats?.lowScoreUrls.length ? (
            <div style={styles.allGood}>
              <div style={{ fontSize: '2rem' }}>✅</div>
              <p style={{ margin: '0.5rem 0 0', color: '#065f46', fontWeight: 500 }}>All URLs performing well</p>
            </div>
          ) : (
            <div>
              {stats.lowScoreUrls.map(run => (
                <Link key={run.id} href={`/audits/${run.id}`} style={styles.auditRow}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                      <span style={styles.pageTypeBadge}>{run.pageType}</span>
                      {run.projectTitle}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                      {run.url}
                    </div>
                  </div>
                  <ScoreBadge score={run.performanceScore} size="sm" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick links */}
      <div style={styles.quickLinks}>
        <Link href="/projects/new" style={styles.quickLink}>
          <span style={{ fontSize: '1.5rem' }}>➕</span>
          <span>Add Project</span>
        </Link>
        <Link href="/audits/new" style={styles.quickLink}>
          <span style={{ fontSize: '1.5rem' }}>▶</span>
          <span>Run Audit</span>
        </Link>
        <Link href="/projects" style={styles.quickLink}>
          <span style={{ fontSize: '1.5rem' }}>📋</span>
          <span>All Projects</span>
        </Link>
        <Link href="/audits" style={styles.quickLink}>
          <span style={{ fontSize: '1.5rem' }}>📊</span>
          <span>Audit History</span>
        </Link>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: '1100px', margin: '0 auto', padding: '2rem', fontFamily: 'system-ui, sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' },
  title: { margin: '0 0 0.25rem', fontSize: '1.75rem', fontWeight: 700, color: '#111827' },
  subtitle: { margin: 0, color: '#6b7280', fontSize: '0.9rem' },
  runBtn: { background: '#2563eb', color: '#fff', padding: '0.55rem 1.25rem', borderRadius: '6px', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500 },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' },
  statCard: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1.25rem' },
  statValue: { fontSize: '2rem', fontWeight: 700, color: '#111827', lineHeight: 1 },
  statLabel: { fontSize: '0.8rem', color: '#6b7280', margin: '0.4rem 0 0.5rem', textTransform: 'uppercase' as const, letterSpacing: '0.04em' },
  statLink: { fontSize: '0.8rem', color: '#2563eb', textDecoration: 'none' },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' },
  panel: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1.25rem' },
  panelHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  panelTitle: { margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#111827' },
  panelLink: { fontSize: '0.8rem', color: '#2563eb', textDecoration: 'none' },
  empty: { color: '#9ca3af', fontSize: '0.875rem' },
  auditRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0', borderBottom: '1px solid #f3f4f6', textDecoration: 'none', gap: '0.75rem' },
  pageTypeBadge: { display: 'inline-block', background: '#f3f4f6', color: '#9ca3af', padding: '0.1rem 0.4rem', borderRadius: '3px', fontSize: '0.65rem', marginRight: '0.35rem' },
  allGood: { textAlign: 'center' as const, padding: '2rem 1rem' },
  quickLinks: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' },
  quickLink: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '0.5rem', padding: '1.25rem', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', textDecoration: 'none', color: '#374151', fontSize: '0.875rem', fontWeight: 500 },
};
