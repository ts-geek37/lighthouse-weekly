'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { ScoreBadge } from '@/components/ScoreBadge';
import { AgentPrompt, AdvancedDiagnostics } from '@/types';
import { AgentPromptCard } from '@/components/AgentPromptCard';

// Weekly intelligence imports
import { ScoreComparisonCards } from '@/components/weekly-intelligence/ScoreComparisonCards';
import { VitalsComparisonTable } from '@/components/weekly-intelligence/VitalsComparisonTable';
import { RegressionList } from '@/components/weekly-intelligence/RegressionList';
import { OpportunityDiffList } from '@/components/weekly-intelligence/OpportunityDiffList';
import { DeterministicRecommendationList } from '@/components/weekly-intelligence/DeterministicRecommendationList';
import { AiInsightPanel } from '@/components/weekly-intelligence/AiInsightPanel';
import { TrendChart } from '@/components/weekly-intelligence/TrendChart';
import { ProjectComparisonReport } from '@/lib/comparison/comparisonTypes';

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
  advancedDiagnostics?: AdvancedDiagnostics;
  createdAt: string;
  device: 'mobile' | 'desktop';
  siblingRunId: string | null;
}

function formatMs(value: number | null): string {
  if (value === null) return 'N/A';
  if (value >= 1000) return `${(value / 1000).toFixed(2)}s`;
  return `${value.toFixed(2)}ms`;
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

function renderMarkdown(text: string) {
  const blocks: React.ReactNode[] = [];
  let currentList: React.ReactNode[] = [];
  
  const pushList = () => {
    if (currentList.length > 0) {
      blocks.push(<ul key={`ul-${blocks.length}`} style={styles.markdownList}>{currentList}</ul>);
      currentList = [];
    }
  };

  text.split('\n').forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) {
      pushList();
      return;
    }

    if (trimmed.startsWith('## ')) {
      pushList();
      const title = trimmed.replace('## ', '');
      let icon = '💡';
      if (title.toLowerCase().includes('good')) icon = '✅';
      else if (title.toLowerCase().includes('needs attention') || title.toLowerCase().includes('issue')) icon = '⚠️';
      else if (title.toLowerCase().includes('investigate') || title.toLowerCase().includes('action')) icon = '🛠️';
      blocks.push(<h3 key={i} style={styles.markdownH2}>{icon} {title}</h3>);
    } else if (trimmed.startsWith('# ')) {
      pushList();
      blocks.push(<h2 key={i} style={styles.markdownH1}>{trimmed.replace('# ', '')}</h2>);
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const content = trimmed.slice(2);
      currentList.push(
        <li key={i} style={styles.markdownListItem}
          dangerouslySetInnerHTML={{ __html: content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/`(.*?)`/g, '<code style="background:#f1f5f9;color:#0f172a;padding:0.1em 0.4em;border-radius:4px;font-family:monospace;font-size:0.85em;border:1px solid #e2e8f0">$1</code>')
          }} 
        />
      );
    } else {
      pushList();
      blocks.push(
        <p key={i} style={styles.markdownP}
          dangerouslySetInnerHTML={{ __html: trimmed
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/`(.*?)`/g, '<code style="background:#f1f5f9;color:#0f172a;padding:0.1em 0.4em;border-radius:4px;font-family:monospace;font-size:0.85em;border:1px solid #e2e8f0">$1</code>')
          }} 
        />
      );
    }
  });
  pushList();
  
  return blocks;
}

