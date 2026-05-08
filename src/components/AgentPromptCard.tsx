'use client';

import { useState } from 'react';
import { AgentPrompt } from '@/types';

interface AgentPromptCardProps {
  prompt: AgentPrompt;
  index: number;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      style={styles.copyBtn}
    >
      {copied ? '✓ Copied' : 'Copy prompt'}
    </button>
  );
}

export function AgentPromptCard({ prompt, index }: AgentPromptCardProps) {
  const [expanded, setExpanded] = useState(index === 0);

  const savingsParts: string[] = [];
  if (prompt.savingsMs !== null && prompt.savingsMs !== 0) {
    savingsParts.push(`~${prompt.savingsMs}ms`);
  }
  if (prompt.savingsBytes !== null && prompt.savingsBytes !== 0) {
    savingsParts.push(`~${Math.round(prompt.savingsBytes / 1024)}KB`);
  }
  const savings = savingsParts.join(' / ');

  return (
    <div style={styles.agentCard}>
      <div style={styles.agentCardHeader} onClick={() => setExpanded(e => !e)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
          <span style={styles.priorityBadge}>#{prompt.rank}</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#111827' }}>
              {prompt.opportunityTitle}
            </div>
            {savings && (
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.1rem' }}>
                Estimated savings: {savings}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {expanded && <CopyButton text={prompt.prompt} />}
          <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div style={styles.agentCardBody}>
          <pre style={styles.promptPre}>{prompt.prompt}</pre>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  agentCard: { border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', background: '#fff' },
  agentCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', cursor: 'pointer', background: '#f9fafb', gap: '1rem' },
  agentCardBody: { padding: '0 1.25rem 1.25rem', borderTop: '1px solid #e5e7eb' },
  priorityBadge: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', background: '#2563eb', color: '#fff', borderRadius: '50%', fontSize: '0.8rem', fontWeight: 700, flexShrink: 0 },
  promptPre: { margin: '1rem 0 0', padding: '1rem', background: '#1e1e2e', color: '#cdd6f4', borderRadius: '6px', fontSize: '0.8rem', lineHeight: 1.7, overflowX: 'auto' as const, whiteSpace: 'pre-wrap' as const, wordBreak: 'break-word' as const },
  copyBtn: { padding: '0.3rem 0.75rem', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '5px', fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap' as const },
};
