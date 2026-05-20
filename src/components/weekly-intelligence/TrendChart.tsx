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

type TrendMetricKey = "performanceScore" | "lcp" | "cls" | "inpOrTbt";

interface SparklineConfig {
  title: string;
  key: TrendMetricKey;
  color: string;
  formatter: (value: number) => string;
}

const sparklineConfigs: SparklineConfig[] = [
  { title: "Performance Score", key: "performanceScore", color: "#2563eb", formatter: value => `${Math.round(value)}` },
  { title: "Largest Contentful Paint", key: "lcp", color: "#ea580c", formatter: value => `${Math.round(value)}ms` },
  { title: "Cumulative Layout Shift", key: "cls", color: "#db2777", formatter: value => value.toFixed(3) },
  { title: "INP / TBT Block Time", key: "inpOrTbt", color: "#7c3aed", formatter: value => `${Math.round(value)}ms` },
];

const Sparkline = ({ config, historicalRuns }: { config: SparklineConfig; historicalRuns: RunData[] }) => {
  const validPoints = historicalRuns
    .map((run, index) => ({
      val: run[config.key],
      date: new Date(run.createdAt),
      index,
    }))
    .filter((point): point is { val: number; date: Date; index: number } => point.val !== null && point.val !== undefined);

  if (validPoints.length < 2) {
    return (
      <div className="rounded-md border border-gray-100 bg-gray-50 p-3">
        <strong className="text-xs font-semibold text-gray-600">{config.title}</strong>
        <p className="m-0 py-4 text-center text-xs text-gray-400">Insufficient data for trend line</p>
      </div>
    );
  }

  const values = validPoints.map(point => point.val);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const spread = maxVal - minVal || 1;
  const width = 220;
  const height = 60;
  const paddingY = 8;
  const paddedHeight = height - paddingY * 2;
  const points = validPoints.map((point, index) => {
    const x = (index / (validPoints.length - 1)) * width;
    const y = height - paddingY - ((point.val - minVal) / spread) * paddedHeight;
    return { x, y, val: point.val };
  });
  const lastPoint = points[points.length - 1];
  const latestVal = validPoints[validPoints.length - 1].val;

  return (
    <div className="rounded-md border border-gray-100 bg-gray-50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <strong className="text-xs font-semibold text-gray-600">{config.title}</strong>
        <span className="text-sm font-bold" style={{ color: config.color }}>{config.formatter(latestVal)}</span>
      </div>
      <div className="my-2">
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="block">
          <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="#f3f4f6" strokeWidth="1" strokeDasharray="3,3" />
          <polyline fill="none" stroke={config.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={points.map(point => `${point.x},${point.y}`).join(" ")} />
          <circle cx={lastPoint.x} cy={lastPoint.y} r="4" fill={config.color} stroke="#fff" strokeWidth="1.5" />
        </svg>
      </div>
      <div className="mt-1 flex justify-between font-mono text-[0.65rem] text-gray-400">
        <span>Min: {config.formatter(minVal)}</span>
        <span>Max: {config.formatter(maxVal)}</span>
      </div>
    </div>
  );
};

export const TrendChart = ({ historicalRuns }: TrendChartProps) => {
  if (historicalRuns.length < 2) {
    return (
      <section className="mb-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-gray-900">Historical Trends</h3>
        <p className="m-0 text-sm text-gray-500">Need at least 2 historical runs to visualize trend lines.</p>
      </section>
    );
  }

  return (
    <section className="mb-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-base font-semibold text-gray-900">Historical Trends (Last {historicalRuns.length} Runs)</h3>
      <div className="grid gap-4 md:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
        {sparklineConfigs.map(config => (
          <Sparkline key={config.key} config={config} historicalRuns={historicalRuns} />
        ))}
      </div>
    </section>
  );
};
