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

type MetricKey = keyof VitalsComparisonTableProps["metrics"];

const metricKeys: MetricKey[] = ["lcp", "cls", "inpOrTbt", "fcp", "ttfb"];
const statusOrder: Record<MetricChange["status"], number> = {
  critical: 0,
  regressed: 1,
  stable: 2,
  improved: 3,
};

const statusBadgeClass = (status: MetricChange["status"]): string => {
  const classes: Record<MetricChange["status"], string> = {
    improved: "bg-emerald-100 text-emerald-800",
    regressed: "bg-amber-100 text-amber-800",
    critical: "bg-red-100 text-red-800",
    stable: "bg-gray-100 text-gray-600",
  };
  return classes[status];
};

const statusLabel = (status: MetricChange["status"]): string =>
  status === "improved" ? "Improved"
    : status === "regressed" ? "Regressed"
      : status === "critical" ? "Critical"
        : "Stable";

const changeClass = (status: MetricChange["status"]): string =>
  status === "improved" ? "text-emerald-600"
    : status === "regressed" || status === "critical" ? "text-red-600"
      : "text-gray-600";

const formatVal = (val: number | null, key: string): string => {
  if (val === null) return "N/A";
  if (key === "cls") return val.toFixed(3);
  return `${Math.round(val)}ms`;
};

const formatDelta = (delta: number | null, key: string, status: MetricChange["status"]): string => {
  if (delta === null || status === "stable") return "-";
  const sign = delta > 0 ? "+" : "";
  if (key === "cls") return `${sign}${delta.toFixed(3)}`;
  return `${sign}${Math.round(delta)}ms`;
};

export const VitalsComparisonTable = ({ metrics }: VitalsComparisonTableProps) => {
  const sortedVitals = metricKeys
    .map(key => metrics[key])
    .filter(Boolean)
    .sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

  return (
    <section className="mb-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-base font-semibold text-gray-900">Core Web Vitals Comparison</h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-200 bg-gray-50 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-gray-500">
              <th className="px-3 py-2.5">Metric</th>
              <th className="px-3 py-2.5">Previous Week</th>
              <th className="px-3 py-2.5">Current Week</th>
              <th className="px-3 py-2.5">Delta</th>
              <th className="px-3 py-2.5">Change %</th>
              <th className="px-3 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {sortedVitals.map(vital => {
              const pctStr = vital.percentage !== null && vital.status !== "stable"
                ? `${vital.percentage > 0 ? "+" : ""}${vital.percentage.toFixed(1)}%`
                : "-";

              return (
                <tr key={vital.metric} className="border-b border-gray-100 last:border-b-0">
                  <td className="px-3 py-3 text-sm font-semibold text-gray-900">{vital.label}</td>
                  <td className="px-3 py-3 text-sm text-gray-700">{formatVal(vital.previous, vital.metric)}</td>
                  <td className="px-3 py-3 text-sm text-gray-700">{formatVal(vital.current, vital.metric)}</td>
                  <td className={`px-3 py-3 text-sm font-medium ${changeClass(vital.status)}`}>
                    {formatDelta(vital.delta, vital.metric, vital.status)}
                  </td>
                  <td className={`px-3 py-3 text-sm ${changeClass(vital.status)}`}>{pctStr}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-block rounded px-2 py-1 text-xs font-semibold ${statusBadgeClass(vital.status)}`}>
                      {statusLabel(vital.status)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};
