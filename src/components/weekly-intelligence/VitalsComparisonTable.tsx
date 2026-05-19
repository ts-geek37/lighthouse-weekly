import React from "react";
import { MetricChange } from "@/lib/comparison/comparisonTypes";

interface VitalsComparisonTableProps {
  metrics: {
    lcp: MetricChange;
    cls: MetricChange;
    inpOrTbt: MetricChange;
    fcp: MetricChange;
    ttfb: MetricChange;
  };
}

export function VitalsComparisonTable({ metrics }: VitalsComparisonTableProps) {
  const keys = ["lcp", "cls", "inpOrTbt", "fcp", "ttfb"];
  
  const sortedVitals = keys
    .map((k) => metrics[k as keyof typeof metrics])
    .filter(Boolean)
    .sort((a, b) => {
      const statusOrder = { critical: 0, regressed: 1, stable: 2, improved: 3 };
      return statusOrder[a.status] - statusOrder[b.status];
    });

  function getStatusBadge(status: string) {
    let color = "#4b5563";
    let bg = "#f3f4f6";
    let text = "Stable";

    if (status === "improved") {
      color = "#047857";
      bg = "#d1fae5";
      text = "Improved";
    } else if (status === "regressed") {
      color = "#b45309";
      bg = "#fef3c7";
      text = "Regressed";
    } else if (status === "critical") {
      color = "#b91c1c";
      bg = "#fee2e2";
      text = "Critical";
    }

    return (
      <span
        style={{
          display: "inline-block",
          padding: "0.15rem 0.5rem",
          borderRadius: "4px",
          fontSize: "0.75rem",
          fontWeight: 600,
          color,
          backgroundColor: bg,
        }}
      >
        {text}
      </span>
    );
  }

  function formatVal(val: number | null, key: string): string {
    if (val === null) return "N/A";
    if (key === "cls") return val.toFixed(3);
    return `${Math.round(val)}ms`;
  }

  function formatDelta(delta: number | null, key: string, status: string): string {
    if (delta === null || status === "stable") return "—";
    const sign = delta > 0 ? "+" : "";
    if (key === "cls") return `${sign}${delta.toFixed(3)}`;
    return `${sign}${Math.round(delta)}ms`;
  }

  return (
    <div style={styles.container}>
      <h3 style={styles.tableTitle}>Core Web Vitals Comparison</h3>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Metric</th>
            <th style={styles.th}>Previous Week</th>
            <th style={styles.th}>Current Week</th>
            <th style={styles.th}>Delta</th>
            <th style={styles.th}>Change %</th>
            <th style={styles.th}>Status</th>
          </tr>
        </thead>
        <tbody>
          {sortedVitals.map((v) => {
            const pct = v.percentage;
            const pctStr = pct !== null && v.status !== "stable" ? `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%` : "—";
            return (
              <tr key={v.metric} style={styles.tr}>
                <td style={{ ...styles.td, fontWeight: 600, color: "#111827" }}>{v.label}</td>
                <td style={styles.td}>{formatVal(v.previous, v.metric)}</td>
                <td style={styles.td}>{formatVal(v.current, v.metric)}</td>
                <td style={{ 
                  ...styles.td, 
                  fontWeight: 500,
                  color: v.status === "improved" ? "#059669" : v.status === "regressed" || v.status === "critical" ? "#dc2626" : "#4b5563" 
                }}>
                  {formatDelta(v.delta, v.metric, v.status)}
                </td>
                <td style={{ 
                  ...styles.td, 
                  color: v.status === "improved" ? "#059669" : v.status === "regressed" || v.status === "critical" ? "#dc2626" : "#4b5563" 
                }}>
                  {pctStr}
                </td>
                <td style={styles.td}>{getStatusBadge(v.status)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
  tableTitle: {
    margin: "0 0 1rem",
    fontSize: "1rem",
    fontWeight: 600,
    color: "#111827",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    padding: "0.6rem 0.75rem",
    borderBottom: "2px solid #e5e7eb",
    fontWeight: 600,
    fontSize: "0.7rem",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    backgroundColor: "#f9fafb",
  },
  tr: {
    borderBottom: "1px solid #f3f4f6",
  },
  td: {
    padding: "0.75rem",
    fontSize: "0.85rem",
    color: "#374151",
    verticalAlign: "middle",
  },
};
