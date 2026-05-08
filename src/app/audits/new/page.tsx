'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AgentPrompt, ProjectResponse } from '@/types';
import { ScoreBadge } from '@/components/ScoreBadge';
import { AgentPromptCard } from '@/components/AgentPromptCard';

interface AuditResult {
  auditRunId: string;
  url: string;
  status: 'success' | 'failed';
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
  opportunities: Array<{ id: string; title: string; description: string; savingsMs?: number; savingsBytes?: number }>;
  agentPrompts: AgentPrompt[];
  aiSummary: string | null;
  error?: string;
}

export default function RunAuditPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [mode, setMode] = useState<'adhoc' | 'project'>('adhoc');
  const [url, setUrl] = useState('');
  const [selectedProjectUrlId, setSelectedProjectUrlId] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then(setProjects)
      .catch(() => {});
  }, []);

  // Timer while running
  useEffect(() => {
    if (!running) { setElapsed(0); return; }
    const interval = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(interval);
  }, [running]);

  // Flatten all project URLs for the dropdown
  const allProjectUrls = projects.flatMap(p =>
    p.urls.map(u => ({ ...u, projectTitle: p.title, environment: p.environment }))
  );

  async function handleRun(e: React.FormEvent) {
    e.preventDefault();
    setRunning(true);
    setResult(null);
    setError(null);

    const targetUrl = mode === 'project'
      ? allProjectUrls.find(u => u.id === selectedProjectUrlId)?.url ?? ''
      : url;

    const body: Record<string, string> = { url: targetUrl };
    if (mode === 'project' && selectedProjectUrlId) {
      body.projectUrlId = selectedProjectUrlId;
    }

    try {
      const res = await fetch('/api/audits/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Audit failed');
      } else {
        setResult(data);
      }
    } catch {
      setError('Network error — is the server running?');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <a href="/audits" style={styles.back}>← Audit History</a>
        <h1 style={styles.title}>Run Audit</h1>
        <p style={styles.subtitle}>Run an immediate Lighthouse audit for any URL. Results appear below — no need to wait for the weekly schedule.</p>
      </div>

      <form onSubmit={handleRun} style={styles.form}>
        {/* Mode toggle */}
        <div style={styles.modeToggle}>
          <button
            type="button"
            onClick={() => setMode('adhoc')}
            style={{ ...styles.modeBtn, ...(mode === 'adhoc' ? styles.modeBtnActive : {}) }}
          >
            Any URL
          </button>
          <button
            type="button"
            onClick={() => setMode('project')}
            style={{ ...styles.modeBtn, ...(mode === 'project' ? styles.modeBtnActive : {}) }}
          >
            Project URL
          </button>
        </div>

        {mode === 'adhoc' ? (
          <div style={styles.field}>
            <label style={styles.label}>URL to audit</label>
            <input
              style={styles.input}
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://example.com"
              required
            />
            <p style={styles.hint}>Results will not be saved to the database.</p>
          </div>
        ) : (
          <div style={styles.field}>
            <label style={styles.label}>Select a monitored URL</label>
            <select
              style={styles.input}
              value={selectedProjectUrlId}
              onChange={e => setSelectedProjectUrlId(e.target.value)}
              required
            >
              <option value="">— choose a URL —</option>
              {allProjectUrls.map(u => (
                <option key={u.id} value={u.id}>
                  [{u.projectTitle} / {u.pageType}] {u.url}
                </option>
              ))}
            </select>
            <p style={styles.hint}>Results will be saved and appear in audit history.</p>
          </div>
        )}

        <button type="submit" disabled={running} style={styles.runBtn}>
          {running ? `Running… ${elapsed}s` : '▶ Run Audit'}
        </button>
      </form>

      {running && (
        <div style={styles.loadingBox}>
          <div style={styles.spinner} />
          <div>
            <strong>Audit in progress</strong>
            <p style={{ margin: '0.25rem 0 0', color: '#6b7280', fontSize: '0.875rem' }}>
              Lighthouse is running headless Chrome. This typically takes 15–40 seconds.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div style={styles.errorBox}>
          <strong>Audit failed:</strong> {error}
        </div>
      )}

      {result && (
        <div style={styles.resultCard}>
          <div style={styles.resultHeader}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.1rem' }}>
                {result.status === 'success' ? '✅' : '❌'} {result.url}
              </h2>
              <p style={{ margin: '0.25rem 0 0', color: '#6b7280', fontSize: '0.85rem' }}>
                {result.status === 'failed' ? `Failed: ${result.error}` : 'Audit completed'}
              </p>
            </div>
            {result.status === 'success' && result.auditRunId && !result.auditRunId.startsWith('adhoc-') && (
              <a href={`/audits/${result.auditRunId}`} style={styles.viewBtn}>
                View Full Report →
              </a>
            )}
          </div>

          {result.status === 'success' && (
            <>
              {/* Scores */}
              <div style={styles.scoresGrid}>
                {[
                  { label: 'Performance', score: result.performanceScore },
                  { label: 'Accessibility', score: result.accessibilityScore },
                  { label: 'SEO', score: result.seoScore },
                  { label: 'Best Practices', score: result.bestPracticesScore },
                ].map(({ label, score }) => (
                  <div key={label} style={styles.scoreCard}>
                    <ScoreBadge score={score} size="lg" />
                    <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.4rem' }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Core Web Vitals */}
              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>Core Web Vitals</h3>
                <div style={styles.vitalsGrid}>
                  {[
                    { label: 'LCP', value: result.coreWebVitals.lcp, isCls: false, good: 2500, poor: 4000 },
                    { label: 'CLS', value: result.coreWebVitals.cls, isCls: true, good: 0.1, poor: 0.25 },
                    { label: 'INP/TBT', value: result.coreWebVitals.inpOrTbt, isCls: false, good: 200, poor: 500 },
                    { label: 'FCP', value: result.coreWebVitals.fcp, isCls: false, good: 1800, poor: 3000 },
                    { label: 'Speed Index', value: result.coreWebVitals.speedIndex, isCls: false, good: 3400, poor: 5800 },
                  ].map(({ label, value, isCls, good, poor }) => {
                    const status = value === null ? 'unknown' : value <= good ? 'good' : value <= poor ? 'needs-improvement' : 'poor';
                    const color = status === 'good' ? '#065f46' : status === 'needs-improvement' ? '#92400e' : status === 'poor' ? '#991b1b' : '#9ca3af';
                    const bg = status === 'good' ? '#d1fae5' : status === 'needs-improvement' ? '#fef3c7' : status === 'poor' ? '#fee2e2' : '#f3f4f6';
                    const formatted = value === null ? 'N/A' : isCls ? value.toFixed(3) : value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${Math.round(value)}ms`;
                    return (
                      <div key={label} style={{ ...styles.vitalCard, background: bg }}>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>{label}</div>
                        <div style={{ fontWeight: 700, fontSize: '1.1rem', color }}>{formatted}</div>
                        {status !== 'unknown' && (
                          <div style={{ fontSize: '0.65rem', fontWeight: 600, color, marginTop: '0.2rem', textTransform: 'capitalize' as const }}>
                            {status.replace('-', ' ')}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Opportunities */}
              {result.opportunities.length > 0 && (
                <div style={styles.section}>
                  <h3 style={styles.sectionTitle}>Top Opportunities</h3>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                    {result.opportunities.map(opp => (
                      <li key={opp.id} style={{ marginBottom: '0.4rem', fontSize: '0.9rem' }}>
                        <strong>{opp.title}</strong>
                        {opp.savingsMs !== undefined && opp.savingsMs > 0 && (
                          <span style={{ color: '#6b7280', marginLeft: '0.5rem' }}>
                            {opp.savingsMs >= 1000 ? `~${(opp.savingsMs / 1000).toFixed(1)}s` : `~${Math.round(opp.savingsMs)}ms`} savings
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* AI Summary */}
              {result.aiSummary && (
                <div style={styles.section}>
                  <h3 style={styles.sectionTitle}>AI Engineering Summary</h3>
                  <div style={styles.summaryBox}>
                    {result.aiSummary.split('\n').map((line, i) => {
                      if (line.startsWith('## ')) {
                        return <h4 key={i} style={{ margin: '0.75rem 0 0.25rem', fontSize: '0.95rem', color: '#1f2937' }}>{line.replace('## ', '')}</h4>;
                      }
                      if (line.startsWith('- ')) {
                        return <p key={i} style={{ margin: '0.2rem 0', paddingLeft: '1rem', fontSize: '0.875rem' }}>• {line.slice(2)}</p>;
                      }
                      return line ? <p key={i} style={{ margin: '0.2rem 0', fontSize: '0.875rem' }}>{line}</p> : null;
                    })}
                  </div>
                </div>
              )}

              {/* Agent Investigation Prompts */}
              {result.agentPrompts && result.agentPrompts.length > 0 && (
                <div style={styles.section}>
                  <h3 style={styles.sectionTitle}>🤖 Agent Investigation Prompts</h3>
                  <p style={{ margin: '-0.5rem 0 0.75rem', fontSize: '0.8rem', color: '#6b7280' }}>
                    Paste into Cursor, Copilot, or Claude to find root causes — not implement fixes.
                  </p>
                  {result.agentPrompts.map((p, i) => (
                    <AgentPromptCard key={p.opportunityId} prompt={p} index={i} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: '900px', margin: '0 auto', padding: '2rem', fontFamily: 'system-ui, sans-serif' },
  header: { marginBottom: '2rem' },
  back: { color: '#6b7280', textDecoration: 'none', fontSize: '0.9rem' },
  title: { margin: '0.5rem 0 0.25rem', fontSize: '1.75rem' },
  subtitle: { margin: 0, color: '#6b7280', fontSize: '0.9rem' },
  form: { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1.5rem', marginBottom: '1.5rem' },
  modeToggle: { display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' },
  modeBtn: { padding: '0.4rem 1rem', borderRadius: '6px', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: '0.875rem', color: '#374151' },
  modeBtnActive: { background: '#2563eb', color: '#fff', borderColor: '#2563eb' },
  field: { marginBottom: '1rem' },
  label: { display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.4rem' },
  input: { width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box' as const },
  hint: { margin: '0.35rem 0 0', fontSize: '0.8rem', color: '#9ca3af' },
  runBtn: { padding: '0.65rem 2rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '1rem', fontWeight: 600, cursor: 'pointer' },
  loadingBox: { display: 'flex', alignItems: 'flex-start', gap: '1rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '1.25rem', marginBottom: '1.5rem' },
  spinner: { width: '24px', height: '24px', border: '3px solid #bfdbfe', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0, marginTop: '2px' },
  errorBox: { background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '1rem', color: '#991b1b', marginBottom: '1.5rem' },
  resultCard: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1.5rem' },
  resultHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' },
  viewBtn: { padding: '0.4rem 0.9rem', background: '#f3f4f6', color: '#374151', borderRadius: '6px', textDecoration: 'none', fontSize: '0.875rem', whiteSpace: 'nowrap' as const },
  scoresGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' },
  scoreCard: { textAlign: 'center' as const, padding: '1rem', background: '#f9fafb', borderRadius: '8px' },
  section: { marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e5e7eb' },
  sectionTitle: { margin: '0 0 0.75rem', fontSize: '0.95rem', fontWeight: 600, color: '#374151' },
  vitalsGrid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem' },
  vitalCard: { borderRadius: '6px', padding: '0.75rem', textAlign: 'center' as const },
  summaryBox: { background: '#f9fafb', borderRadius: '6px', padding: '1rem', fontSize: '0.875rem', lineHeight: 1.6 },
};
