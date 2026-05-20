import { DeterministicRecommendation } from "@/lib/comparison/comparisonTypes";

interface DeterministicRecommendationListProps {
  recommendations: DeterministicRecommendation[];
}

const priorityBadgeClass = (priority: string): string => {
  if (priority === "high") return "bg-red-100 text-red-800";
  if (priority === "medium") return "bg-amber-100 text-amber-800";
  return "bg-gray-100 text-gray-600";
};

export const DeterministicRecommendationList = ({
  recommendations,
}: DeterministicRecommendationListProps) => (
  <section className="mb-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
    <h3 className="mb-4 text-base font-semibold text-gray-900">Rule-Based Action Items</h3>
    {recommendations.length === 0 ? (
      <p className="py-2 text-sm text-gray-500">No recommendations required. All metrics are stable or improved!</p>
    ) : (
      <div className="flex flex-col gap-5">
        {recommendations.map((recommendation, index) => (
          <article key={`${recommendation.issue}-${index}`} className="rounded-md border border-gray-200 bg-gray-50 p-4">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <span className={`inline-block rounded px-2 py-0.5 text-[0.7rem] font-bold uppercase ${priorityBadgeClass(recommendation.priority)}`}>
                {recommendation.priority} Priority
              </span>
              <span className="flex-1 text-sm font-semibold text-gray-800">{recommendation.issue}</span>
            </div>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {recommendation.suggestedFixes.map((fix, fixIndex) => (
                <li key={`${fix}-${fixIndex}`} className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 pointer-events-none" readOnly />
                  <span className="text-sm leading-6 text-gray-600">{fix}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    )}
  </section>
);
