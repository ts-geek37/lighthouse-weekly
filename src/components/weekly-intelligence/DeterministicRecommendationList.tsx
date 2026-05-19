import React from "react";
import { DeterministicRecommendation } from "@/lib/comparison/comparisonTypes";

interface DeterministicRecommendationListProps {
  recommendations: DeterministicRecommendation[];
}

export function DeterministicRecommendationList({
  recommendations,
}: DeterministicRecommendationListProps) {
  function getPriorityBadge(priority: string) {
    let color = "#4b5563";
    let bg = "#f3f4f6";
    if (priority === "high") {
      color = "#991b1b";
      bg = "#fee2e2";
    } else if (priority === "medium") {
      color = "#92400e";
      bg = "#fef3c7";
    }

    return (
      <span
        style={{
          display: "inline-block",
          padding: "0.1rem 0.45rem",
          borderRadius: "4px",
          fontSize: "0.7rem",
          fontWeight: 700,
          color,
          backgroundColor: bg,
          textTransform: "uppercase",
          verticalAlign: "middle",
        }}
      >
        {priority} Priority
      </span>
    );
  }

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>Rule-Based Action Items</h3>
      {recommendations.length === 0 ? (
        <p style={styles.emptyText}>No recommendations required. All metrics are stable or improved!</p>
      ) : (
        <div style={styles.list}>
          {recommendations.map((rec, idx) => (
            <div key={idx} style={styles.item}>
              <div style={styles.itemHeader}>
                {getPriorityBadge(rec.priority)}
                <span style={styles.issueText}>{rec.issue}</span>
              </div>
              <ul style={styles.fixList}>
                {rec.suggestedFixes.map((fix, fIdx) => (
                  <li key={fIdx} style={styles.fixItem}>
                    <input type="checkbox" style={styles.checkbox} readOnly />
                    <span style={styles.fixText}>{fix}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
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
  title: {
    margin: "0 0 1rem",
    fontSize: "1rem",
    fontWeight: 600,
    color: "#111827",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "1.25rem",
  },
  item: {
    border: "1px solid #e5e7eb",
    borderRadius: "6px",
    padding: "1rem",
    backgroundColor: "#f9fafb",
  },
  itemHeader: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    marginBottom: "0.75rem",
    flexWrap: "wrap",
  },
  issueText: {
    fontSize: "0.85rem",
    fontWeight: 600,
    color: "#1f2937",
    flex: 1,
  },
  fixList: {
    margin: 0,
    padding: 0,
    listStyleType: "none",
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  fixItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: "0.5rem",
  },
  checkbox: {
    marginTop: "0.2rem",
    cursor: "default",
    pointerEvents: "none",
  },
  fixText: {
    fontSize: "0.8rem",
    color: "#4b5563",
    lineHeight: "1.4",
  },
  emptyText: {
    margin: 0,
    fontSize: "0.85rem",
    color: "#6b7280",
    padding: "0.5rem 0",
  },
};
