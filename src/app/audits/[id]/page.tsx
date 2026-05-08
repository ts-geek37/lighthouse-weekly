'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { ScoreBadge } from '@/components/ScoreBadge';
import { AgentPrompt } from '@/types';
import { AgentPromptCard } from '@/components/AgentPromptCard';

interface AuditDetail {
  id: string;
  status: string;
  url: string;
  pageType: string;
  projectId: string;
  projectTitle: string;
  projectOwner: string;
  environment: string;
  performanceScore: number | null;
  accessibilityScore: number | null;
  seoScore: number | null;
  bestPracticesScore: number | null;
  coreWebVitals: {
    lcp: number | null;
    cls: number | null;
    inpOrTbt: number | null;
    fcp: number | null;
    speedIndex: number | null;
  };
  opportunities: Array<{
    id: string;
    title: string;
    description: string;
    savingsMs?: number;
    savingsBytes?: number;
  }>;
  agentPrompts: AgentPrompt[];
  aiSummary: string | null;
  createdAt: string;
}

function formatMs(value: number | null): string {
  if (value === null) return 'N/A';
  if (value >= 1000) return `${(value / 1000).toFixed(1)}s`;
  return `${Math.round(value)}ms`;
}

function vitalStatus(metric: string, value: number | null): 'good' | 'needs-improvement' | 'poor' | 'unknown' {
  if (value === null) return 'unknown';
  const thresholds: Record<string, [number, number]> = {
    lcp: [2500, 4000], cls: [0.1, 0.25], inpOrTbt: [200, 500], fcp: [1800, 3000], speedIndex: [3400, 5800],
  };
  const [good, poor] = thresholds[metric] ?? [Infinity, Infinity];
  if (value <= good) return 'good';
  if (value <= poor) return 'needs-improvement';
  return 'poor';
}

const vitalColors = { good: '#065f46', 'needs-improvement': '#92400e', poor: '#991b1b', unknown: '#9ca3af' };
const vitalBg = { good: '#d1fae5', 'needs-improvement': '#fef3c7', poor: '#fee2e2', unknown: '#f3f4f6' };

