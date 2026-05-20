import React from 'react';
import { ScreenshotThumbnailItem } from '@/types';

export function FilmstripViewer({ thumbnails }: { thumbnails: ScreenshotThumbnailItem[] }) {
  if (!thumbnails || thumbnails.length === 0) return null;

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>Visual Loading Progression (Filmstrip)</h3>
      <div style={styles.scrollWrapper}>
        <div style={styles.strip}>
          {thumbnails.map((thumb, idx) => (
            <div key={idx} style={styles.frame}>
              <div style={styles.imgWrapper}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumb.data} alt={`Frame at ${thumb.timing}ms`} style={styles.img} />
              </div>
              <div style={styles.timing}>{thumb.timing}ms</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    marginBottom: '2rem',
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '1.5rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
  },
  title: {
    margin: '0 0 1.25rem',
    fontSize: '1.1rem',
    fontWeight: 600,
    color: '#111827'
  },
  scrollWrapper: {
    overflowX: 'auto',
    paddingBottom: '1rem',
    scrollbarWidth: 'thin',
    scrollbarColor: '#cbd5e1 transparent'
  },
  strip: {
    display: 'flex',
    gap: '1rem',
    alignItems: 'flex-start',
    minWidth: 'min-content'
  },
  frame: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.5rem',
    width: '120px'
  },
  imgWrapper: {
    width: '100%',
    aspectRatio: '9/16',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    overflow: 'hidden',
    background: '#f9fafb',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
  },
  img: {
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  },
  timing: {
    fontSize: '0.8rem',
    color: '#6b7280',
    fontWeight: 500,
    fontFamily: 'monospace'
  }
};
