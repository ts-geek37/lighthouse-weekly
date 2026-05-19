import React from "react";
import { Opportunity } from "@/types";

interface OpportunityDiffListProps {
  opportunities: {
    new: Opportunity[];
    resolved: Opportunity[];
  };
}

export function OpportunityDiffList({ opportunities }: OpportunityDiffListProps) {
  function formatSavings(opp: Opportunity): string {
    const savings: string[] = [];
    if (opp.savingsMs && opp.savingsMs > 0) {
      savings.push(`${opp.savingsMs}ms`);
    }
    if (opp.savingsBytes && opp.savingsBytes > 0) {
      savings.push(`${Math.round(opp.savingsBytes / 1024)}KB`);
    }
    return savings.length > 0 ? `Estimated savings: ${savings.join(", ")}` : "No quantified savings";
  }

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>Lighthouse Opportunities Diff</h3>
      <div style={styles.grid}>
        {/* New Opportunities */}
        <div style={styles.column}>
          <h4 style={{ ...styles.subtitle, color: "#dc2626" }}>
            New Flags ({opportunities.new.length})
          </h4>
          <p style={styles.description}>Optimizations flagged in current run that were absent last week.</p>
          {opportunities.new.length === 0 ? (
            <p style={styles.emptyText}>No new opportunities flagged. Great job keeping the codebase clean!</p>
          ) : (
            <div style={styles.list}>
              {opportunities.new.map((opp) => (
                <div key={opp.id} style={styles.cardNew}>
                  <strong style={styles.oppTitle}>{opp.title}</strong>
                  <span style={styles.savingsBadgeNew}>{formatSavings(opp)}</span>
                  <p style={styles.oppDesc}>{opp.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Resolved Opportunities */}
        <div style={styles.column}>
          <h4 style={{ ...styles.subtitle, color: "#16a34a" }}>
            Resolved Opportunities ({opportunities.resolved.length})
          </h4>
          <p style={styles.description}>Optimizations solved since last week's audit.</p>
          {opportunities.resolved.length === 0 ? (
            <p style={styles.emptyText}>No previously flagged opportunities were resolved this week.</p>
          ) : (
            <div style={styles.list}>
              {opportunities.resolved.map((opp) => (
                <div key={opp.id} style={styles.cardResolved}>
                  <strong style={{ ...styles.oppTitle, color: "#14532d" }}>{opp.title}</strong>
                  <span style={styles.savingsBadgeResolved}>Fixed</span>
                  <p style={{ ...styles.oppDesc, color: "#166534" }}>{opp.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
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
    margin: "0 0 1rem",
    fontSize: "1rem",
    fontWeight: 600,
    color: "#111827",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "1.5rem",
  },
  column: {
    display: "flex",
    flexDirection: "column",
  },
  subtitle: {
    margin: "0 0 0.25rem",
    fontSize: "0.875rem",
    fontWeight: 600,
  },
  description: {
    margin: "0 0 0.75rem",
    fontSize: "0.75rem",
    color: "#6b7280",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  cardNew: {
    backgroundColor: "#fffafb",
    border: "1px solid #fee2e2",
    borderRadius: "6px",
    padding: "0.75rem",
  },
  cardResolved: {
    backgroundColor: "#f0fdf4",
    border: "1px solid #dcfce7",
    borderRadius: "6px",
    padding: "0.75rem",
  },
  oppTitle: {
    display: "block",
    fontSize: "0.8rem",
    color: "#991b1b",
    marginBottom: "0.25rem",
  },
  savingsBadgeNew: {
    display: "inline-block",
    fontSize: "0.7rem",
    fontWeight: 600,
    color: "#991b1b",
    backgroundColor: "#fee2e2",
    padding: "0.1rem 0.35rem",
    borderRadius: "4px",
    marginBottom: "0.5rem",
  },
  savingsBadgeResolved: {
    display: "inline-block",
    fontSize: "0.7rem",
    fontWeight: 600,
    color: "#166534",
    backgroundColor: "#dcfce7",
    padding: "0.1rem 0.35rem",
    borderRadius: "4px",
    marginBottom: "0.5rem",
  },
  oppDesc: {
    margin: 0,
    fontSize: "0.75rem",
    color: "#7f1d1d",
    lineHeight: "1.35",
  },
  emptyText: {
    margin: 0,
    fontSize: "0.8rem",
    color: "#6b7280",
    padding: "0.75rem",
    backgroundColor: "#f9fafb",
    borderRadius: "6px",
    border: "1px dashed #e5e7eb",
    textAlign: "center",
  },
};