export default function AuditDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [audit, setAudit] = useState<AuditDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/audits/${id}`)
      .then(r => {
        if (r.status === 404) { setNotFound(true); setLoading(false); return null; }
        return r.json();
      })
      .then(data => { if (data) setAudit(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) return <div style={styles.container}><p>Loading audit…</p></div>;
  if (notFound) return (
    <div style={styles.container}>
      <p>Audit not found.</p>
      <Link href="/audits" style={styles.back}>← Back to history</Link>
    </div>
  );
  if (!audit) return null;

  const vitals = [
    { key: 'lcp', label: 'LCP', value: audit.coreWebVitals.lcp, desc: 'Largest Contentful Paint' },
    { key: 'cls', label: 'CLS', value: audit.coreWebVitals.cls, desc: 'Cumulative Layout Shift' },
    { key: 'inpOrTbt', label: 'INP/TBT', value: audit.coreWebVitals.inpOrTbt, desc: 'INP / Total Blocking Time' },
    { key: 'fcp', label: 'FCP', value: audit.coreWebVitals.fcp, desc: 'First Contentful Paint' },
    { key: 'speedIndex', label: 'Speed Index', value: audit.coreWebVitals.speedIndex, desc: 'Speed Index' },
  ];

  return (
    <div style={styles.container}>
      {/* Breadcrumb */}
      <div style={styles.breadcrumb}>
        <Link href="/projects" style={styles.back}>Projects</Link>
        <span style={styles.sep}>/</span>
        <Link href={`/projects/${audit.projectId}`} style={styles.back}>{audit.projectTitle}</Link>
        <span style={styles.sep}>/</span>
        <Link href="/audits" style={styles.back}>Audits</Link>
        <span style={styles.sep}>/</span>
        <span style={{ color: '#374151' }}>Detail</span>
      </div>

      {/* Header */}
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.title}>{audit.pageType} Audit</h1>
          <a href={audit.url} target="_blank" rel="noopener noreferrer" style={styles.urlLink}>{audit.url}</a>
          <div style={{ marginTop: '0.4rem', fontSize: '0.85rem', color: '#6b7280' }}>
            {audit.projectTitle} · {audit.environment} · {audit.projectOwner} · {new Date(audit.createdAt).toLocaleString()}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {audit.status === 'failed' && <span style={styles.failedBadge}>Audit Failed</span>}
          <Link href="/audits/new" style={styles.rerunBtn}>↺ Re-run</Link>
        </div>
      </div>

      {audit.status === 'failed' ? (
        <div style={styles.errorBox}>
          This audit failed. No metrics are available. Re-run the audit using the button above.
        </div>
      ) : (
        <>
          {/* Scores */}
          <div style={styles.scoresGrid}>
            {[
              { label: 'Performance', score: audit.performanceScore },
              { label: 'Accessibility', score: audit.accessibilityScore },
              { label: 'SEO', score: audit.seoScore },
              { label: 'Best Practices', score: audit.bestPracticesScore },
            ].map(({ label, score }) => (
              <div key={label} style={styles.scoreCard}>
                <ScoreBadge score={score} size="lg" />
                <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '0.5rem', fontWeight: 500 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Core Web Vitals */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Core Web Vitals</h2>
            <div style={styles.vitalsGrid}>
              {vitals.map(({ key, label, value, desc }) => {
                const status = vitalStatus(key, value);
                return (
                  <div key={key} style={{ ...styles.vitalCard, background: vitalBg[status] }}>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>{label}</div>
                    <div style={{ fontWeight: 700, fontSize: '1.4rem', color: vitalColors[status] }}>
                      {key === 'cls' ? (value !== null ? value.toFixed(3) : 'N/A') : formatMs(value)}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.25rem' }}>{desc}</div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: vitalColors[status], marginTop: '0.2rem', textTransform: 'capitalize' as const }}>
                      {status === 'unknown' ? '' : status.replace('-', ' ')}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Opportunities */}
          {audit.opportunities.length > 0 && (
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>Optimization Opportunities</h2>
              <div style={styles.opportunitiesTable}>
                {audit.opportunities.map(opp => (
                  <div key={opp.id} style={styles.oppRow}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{opp.title}</div>
                      <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.15rem' }}>{opp.description}</div>
                    </div>
                    <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
                      {opp.savingsMs !== undefined && opp.savingsMs > 0 && (
                        <div style={styles.savingsBadge}>{formatMs(opp.savingsMs)}</div>
                      )}
                      {opp.savingsBytes !== undefined && opp.savingsBytes > 0 && (
                        <div style={{ ...styles.savingsBadge, background: '#eff6ff', color: '#1d4ed8' }}>
                          ~{Math.round(opp.savingsBytes / 1024)} KB
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Engineering Summary */}
          {audit.aiSummary && (
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>AI Engineering Summary</h2>
              <div style={styles.summaryCard}>
                {audit.aiSummary.split('\n').map((line, i) => {
                  if (line.startsWith('## ')) {
                    const name = line.replace('## ', '');
                    const icon = name === 'Good' ? '✅' : name === 'Needs Attention' ? '⚠️' : '🔧';
                    return <h3 key={i} style={styles.summarySection}>{icon} {name}</h3>;
                  }
                  if (line.startsWith('- ') || line.startsWith('* ')) {
                    const content = line.slice(2);
                    return (
                      <p key={i} style={styles.summaryBullet}>
                        • <span dangerouslySetInnerHTML={{ __html: content
                          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                          .replace(/`(.+?)`/g, '<code style="background:#e5e7eb;padding:0.1em 0.3em;border-radius:3px;font-size:0.85em">$1</code>')
                        }} />
                      </p>
                    );
                  }
                  return line ? <p key={i} style={{ margin: '0.2rem 0', fontSize: '0.875rem' }}
                    dangerouslySetInnerHTML={{ __html: line
                      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                      .replace(/`(.+?)`/g, '<code style="background:#e5e7eb;padding:0.1em 0.3em;border-radius:3px;font-size:0.85em">$1</code>')
                    }}
                  /> : null;
                })}
              </div>
            </div>
          )}

          {/* Agent Investigation Prompts */}
          {audit.agentPrompts && audit.agentPrompts.length > 0 && (
            <div style={styles.section}>
              <div style={styles.agentSectionHeader}>
                <div>
                  <h2 style={{ ...styles.sectionTitle, margin: 0 }}>🤖 Agent Investigation Prompts</h2>
                  <p style={styles.agentSectionDesc}>
                    Paste these into your AI coding agent (Cursor, Copilot, Claude, etc.) to investigate root causes.
                    The agent will search your codebase and report findings — not implement fixes.
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.75rem' }}>
                {audit.agentPrompts.map((prompt, i) => (
                  <AgentPromptCard key={prompt.opportunityId} prompt={prompt} index={i} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: '960px', margin: '0 auto', padding: '2rem', fontFamily: 'system-ui, sans-serif' },
  breadcrumb: { display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1.5rem', fontSize: '0.875rem' },
  back: { color: '#6b7280', textDecoration: 'none' },
  sep: { color: '#d1d5db' },
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' },
  title: { margin: '0 0 0.25rem', fontSize: '1.5rem' },
  urlLink: { color: '#2563eb', textDecoration: 'none', fontSize: '0.9rem', wordBreak: 'break-all' as const },
  failedBadge: { background: '#fee2e2', color: '#991b1b', padding: '0.3rem 0.75rem', borderRadius: '6px', fontSize: '0.875rem', fontWeight: 500 },
  rerunBtn: { background: '#f3f4f6', color: '#374151', padding: '0.4rem 0.9rem', borderRadius: '6px', textDecoration: 'none', fontSize: '0.875rem' },
  errorBox: { background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '1.25rem', color: '#991b1b' },
  scoresGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' },
  scoreCard: { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1.5rem', textAlign: 'center' as const },
  section: { marginBottom: '2rem' },
  sectionTitle: { margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: 600, color: '#111827' },
  vitalsGrid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem' },
  vitalCard: { borderRadius: '8px', padding: '1rem', textAlign: 'center' as const },
  opportunitiesTable: { border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' },
  oppRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.875rem 1rem', borderBottom: '1px solid #f3f4f6', gap: '1rem' },
  savingsBadge: { display: 'inline-block', background: '#d1fae5', color: '#065f46', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' },
  summaryCard: { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1.25rem' },
  summarySection: { margin: '1rem 0 0.4rem', fontSize: '1rem', fontWeight: 600, color: '#1f2937' },
  summaryBullet: { margin: '0.3rem 0', paddingLeft: '0.5rem', fontSize: '0.875rem', lineHeight: 1.6, color: '#374151' },
  // Agent prompts
  agentSectionHeader: { marginBottom: '1rem' },
  agentSectionDesc: { margin: '0.4rem 0 0', fontSize: '0.85rem', color: '#6b7280', maxWidth: '600px' },
};
