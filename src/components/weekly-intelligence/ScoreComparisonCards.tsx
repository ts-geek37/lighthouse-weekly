import { MetricChange } from "@/lib/comparison/comparisonTypes";

interface ScoreComparisonCardsProps {
  metrics: {
    performanceScore: MetricChange;
    accessibilityScore: MetricChange;
    seoScore: MetricChange;
    bestPracticesScore: MetricChange;
  };
}

type ScoreCardKey = keyof ScoreComparisonCardsProps["metrics"];
type StatusTone = "improved" | "regressed" | "critical" | "stable";

const statusClass = (status: StatusTone | string): string => {
  switch (status) {
    case "improved":
      return "bg-emerald-50 text-emerald-700";
    case "regressed":
      return "bg-amber-50 text-amber-700";
    case "critical":
      return "bg-red-50 text-red-600";
    default:
      return "bg-gray-100 text-gray-600";
  }
};

const scoreValueClass = (score: number | null): string => {
  if (score === null) return "text-gray-500";
  if (score >= 90) return "text-emerald-600";
  if (score >= 50) return "text-amber-600";
  return "text-red-600";
};

export const ScoreComparisonCards = ({ metrics }: ScoreComparisonCardsProps) => {
  const cards: Array<{ key: ScoreCardKey; data: MetricChange }> = [
    { key: "performanceScore", data: metrics.performanceScore },
    { key: "accessibilityScore", data: metrics.accessibilityScore },
    { key: "seoScore", data: metrics.seoScore },
    { key: "bestPracticesScore", data: metrics.bestPracticesScore },
  ];

  return (
    <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
      {cards.map(({ key, data }) => {
        const delta = data.delta || 0;
        const deltaText = delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : "Stable";
        const arrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "•";

        return (
          <div key={key} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-600">{data.label}</span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(data.status)}`}>
                {arrow} {deltaText}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex flex-1 flex-col">
                <span className="mb-1 text-[0.7rem] uppercase tracking-wider text-gray-400">Current</span>
                <span className={`text-2xl font-bold ${scoreValueClass(data.current)}`}>
                  {data.current !== null ? Math.round(data.current) : "N/A"}
                </span>
              </div>
              <div className="h-7 w-px bg-gray-200" />
              <div className="flex flex-1 flex-col">
                <span className="mb-1 text-[0.7rem] uppercase tracking-wider text-gray-400">Previous</span>
                <span className="text-xl font-semibold text-gray-500">
                  {data.previous !== null ? Math.round(data.previous) : "N/A"}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
