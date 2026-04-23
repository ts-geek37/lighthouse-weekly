import React from 'react';

interface ScoreBadgeProps {
  score: number | null;
  size?: 'sm' | 'md' | 'lg';
}

function getScoreColor(score: number | null): { bg: string; text: string } {
  if (score === null) return { bg: '#f3f4f6', text: '#6b7280' };
  if (score >= 90) return { bg: '#d1fae5', text: '#065f46' };
  if (score >= 50) return { bg: '#fef3c7', text: '#92400e' };
  return { bg: '#fee2e2', text: '#991b1b' };
}

export function ScoreBadge({ score, size = 'md' }: ScoreBadgeProps) {
  const { bg, text } = getScoreColor(score);
  const fontSize = size === 'lg' ? '1.5rem' : size === 'sm' ? '0.75rem' : '1rem';
  const padding = size === 'lg' ? '0.5rem 1rem' : size === 'sm' ? '0.15rem 0.4rem' : '0.25rem 0.6rem';
  const minWidth = size === 'lg' ? '64px' : size === 'sm' ? '36px' : '48px';

  return (
    <span style={{
      display: 'inline-block',
      background: bg,
      color: text,
      fontWeight: 700,
      fontSize,
      padding,
      borderRadius: '6px',
      minWidth,
      textAlign: 'center',
    }}>
      {score !== null ? score : 'N/A'}
    </span>
  );
}
