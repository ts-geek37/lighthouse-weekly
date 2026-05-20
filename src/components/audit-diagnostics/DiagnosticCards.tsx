import React from 'react';
import { AdvancedDiagnostics } from '@/types';

export function DiagnosticCards({ diagnostics }: { diagnostics: AdvancedDiagnostics }) {
  if (!diagnostics) return null;

  return (
    <div style={styles.grid}>
      {/* Mainthread Work Breakdown */}
      {diagnostics.mainthreadWorkBreakdown && diagnostics.mainthreadWorkBreakdown.length > 0 && (
        <Card title="Main-thread Work Breakdown">
          <ul style={styles.list}>
            {diagnostics.mainthreadWorkBreakdown.slice(0, 5).map((item, i) => (
              <li key={i} style={styles.listItem}>
                <span style={styles.itemLabel}>{item.groupLabel}</span>
                <span style={styles.itemValue}>{Math.round(item.duration)} ms</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Bootup Time */}
      {diagnostics.bootupTime && diagnostics.bootupTime.length > 0 && (
        <Card title="JavaScript Bootup Time">
          <ul style={styles.list}>
            {diagnostics.bootupTime.slice(0, 5).map((item, i) => {
              const urlParts = item.url.split('/');
              const filename = urlParts[urlParts.length - 1] || item.url;
              return (
                <li key={i} style={styles.listItem}>
                  <span style={styles.itemLabel} title={item.url}>{filename}</span>
                  <span style={styles.itemValue}>{Math.round(item.total)} ms</span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {/* Third Party Summary */}
      {diagnostics.thirdPartySummary && diagnostics.thirdPartySummary.length > 0 && (
        <Card title="Third-Party Summary">
          <ul style={styles.list}>
            {diagnostics.thirdPartySummary.slice(0, 5).map((item, i) => (
              <li key={i} style={styles.listItem}>
                <span style={styles.itemLabel}>{item.entityName}</span>
                <span style={styles.itemValue}>
                  {Math.round(item.transferSize / 1024)} KB 
                  <span style={{color: '#9ca3af', fontSize: '0.75rem', marginLeft: '4px'}}>
                    ({Math.round(item.blockingTime)}ms block)
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* LCP Element */}
      {diagnostics.lcpElement && (
        <Card title="Largest Contentful Paint Element">
          <div style={styles.codeBlock}>
            <code>{diagnostics.lcpElement.snippet || diagnostics.lcpElement.nodeLabel}</code>
          </div>
          {diagnostics.lcpElement.path && (
            <div style={styles.pathLabel}>Selector: {diagnostics.lcpElement.path}</div>
          )}
        </Card>
      )}

      {/* CLS Elements */}
      {diagnostics.layoutShiftElements && diagnostics.layoutShiftElements.length > 0 && (
        <Card title="Layout Shift Elements (CLS)">
          <ul style={styles.list}>
            {diagnostics.layoutShiftElements.map((item, i) => (
              <li key={i} style={{...styles.listItem, flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', width: '100%'}}>
                  <span style={styles.itemLabel}>Shift Score Contribution</span>
                  <span style={{...styles.itemValue, color: '#ef4444'}}>{item.score.toFixed(4)}</span>
                </div>
                <div style={{...styles.codeBlock, width: '100%', boxSizing: 'border-box'}}>
                  <code>{item.snippet || item.nodeLabel}</code>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* DOM Size */}
      {diagnostics.domSize !== null && (
        <Card title="DOM Size">
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#3b82f6', textAlign: 'center', padding: '1rem 0' }}>
            {diagnostics.domSize} <span style={{ fontSize: '1rem', color: '#6b7280', fontWeight: 500 }}>elements</span>
          </div>
          {diagnostics.domSize > 1500 && (
            <div style={{ fontSize: '0.875rem', color: '#ef4444', textAlign: 'center', background: '#fee2e2', padding: '0.5rem', borderRadius: '4px' }}>
              Warning: Exceeds recommended 1,500 elements
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={styles.card}>
      <h4 style={styles.cardTitle}>{title}</h4>
      <div style={styles.cardContent}>{children}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
    gap: '1.5rem',
    marginBottom: '2rem'
  },
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  cardTitle: {
    margin: 0,
    padding: '1rem 1.25rem',
    background: '#f9fafb',
    borderBottom: '1px solid #e5e7eb',
    fontSize: '1.05rem',
    fontWeight: 600,
    color: '#111827'
  },
  cardContent: {
    padding: '1.25rem',
    flex: 1
  },
  list: {
    margin: 0,
    padding: 0,
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem'
  },
  listItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '0.75rem',
    borderBottom: '1px solid #f3f4f6',
    fontSize: '0.875rem'
  },
  itemLabel: {
    color: '#374151',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '200px'
  },
  itemValue: {
    color: '#111827',
    fontWeight: 600,
    flexShrink: 0
  },
  codeBlock: {
    background: '#f1f5f9',
    padding: '0.75rem',
    borderRadius: '6px',
    fontSize: '0.8rem',
    fontFamily: 'monospace',
    color: '#0f172a',
    overflowX: 'auto',
    whiteSpace: 'nowrap',
    border: '1px solid #e2e8f0'
  },
  pathLabel: {
    marginTop: '0.75rem',
    fontSize: '0.8rem',
    color: '#64748b',
    fontFamily: 'monospace',
    wordBreak: 'break-all'
  }
};
