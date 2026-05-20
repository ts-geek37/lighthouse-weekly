import React, { useMemo, useState } from 'react';
import { NetworkRequestItem } from '@/types';

export function NetworkWaterfall({ requests }: { requests: NetworkRequestItem[] }) {
  const [filter, setFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'startTime' | 'duration' | 'transferSize'>('startTime');

  const filteredRequests = useMemo(() => {
    let list = requests.filter(req => req.url && !req.url.startsWith('data:'));
    if (filter !== 'all') {
      if (filter === 'script') list = list.filter(r => r.resourceType === 'Script' || r.mimeType.includes('javascript'));
      else if (filter === 'image') list = list.filter(r => r.resourceType === 'Image' || r.mimeType.includes('image'));
      else if (filter === 'stylesheet') list = list.filter(r => r.resourceType === 'Stylesheet' || r.mimeType.includes('css'));
      else if (filter === 'font') list = list.filter(r => r.resourceType === 'Font' || r.mimeType.includes('font'));
    }
    
    return list.sort((a, b) => {
      if (sortBy === 'startTime') return a.startTime - b.startTime;
      if (sortBy === 'duration') return (b.endTime - b.startTime) - (a.endTime - a.startTime);
      if (sortBy === 'transferSize') return b.transferSize - a.transferSize;
      return 0;
    });
  }, [requests, filter, sortBy]);

  const maxEndTime = useMemo(() => {
    return Math.max(...requests.map(r => r.endTime), 1);
  }, [requests]);

  const minStartTime = useMemo(() => {
    return Math.min(...requests.filter(r => r.startTime > 0).map(r => r.startTime), 0);
  }, [requests]);

  const durationScale = maxEndTime - minStartTime;

  if (!requests || requests.length === 0) return null;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Network Waterfall</h3>
        <div style={styles.controls}>
          <select value={filter} onChange={e => setFilter(e.target.value)} style={styles.select}>
            <option value="all">All Types</option>
            <option value="script">Scripts</option>
            <option value="image">Images</option>
            <option value="stylesheet">Stylesheets</option>
            <option value="font">Fonts</option>
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} style={styles.select}>
            <option value="startTime">Sort by Start Time</option>
            <option value="duration">Sort by Duration</option>
            <option value="transferSize">Sort by Size</option>
          </select>
        </div>
      </div>

      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{...styles.th, width: '35%'}}>URL</th>
              <th style={{...styles.th, width: '10%'}}>Type</th>
              <th style={{...styles.th, width: '10%'}}>Size</th>
              <th style={{...styles.th, width: '10%'}}>Time</th>
              <th style={{...styles.th, width: '35%'}}>Timeline</th>
            </tr>
          </thead>
          <tbody>
            {filteredRequests.map((req, i) => {
              const reqDuration = Math.max((req.endTime - req.startTime) * 1000, 1); // ms
              const leftPct = Math.max(0, ((req.startTime - minStartTime) / durationScale) * 100);
              const widthPct = Math.max(0.5, ((req.endTime - req.startTime) / durationScale) * 100);
              const urlParts = req.url.split('/');
              const filename = urlParts[urlParts.length - 1] || req.url;

              return (
                <tr key={i} style={styles.tr}>
                  <td style={styles.td} title={req.url}>
                    <div style={styles.truncate}>{filename}</div>
                  </td>
                  <td style={styles.td}>{req.resourceType || req.mimeType.split('/')[1] || 'Unknown'}</td>
                  <td style={styles.td}>{(req.transferSize / 1024).toFixed(1)} KB</td>
                  <td style={styles.td}>{Math.round(reqDuration)} ms</td>
                  <td style={styles.td}>
                    <div style={styles.timelineTrack}>
                      <div 
                        style={{
                          ...styles.timelineBar, 
                          left: `${leftPct}%`, 
                          width: `${widthPct}%`,
                          backgroundColor: getBarColor(req.resourceType || req.mimeType)
                        }} 
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredRequests.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                  No requests match the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function getBarColor(type: string): string {
  const t = type.toLowerCase();
  if (t.includes('script')) return '#f59e0b'; // amber
  if (t.includes('image')) return '#3b82f6'; // blue
  if (t.includes('style') || t.includes('css')) return '#10b981'; // green
  if (t.includes('font')) return '#8b5cf6'; // purple
  if (t.includes('document')) return '#ef4444'; // red
  return '#9ca3af'; // gray
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '1.5rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    marginBottom: '2rem'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.25rem',
    flexWrap: 'wrap',
    gap: '1rem'
  },
  title: {
    margin: 0,
    fontSize: '1.2rem',
    fontWeight: 600,
    color: '#111827'
  },
  controls: {
    display: 'flex',
    gap: '0.75rem'
  },
  select: {
    padding: '0.4rem 0.75rem',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    background: '#f9fafb',
    fontSize: '0.875rem',
    color: '#374151',
    outline: 'none',
    cursor: 'pointer'
  },
  tableWrapper: {
    overflowX: 'auto',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.875rem',
    minWidth: '700px'
  },
  th: {
    background: '#f9fafb',
    padding: '0.75rem 1rem',
    textAlign: 'left',
    fontWeight: 600,
    color: '#4b5563',
    borderBottom: '1px solid #e5e7eb'
  },
  tr: {
    borderBottom: '1px solid #f3f4f6',
  },
  td: {
    padding: '0.75rem 1rem',
    color: '#374151',
    verticalAlign: 'middle'
  },
  truncate: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '300px'
  },
  timelineTrack: {
    position: 'relative',
    height: '16px',
    background: '#f3f4f6',
    borderRadius: '4px',
    width: '100%'
  },
  timelineBar: {
    position: 'absolute',
    height: '100%',
    borderRadius: '4px',
    minWidth: '2px',
    transition: 'all 0.2s'
  }
};
