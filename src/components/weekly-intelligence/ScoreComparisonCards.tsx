import React from "react";
import { MetricChange } from "@/lib/comparison/comparisonTypes";

interface ScoreComparisonCardsProps {
  metrics: {
    performanceScore: MetricChange;
    accessibilityScore: MetricChange;
    seoScore: MetricChange;
    bestPracticesScore: MetricChange;
  };
}

export function ScoreComparisonCards({ metrics }: ScoreComparisonCardsProps) {
  const cards = [
    { key: "performanceScore", data: metrics.performanceScore },
    { key: "accessibilityScore", data: metrics.accessibilityScore },
    { key: "seoScore", data: metrics.seoScore },
    { key: "bestPracticesScore", data: metrics.bestPracticesScore },
  ];

  function getStatusStyle(status: string) {
    switch (status) {
      case "improved":
        return { color: "#059669", bg: "#ecfdf5" }; // green
      case "regressed":
        return { color: "#d97706", bg: "#fffbeb" }; // amber
      case "critical":
        return { color: "#dc2626", bg: "#fef2f2" }; // red
      default:
        return { color: "#4b5563", bg: "#f3f4f6" }; // gray
    }
  }

  return (
    <div style={styles.grid}>
      {cards.map(({ key, data }) => {
        const { color, bg } = getStatusStyle(data.status);
        const delta = data.delta || 0;
        const deltaText = delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : "Stable";
        const arrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "•";

        return (
          <div key={key} style={styles.card}>
            <div style={styles.header}>
              <span style={styles.label}>{data.label}</span>
              <span
                style={{
                  ...styles.badge,
                  color,
                  backgroundColor: bg,
                }}
              >
                {arrow} {deltaText}
              </span>
            </div>
            <div style={styles.scoreRow}>
              <div style={styles.scoreCol}>
                <span style={styles.scoreLabel}>Current</span>
                <span style={{ ...styles.scoreVal, color: getScoreValColor(data.current) }}>
                  {data.current !== null ? Math.round(data.current) : "N/A"}
                </span>
              </div>
              <div style={styles.divider} />
              <div style={styles.scoreCol}>
                <span style={styles.scoreLabel}>Previous</span>
                <span style={styles.prevVal}>
                  {data.previous !== null ? Math.round(data.previous) : "N/A"}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getScoreValColor(score: number | null): string {
  if (score === null) return "#6b7280";
  if (score >= 90) return "#059669";
  if (score >= 50) return "#d97706";
  return "#dc2626";
}

const styles: Record<string, React.CSSProperties> = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "1rem",
    marginBottom: "1.5rem",
  },
  card: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "1rem",
    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "1rem",
  },
  label: {
    fontSize: "0.875rem",
    fontWeight: 600,
    color: "#4b5563",
  },
  badge: {
    fontSize: "0.75rem",
    fontWeight: 600,
    padding: "0.15rem 0.5rem",
    borderRadius: "9999px",
    display: "inline-flex",
    alignItems: "center",
    gap: "0.25rem",
  },
  scoreRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
  },
  scoreCol: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
  },
  scoreLabel: {
    fontSize: "0.7rem",
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: "0.2rem",
  },
  scoreVal: {
    fontSize: "1.5rem",
    fontWeight: 700,
  },
  prevVal: {
    fontSize: "1.25rem",
    fontWeight: 600,
    color: "#6b7280",
  },
  divider: {
    width: "1px",
    height: "28px",
    backgroundColor: "#e5e7eb",
  },
};
