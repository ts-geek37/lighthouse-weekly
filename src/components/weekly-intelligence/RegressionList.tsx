import React from "react";
import { RegressionItem, ImprovementItem } from "@/lib/comparison/comparisonTypes";

interface RegressionListProps {
  regressions: RegressionItem[];
  improvements: ImprovementItem[];
}

export function RegressionList({ regressions, improvements }: RegressionListProps) {
  function getSeverityBadge(severity: string) {
    let color = "#4b5563";
    let bg = "#f3f4f6";
    if (severity === "high") {
      color = "#991b1b";
      bg = "#fee2e2";
    } else if (severity === "medium") {
      color = "#92400e";
      bg = "#fef3c7";
    }

    return (
      <span
        style={{
          display: "inline-block",
          padding: "0.1rem 0.4rem",
          borderRadius: "4px",
          fontSize: "0.7rem",
          fontWeight: 700,
          color,
          backgroundColor: bg,
          textTransform: "uppercase",
        }}
      >
        {severity} Severity
      </span>
    );
  }

  function getConfidenceBadge(confidence: string) {
    let color = "#047857";
    let border = "1px solid #a7f3d0";
    if (confidence === "low") {
      color = "#6b7280";
      border = "1px solid #e5e7eb";
    } else if (confidence === "medium") {
      color = "#b45309";
      border = "1px solid #fde68a";
    }

    return (
      <span
        style={{
          display: "inline-block",
          padding: "0.08rem 0.35rem",
          borderRadius: "4px",
          fontSize: "0.65rem",
          fontWeight: 600,
          color,
          border,
          backgroundColor: "#fff",
        }}
      >
        Confidence: {confidence.toUpperCase()}
      </span>
    );
  }

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>Regression & Improvement Log</h3>
      
      {/* Regressions Section */}
      <div style={styles.section}>
        <h4 style={{ ...styles.subtitle, color: "#991b1b" }}>Detected Regressions ({regressions.length})</h4>
        {regressions.length === 0 ? (
          <p style={styles.emptyText}>No performance regressions detected this week. Excellent!</p>
        ) : (
          <div style={styles.list}>
            {regressions.map((r, i) => (
              <div key={i} style={styles.regressionCard}>
                <div style={styles.cardHeader}>
                  <strong style={styles.cardTitle}>{r.label}</strong>
                  <div style={styles.badgeRow}>
                    {getSeverityBadge(r.severity)}
                    {getConfidenceBadge(r.confidence)}
                  </div>
                </div>
                <p style={styles.message}>{r.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Improvements Section */}
      <div style={{ ...styles.section, marginTop: "1.5rem" }}>
        <h4 style={{ ...styles.subtitle, color: "#065f46" }}>Detected Improvements ({improvements.length})</h4>
        {improvements.length === 0 ? (
          <p style={styles.emptyText}>No significant improvements detected this week.</p>
        ) : (
          <ul style={styles.bulletList}>
            {improvements.map((imp, i) => (
              <li key={i} style={styles.bulletItem}>
                <strong style={{ color: "#065f46" }}>{imp.label}:</strong> {imp.message}
              </li>
            ))}
          </ul>
        )}
      </div>
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
  title: {
    margin: "0 0 1.25rem",
    fontSize: "1rem",
    fontWeight: 600,
    color: "#111827",
  },
  section: {
    display: "flex",
    flexDirection: "column",
  },
  subtitle: {
    margin: "0 0 0.75rem",
    fontSize: "0.875rem",
    fontWeight: 600,
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  regressionCard: {
    borderLeft: "4px solid #ef4444",
    backgroundColor: "#fef2f2",
    padding: "0.75rem 1rem",
    borderRadius: "0 6px 6px 0",
    borderTop: "1px solid #fecaca",
    borderRight: "1px solid #fecaca",
    borderBottom: "1px solid #fecaca",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: "0.5rem",
    marginBottom: "0.4rem",
  },
  cardTitle: {
    fontSize: "0.85rem",
    color: "#7f1d1d",
  },
  badgeRow: {
    display: "flex",
    gap: "0.35rem",
    alignItems: "center",
  },
  message: {
    margin: 0,
    fontSize: "0.85rem",
    color: "#7f1d1d",
  },
  emptyText: {
    margin: 0,
    fontSize: "0.85rem",
    color: "#6b7280",
    padding: "0.5rem 0",
  },
  bulletList: {
    margin: 0,
    paddingLeft: "1.25rem",
  },
  bulletItem: {
    fontSize: "0.85rem",
    color: "#374151",
    marginBottom: "0.4rem",
  },
};
