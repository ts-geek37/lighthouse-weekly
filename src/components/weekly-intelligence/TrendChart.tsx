import React from "react";

interface RunData {
  id: string;
  createdAt: Date | string;
  performanceScore: number | null;
  lcp: number | null;
  cls: number | null;
  inpOrTbt: number | null;
}

interface TrendChartProps {
  historicalRuns: RunData[];
}

export function TrendChart({ historicalRuns }: TrendChartProps) {
  if (historicalRuns.length < 2) {
    return (
      <div style={styles.container}>
        <h3 style={styles.title}>Historical Trends</h3>
        <p style={styles.emptyText}>Need at least 2 historical runs to visualize trend lines.</p>
      </div>
    );
  }

  // Helper to draw a single SVG sparkline
  function renderSparkline(
    title: string,
    key: "performanceScore" | "lcp" | "cls" | "inpOrTbt",
    color: string,
    formatter: (v: number) => string
  ) {
    const validPoints = historicalRuns
      .map((r, index) => ({
        val: r[key],
        date: new Date(r.createdAt),
        index,
      }))
      .filter((p) => p.val !== null && p.val !== undefined) as Array<{
      val: number;
      date: Date;
      index: number;
    }>;

    if (validPoints.length < 2) {
      return (
        <div style={styles.chartCard} key={key}>
          <strong style={styles.chartTitle}>{title}</strong>
          <p style={styles.chartEmpty}>Insufficient data for trend line</p>
        </div>
      );
    }

    const values = validPoints.map((p) => p.val);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const spread = maxVal - minVal || 1;

    // SVG Layout Constants
    const width = 220;
    const height = 60;
    const paddingY = 8;
    const paddedHeight = height - paddingY * 2;

    const points = validPoints.map((p, i) => {
      const x = (i / (validPoints.length - 1)) * width;
      // Flip Y axis since SVG 0 is top
      const y = height - paddingY - ((p.val - minVal) / spread) * paddedHeight;
      return { x, y, val: p.val };
    });

    const pointsString = points.map((p) => `${p.x},${p.y}`).join(" ");
    const lastPoint = points[points.length - 1];
    const latestVal = validPoints[validPoints.length - 1].val;

    return (
      <div style={styles.chartCard} key={key}>
        <div style={styles.chartHeader}>
          <strong style={styles.chartTitle}>{title}</strong>
          <span style={{ ...styles.latestBadge, color }}>{formatter(latestVal)}</span>
        </div>
        <div style={styles.svgWrapper}>
          <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
            {/* Background grid line */}
            <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="#f3f4f6" strokeWidth="1" strokeDasharray="3,3" />
            {/* Trend Polyline */}
            <polyline fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={pointsString} />
            {/* Latest point dot */}
            <circle cx={lastPoint.x} cy={lastPoint.y} r="4" fill={color} stroke="#fff" strokeWidth="1.5" />
          </svg>
        </div>
        <div style={styles.chartFooter}>
          <span style={styles.footerLabel}>Min: {formatter(minVal)}</span>
          <span style={styles.footerLabel}>Max: {formatter(maxVal)}</span>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>Historical Trends (Last {historicalRuns.length} Runs)</h3>
      <div style={styles.grid}>
        {renderSparkline("Performance Score", "performanceScore", "#2563eb", (v) => `${Math.round(v)}`)}
        {renderSparkline("Largest Contentful Paint", "lcp", "#ea580c", (v) => `${Math.round(v)}ms`)}
        {renderSparkline("Cumulative Layout Shift", "cls", "#db2777", (v) => v.toFixed(3))}
        {renderSparkline("INP / TBT Block Time", "inpOrTbt", "#7c3aed", (v) => `${Math.round(v)}ms`)}
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
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "1rem",
  },
  chartCard: {
    border: "1px solid #f3f4f6",
    borderRadius: "6px",
    padding: "0.75rem",
    backgroundColor: "#f9fafb",
  },
  chartHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "0.5rem",
  },
  chartTitle: {
    fontSize: "0.75rem",
    color: "#4b5563",
    fontWeight: 600,
  },
  latestBadge: {
    fontSize: "0.85rem",
    fontWeight: 700,
  },
  svgWrapper: {
    margin: "0.5rem 0",
  },
  chartFooter: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "0.65rem",
    color: "#9ca3af",
    marginTop: "0.25rem",
  },
  footerLabel: {
    fontFamily: "monospace",
  },
  emptyText: {
    fontSize: "0.85rem",
    color: "#6b7280",
    margin: 0,
  },
  chartEmpty: {
    fontSize: "0.75rem",
    color: "#9ca3af",
    textAlign: "center",
    padding: "1rem 0",
    margin: 0,
  },
};
