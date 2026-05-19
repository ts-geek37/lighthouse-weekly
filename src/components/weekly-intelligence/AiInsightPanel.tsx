import React, { useState, useEffect } from "react";

interface AiInsightPanelProps {
  projectId: string;
  projectUrlId: string;
  latestRunId: string;
  previousRunId: string;
  initialAiInsight: string | null;
}

export function AiInsightPanel({
  projectId,
  projectUrlId,
  latestRunId,
  previousRunId,
  initialAiInsight,
}: AiInsightPanelProps) {
  const [insight, setInsight] = useState<string | null>(initialAiInsight);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setInsight(initialAiInsight);
    setError(null);

    if (!initialAiInsight && latestRunId && previousRunId) {
      setLoading(true);
      fetch(
        `/api/projects/${projectId}/weekly-intelligence/ai?projectUrlId=${projectUrlId}&latestRunId=${latestRunId}&previousRunId=${previousRunId}`
      )
        .then((res) => {
          if (!res.ok) {
            return res.json().then((errData) => {
              throw new Error(errData.error || "Failed to fetch AI insights");
            });
          }
          return res.json();
        })
        .then((data) => {
          setInsight(data.aiInsight);
          setLoading(false);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        });
    }
  }, [projectId, projectUrlId, latestRunId, previousRunId, initialAiInsight]);

  async function fetchInsight() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/weekly-intelligence/ai?projectUrlId=${projectUrlId}&latestRunId=${latestRunId}&previousRunId=${previousRunId}`
      );
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to fetch AI insights");
      }
      const data = await res.json();
      setInsight(data.aiInsight);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function formatMarkdown(text: string) {
    const lines = text.split("\n");
    return lines.map((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("## ")) {
        return (
          <h4 key={idx} style={styles.mdH2}>
            {trimmed.replace("## ", "")}
          </h4>
        );
      }
      if (trimmed.startsWith("# ")) {
        return (
          <h3 key={idx} style={styles.mdH1}>
            {trimmed.replace("# ", "")}
          </h3>
        );
      }
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        const cleanLine = trimmed.replace(/^[-*]\s+/, "");
        return (
          <div key={idx} style={styles.mdBullet}>
            <span style={styles.bulletDot}>•</span>
            <span style={styles.bulletText}>{cleanLine}</span>
          </div>
        );
      }
      if (trimmed === "") {
        return <div key={idx} style={styles.mdSpacer} />;
      }
      return (
        <p key={idx} style={styles.mdParagraph}>
          {line}
        </p>
      );
    });
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>⚡ AI Performance Intelligence</h3>
        {insight && !loading && (
          <button onClick={fetchInsight} style={styles.refreshBtn}>
            Regenerate
          </button>
        )}
      </div>

      {loading && (
        <div style={styles.loaderContainer}>
          <div style={styles.spinner} />
          <span style={styles.loadingText}>Running AI analysis on deltas...</span>
        </div>
      )}

      {error && (
        <div style={styles.errorContainer}>
          <p style={styles.errorText}>Error: {error}</p>
          <button onClick={fetchInsight} style={styles.retryBtn}>
            Retry Analysis
          </button>
        </div>
      )}

      {!insight && !loading && !error && (
        <div style={styles.emptyContainer}>
          <p style={styles.emptyText}>
            AI analysis has not been generated for this week's audit cycle yet.
          </p>
          <button onClick={fetchInsight} style={styles.generateBtn}>
            Analyze Performance Regressions
          </button>
        </div>
      )}

      {insight && !loading && (
        <div style={styles.content}>{formatMarkdown(insight)}</div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "1.25rem",
    marginBottom: "1.5rem",
    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "1rem",
  },
  title: {
    margin: 0,
    fontSize: "1rem",
    fontWeight: 600,
    color: "#111827",
  },
  refreshBtn: {
    background: "none",
    border: "none",
    color: "#2563eb",
    fontSize: "0.8rem",
    cursor: "pointer",
    fontWeight: 500,
    padding: 0,
    textDecoration: "underline",
  },
  loaderContainer: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    padding: "1.5rem",
    backgroundColor: "#f9fafb",
    borderRadius: "6px",
  },
  spinner: {
    width: "18px",
    height: "18px",
    border: "2px solid #e5e7eb",
    borderTopColor: "#2563eb",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  loadingText: {
    fontSize: "0.85rem",
    color: "#4b5563",
  },
  errorContainer: {
    padding: "1rem",
    backgroundColor: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: "6px",
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    alignItems: "flex-start",
  },
  errorText: {
    margin: 0,
    fontSize: "0.85rem",
    color: "#991b1b",
    fontWeight: 500,
  },
  retryBtn: {
    background: "#dc2626",
    color: "#fff",
    border: "none",
    padding: "0.35rem 0.75rem",
    borderRadius: "4px",
    fontSize: "0.8rem",
    cursor: "pointer",
  },
  emptyContainer: {
    padding: "2rem",
    backgroundColor: "#f9fafb",
    border: "1px dashed #d1d5db",
    borderRadius: "6px",
    textAlign: "center",
  },
  emptyText: {
    margin: "0 0 1rem",
    fontSize: "0.85rem",
    color: "#4b5563",
  },
  generateBtn: {
    background: "#2563eb",
    color: "#fff",
    border: "none",
    padding: "0.5rem 1rem",
    borderRadius: "6px",
    fontSize: "0.85rem",
    fontWeight: 500,
    cursor: "pointer",
    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
  },
  content: {
    fontSize: "0.9rem",
    color: "#374151",
    lineHeight: "1.6",
  },
  mdH1: {
    fontSize: "1.1rem",
    fontWeight: 700,
    color: "#111827",
    margin: "1rem 0 0.5rem",
  },
  mdH2: {
    fontSize: "0.95rem",
    fontWeight: 600,
    color: "#1f2937",
    margin: "1rem 0 0.4rem",
    borderBottom: "1px solid #f3f4f6",
    paddingBottom: "0.2rem",
  },
  mdParagraph: {
    margin: "0 0 0.5rem",
  },
  mdBullet: {
    display: "flex",
    alignItems: "flex-start",
    gap: "0.5rem",
    margin: "0.25rem 0",
  },
  bulletDot: {
    color: "#2563eb",
    fontWeight: "bold",
  },
  bulletText: {
    flex: 1,
  },
  mdSpacer: {
    height: "0.5rem",
  },
};