export default function AuditDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [mobileAudit, setMobileAudit] = useState<AuditDetail | null>(null);
  const [desktopAudit, setDesktopAudit] = useState<AuditDetail | null>(null);
  const [activeDevice, setActiveDevice] = useState<'mobile' | 'desktop'>('mobile');
  const [activeTab, setActiveTab] = useState<'overview' | 'official'>('overview');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Comparison report states
  const [comparisonReport, setComparisonReport] = useState<ProjectComparisonReport | null>(null);
  const [loadingComparison, setLoadingComparison] = useState(false);

  const setAuditForDevice = (data: AuditDetail) => {
    if (data.device === 'mobile') {
      setMobileAudit(data);
    } else {
      setDesktopAudit(data);
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function fetchAuditPair() {
      setLoading(true);
      setNotFound(false);
      setMobileAudit(null);
      setDesktopAudit(null);
      setComparisonReport(null);

      try {
        const response = await fetch(`/api/audits/${id}`);
        if (response.status === 404) {
          if (!cancelled) {
            setNotFound(true);
            setLoading(false);
          }
          return;
        }
        if (!response.ok) throw new Error('Failed to fetch audit');

        const data: AuditDetail = await response.json();
        if (cancelled) return;

        setAuditForDevice(data);
        setActiveDevice(data.device);

        if (data.siblingRunId) {
          const siblingResponse = await fetch(`/api/audits/${data.siblingRunId}`);
          if (siblingResponse.ok) {
            const sibling: AuditDetail = await siblingResponse.json();
            if (cancelled) return;
            setAuditForDevice(sibling);
            if (sibling.device === 'mobile') {
              setActiveDevice('mobile');
            }
          }
        }
      } catch (err) {
        console.error('Error fetching audit detail:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAuditPair();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const audit = activeDevice === 'mobile'
    ? (mobileAudit ?? desktopAudit)
    : (desktopAudit ?? mobileAudit);

  useEffect(() => {
    if (!audit?.projectId) return;

    let cancelled = false;
    setLoadingComparison(true);
    setComparisonReport(null);

    fetch(`/api/projects/${audit.projectId}/weekly-intelligence?device=${activeDevice}`)
      .then(r => {
        if (!r.ok) throw new Error('Failed to fetch comparison');
        return r.json();
      })
      .then(data => {
        if (!cancelled) setComparisonReport(data);
      })
      .catch(err => {
        if (!cancelled) console.error('Error fetching comparison report:', err);
      })
      .finally(() => {
        if (!cancelled) setLoadingComparison(false);
      });

    return () => {
      cancelled = true;
    };
  }, [audit?.projectId, activeDevice]);

  if (loading) return <div style={styles.container}><p>Loading audit...</p></div>;
  if (notFound) return (
    <div style={styles.container}>
      <p>Audit not found.</p>
      <Link href="/audits" style={styles.back}>Back to history</Link>
    </div>
  );
  if (!audit) return null;


  const activeUrlReport = comparisonReport?.urls.find(u => u.url === audit.url);

  const vitals = [
    { key: 'lcp', label: 'LCP', value: audit.coreWebVitals.lcp, desc: 'Largest Contentful Paint' },
    { key: 'cls', label: 'CLS', value: audit.coreWebVitals.cls, desc: 'Cumulative Layout Shift' },
    { key: 'inpOrTbt', label: 'INP/TBT', value: audit.coreWebVitals.inpOrTbt, desc: 'INP / Total Blocking Time' },
    { key: 'fcp', label: 'FCP', value: audit.coreWebVitals.fcp, desc: 'First Contentful Paint' },
    { key: 'speedIndex', label: 'Speed Index', value: audit.coreWebVitals.speedIndex, desc: 'Speed Index' },
  ];

  return (
    <div style={styles.container}>
      <div style={styles.breadcrumb}>
        <Link href="/projects" style={styles.back}>Projects</Link>
        <span style={styles.sep}>/</span>
        <Link href={`/projects/${audit.projectId}`} style={styles.back}>{audit.projectTitle}</Link>
        <span style={styles.sep}>/</span>
        <Link href="/audits" style={styles.back}>Audits</Link>
        <span style={styles.sep}>/</span>
        <span style={{ color: '#374151' }}>Detail</span>
      </div>

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

      {audit.status !== 'failed' && (
        <div style={styles.deviceTabContainer}>
          <button
            onClick={() => setActiveDevice('mobile')}
            disabled={!mobileAudit}
            style={{
              ...styles.deviceTab,
              ...(activeDevice === 'mobile' ? styles.deviceTabActive : {}),
              ...(!mobileAudit ? { cursor: 'not-allowed', opacity: 0.5 } : {}),
            }}
            title={!mobileAudit ? 'No mobile audit run found.' : undefined}
          >
            <svg style={{ marginRight: '6px' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
              <line x1="12" y1="18" x2="12.01" y2="18" />
            </svg>
            Mobile
          </button>
          <button
            onClick={() => setActiveDevice('desktop')}
            disabled={!desktopAudit}
            style={{
              ...styles.deviceTab,
              ...(activeDevice === 'desktop' ? styles.deviceTabActive : {}),
              ...(!desktopAudit ? { cursor: 'not-allowed', opacity: 0.5 } : {}),
            }}
            title={!desktopAudit ? 'No desktop audit run found.' : undefined}
          >
            <svg style={{ marginRight: '6px' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            Desktop {!desktopAudit && '(N/A)'}
          </button>
        </div>
      )}

      {audit.status === 'failed' ? (
        <div style={styles.errorBox}>
          This audit failed. No metrics are available. Re-run the audit using the button above.
        </div>
      ) : (
        <>
          <div style={styles.tabContainer}>
            <button 
              style={{...styles.tabBtn, ...(activeTab === 'overview' ? styles.activeTab : {})}} 
              onClick={() => setActiveTab('overview')}
            >
              Overview
            </button>
            <button 
              style={{...styles.tabBtn, ...(activeTab === 'official' ? styles.activeTab : {})}} 
              onClick={() => setActiveTab('official')}
            >
              Official Report
            </button>
          </div>

          <div style={{ marginTop: '2rem' }}>
            {activeTab === 'overview' && (
              <>
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

                <div style={styles.section}>
                  <h2 style={styles.sectionTitle}>Core Web Vitals</h2>
                  <div style={styles.vitalsGrid}>
                    {vitals.map(({ key, label, value, desc }) => {
                      const status = vitalStatus(key, value);
                      return (
                        <div key={key} style={{ ...styles.vitalCard, background: vitalBg[status] }}>
                          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>{label}</div>
                          <div style={{ fontWeight: 700, fontSize: '1.4rem', color: vitalColors[status] }}>
                            {key === 'cls' ? (value !== null ? value.toFixed(2) : 'N/A') : formatMs(value)}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.25rem' }}>{desc}</div>
                          <div style={{ fontSize: '0.7rem', fontWeight: 600, color: vitalColors[status], marginTop: '0.2rem', textTransform: 'capitalize' }}>
                            {status === 'unknown' ? '' : status.replace('-', ' ')}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {audit.aiSummary && (
                  <div style={styles.section}>
                    <div style={styles.aiSummaryHeader}>
                      <div style={styles.aiIconWrapper}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: '#8b5cf6'}}>
                          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                        </svg>
                      </div>
                      <h2 style={{...styles.sectionTitle, margin: 0, color: '#4c1d95'}}>AI Engineering Summary</h2>
                    </div>
                    <div style={styles.aiSummaryContainer}>
                      {renderMarkdown(audit.aiSummary)}
                    </div>
                  </div>
                )}

                {audit.opportunities.length > 0 && (
                  <div style={styles.section}>
                    <h2 style={styles.sectionTitle}>Optimization Opportunities</h2>
                    <div style={styles.opportunitiesTable}>
                      {audit.opportunities.map(opp => (
                        <div key={opp.id} style={styles.oppRow}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 500, fontSize: '0.9rem', color: '#1f2937' }}>{opp.title}</div>
                            <div style={{ fontSize: '0.8rem', color: '#4b5563', marginTop: '0.2rem', lineHeight: 1.5 }}>{opp.description}</div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'flex-end' }}>
                            {opp.savingsMs !== undefined && opp.savingsMs > 0 && (
                              <div style={styles.savingsBadge}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight: 4}}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                {formatMs(opp.savingsMs)}
                              </div>
                            )}
                            {opp.savingsBytes !== undefined && opp.savingsBytes > 0 && (
                              <div style={{ ...styles.savingsBadge, background: '#eff6ff', color: '#1d4ed8' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight: 4}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                {(opp.savingsBytes / 1024).toFixed(2)} KB
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(() => {
                  const promptsToDisplay = (activeUrlReport && activeUrlReport.hasEnoughData && activeUrlReport.agentPrompts && activeUrlReport.agentPrompts.length > 0)
                    ? activeUrlReport.agentPrompts
                    : audit.agentPrompts;

                  const isWeeklyPrompts = activeUrlReport && activeUrlReport.hasEnoughData && activeUrlReport.agentPrompts && activeUrlReport.agentPrompts.length > 0;

                  if (!promptsToDisplay || promptsToDisplay.length === 0) return null;

                  return (
                    <div id="agent-prompts-section" style={styles.section}>
                      <div style={styles.agentSectionHeader}>
                        <div>
                          <h2 style={{ ...styles.sectionTitle, margin: 0 }}>
                            {isWeeklyPrompts ? '🤖 Comparative Agent Prompts' : '🤖 Agent Investigation Prompts'}
                          </h2>
                          <p style={styles.agentSectionDesc}>
                            {isWeeklyPrompts
                              ? "These prompts are optimized for AI coding agents to investigate the performance regressions."
                              : "Paste these into your AI coding agent (Cursor, Copilot, Claude, etc.) to investigate root causes."}
                          </p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {promptsToDisplay.map((prompt, i) => (
                          <AgentPromptCard key={prompt.opportunityId} prompt={prompt} index={i} />
                        ))}
                      </div>
                    </div>
                  );
                })()}

                <div style={{ borderTop: '2px solid #e5e7eb', marginTop: '3rem', paddingTop: '2rem' }}>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h2 style={{ ...styles.sectionTitle, fontSize: '1.4rem', margin: 0 }}>📊 Weekly Intelligence</h2>
                    <p style={{ margin: '0.25rem 0 0', color: '#6b7280', fontSize: '0.875rem' }}>
                      Comparing this audit against previous baselines.
                    </p>
                  </div>

                  {loadingComparison ? (
                    <p style={{ color: '#6b7280' }}>Loading comparison details...</p>
                  ) : !activeUrlReport ? (
                    <p style={{ color: '#6b7280' }}>No comparison data available.</p>
                  ) : !activeUrlReport.hasEnoughData ? (
                    <div style={styles.insufficientDataCard}>
                      <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: 600 }}>Insufficient Data</h3>
                      <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
                        Need at least two successful audits to analyze changes.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                      <ScoreComparisonCards
                        metrics={{
                          performanceScore: activeUrlReport.metrics!.performanceScore,
                          accessibilityScore: activeUrlReport.metrics!.accessibilityScore,
                          seoScore: activeUrlReport.metrics!.seoScore,
                          bestPracticesScore: activeUrlReport.metrics!.bestPracticesScore,
                        }}
                      />
                      <div style={styles.twoColumnGrid}>
                        <VitalsComparisonTable
                          metrics={{
                            lcp: activeUrlReport.metrics!.lcp,
                            cls: activeUrlReport.metrics!.cls,
                            inpOrTbt: activeUrlReport.metrics!.inpOrTbt,
                            fcp: activeUrlReport.metrics!.fcp,
                            ttfb: activeUrlReport.metrics!.ttfb,
                          }}
                        />
                        <TrendChart historicalRuns={activeUrlReport.historicalRuns} />
                      </div>
                      <AiInsightPanel
                        projectId={audit.projectId}
                        projectUrlId={activeUrlReport.projectUrlId}
                        latestRunId={activeUrlReport.historicalRuns[activeUrlReport.historicalRuns.length - 1]?.id}
                        previousRunId={activeUrlReport.historicalRuns[activeUrlReport.historicalRuns.length - 2]?.id}
                        initialAiInsight={activeUrlReport.aiInsight}
                      />
                      <RegressionList
                        regressions={activeUrlReport.regressions}
                        improvements={activeUrlReport.improvements}
                      />
                      <OpportunityDiffList
                        opportunities={{
                          new: activeUrlReport.opportunities.new,
                          resolved: activeUrlReport.opportunities.resolved,
                        }}
                      />
                      {activeUrlReport.recommendations && activeUrlReport.recommendations.length > 0 && (
                        <DeterministicRecommendationList recommendations={activeUrlReport.recommendations} />
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {activeTab === 'official' && (
              <div style={styles.iframeWrapper}>
                <iframe 
                  src={`/api/audits/${audit.id}/html`} 
                  style={styles.iframe} 
                  title="Lighthouse Official HTML Report"
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: '1100px', margin: '0 auto', padding: '2rem', fontFamily: 'system-ui, sans-serif' },
  breadcrumb: { display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1.5rem', fontSize: '0.875rem' },
  back: { color: '#6b7280', textDecoration: 'none' },
  sep: { color: '#d1d5db' },
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' },
  title: { margin: '0 0 0.25rem', fontSize: '1.5rem', fontWeight: 700, color: '#111827' },
  urlLink: { color: '#2563eb', textDecoration: 'none', fontSize: '0.9rem', wordBreak: 'break-all', fontWeight: 500 },
  failedBadge: { background: '#fee2e2', color: '#991b1b', padding: '0.3rem 0.75rem', borderRadius: '6px', fontSize: '0.875rem', fontWeight: 600 },
  rerunBtn: { background: '#f3f4f6', color: '#374151', padding: '0.4rem 0.9rem', borderRadius: '6px', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500, border: '1px solid #e5e7eb', transition: 'background 0.2s' },
  deviceTabContainer: {
    display: 'flex',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    backgroundColor: '#f1f5f9',
    padding: '3px',
    alignSelf: 'flex-start',
    width: 'fit-content',
    marginBottom: '1.5rem',
  },
  deviceTab: {
    display: 'flex',
    alignItems: 'center',
    padding: '0.4rem 1.2rem',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    fontSize: '0.875rem',
    color: '#64748b',
    fontWeight: 600,
    borderRadius: '6px',
    transition: 'all 0.2s',
  },
  deviceTabActive: {
    backgroundColor: '#fff',
    color: '#0f172a',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)',
  },
  errorBox: { background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '1.25rem', color: '#991b1b', fontWeight: 500 },
  tabContainer: {
    display: 'flex',
    borderBottom: '2px solid #e5e7eb',
    gap: '2.5rem',
    marginBottom: '1rem'
  },
  tabBtn: {
    background: 'none',
    border: 'none',
    borderBottom: '3px solid transparent',
    padding: '0.75rem 0',
    fontSize: '1rem',
    fontWeight: 600,
    color: '#6b7280',
    cursor: 'pointer',
    transition: 'all 0.2s',
    marginBottom: '-2px'
  },
  activeTab: {
    color: '#2563eb',
    borderBottomColor: '#2563eb'
  },
  scoresGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2.5rem' },
  scoreCard: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1.5rem', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  section: { marginBottom: '3rem' },
  sectionTitle: { margin: '0 0 1.25rem', fontSize: '1.2rem', fontWeight: 600, color: '#111827' },
  vitalsGrid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem' },
  vitalCard: { borderRadius: '12px', padding: '1.25rem', textAlign: 'center', border: '1px solid rgba(0,0,0,0.05)' },
  opportunitiesTable: { border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' },
  oppRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid #f3f4f6', gap: '1rem' },
  savingsBadge: { display: 'inline-flex', alignItems: 'center', background: '#d1fae5', color: '#065f46', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600 },
  aiSummaryHeader: { display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' },
  aiIconWrapper: { background: '#ede9fe', padding: '0.5rem', borderRadius: '8px', display: 'flex' },
  aiSummaryContainer: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem 2rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)' },
  markdownH1: { margin: '0 0 1rem', fontSize: '1.25rem', color: '#1e293b', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' },
  markdownH2: { margin: '1.5rem 0 0.75rem', fontSize: '1.1rem', color: '#334155', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' },
  markdownP: { margin: '0.5rem 0', fontSize: '0.95rem', color: '#475569', lineHeight: 1.6 },
  markdownList: { margin: '0.5rem 0 1.5rem', paddingLeft: '1.5rem', color: '#475569' },
  markdownListItem: { margin: '0.4rem 0', lineHeight: 1.6, fontSize: '0.95rem' },
  agentSectionHeader: { marginBottom: '1.25rem' },
  agentSectionDesc: { margin: '0.5rem 0 0', fontSize: '0.9rem', color: '#6b7280', maxWidth: '700px', lineHeight: 1.5 },
  insufficientDataCard: { padding: "2rem", backgroundColor: "#f9fafb", border: "1px dashed #d1d5db", borderRadius: "12px", textAlign: "center" },
  twoColumnGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "1.5rem" },
  iframeWrapper: { width: '100%', height: 'calc(100vh - 200px)', minHeight: '800px', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' },
  iframe: { width: '100%', height: '100%', border: 'none', backgroundColor: '#fff' }
};
