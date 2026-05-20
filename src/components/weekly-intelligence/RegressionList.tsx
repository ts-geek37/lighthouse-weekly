import { RegressionItem, ImprovementItem } from "@/lib/comparison/comparisonTypes";

interface RegressionListProps {
  regressions: RegressionItem[];
  improvements: ImprovementItem[];
}

const severityBadgeClass = (severity: string): string => {
  if (severity === "high") return "bg-red-100 text-red-800";
  if (severity === "medium") return "bg-amber-100 text-amber-800";
  return "bg-gray-100 text-gray-600";
};

const confidenceBadgeClass = (confidence: string): string => {
  if (confidence === "low") return "border-gray-200 text-gray-500";
  if (confidence === "medium") return "border-amber-200 text-amber-700";
  return "border-emerald-200 text-emerald-700";
};

export const RegressionList = ({ regressions, improvements }: RegressionListProps) => (
  <section className="mb-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
    <h3 className="mb-5 text-base font-semibold text-gray-900">Regression & Improvement Log</h3>

    <div className="flex flex-col">
      <h4 className="mb-3 text-sm font-semibold text-red-800">Detected Regressions ({regressions.length})</h4>
      {regressions.length === 0 ? (
        <p className="py-2 text-sm text-gray-500">No performance regressions detected this week. Excellent!</p>
      ) : (
        <div className="flex flex-col gap-3">
          {regressions.map((regression, index) => (
            <article key={`${regression.label}-${index}`} className="rounded-r-md border border-l-4 border-red-200 border-l-red-500 bg-red-50 px-4 py-3">
              <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <strong className="text-sm text-red-950">{regression.label}</strong>
                <div className="flex items-center gap-1.5">
                  <span className={`inline-block rounded px-1.5 py-0.5 text-[0.7rem] font-bold uppercase ${severityBadgeClass(regression.severity)}`}>
                    {regression.severity} Severity
                  </span>
                  <span className={`inline-block rounded border bg-white px-1.5 py-0.5 text-[0.65rem] font-semibold ${confidenceBadgeClass(regression.confidence)}`}>
                    Confidence: {regression.confidence.toUpperCase()}
                  </span>
                </div>
              </div>
              <p className="m-0 text-sm text-red-950">{regression.message}</p>
            </article>
          ))}
        </div>
      )}
    </div>

    <div className="mt-6 flex flex-col">
      <h4 className="mb-3 text-sm font-semibold text-emerald-800">Detected Improvements ({improvements.length})</h4>
      {improvements.length === 0 ? (
        <p className="py-2 text-sm text-gray-500">No significant improvements detected this week.</p>
      ) : (
        <ul className="m-0 list-disc pl-5">
          {improvements.map((improvement, index) => (
            <li key={`${improvement.label}-${index}`} className="mb-2 text-sm text-gray-700">
              <strong className="text-emerald-800">{improvement.label}:</strong> {improvement.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  </section>
);
