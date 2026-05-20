import { Opportunity } from "@/types";

interface OpportunityDiffListProps {
  opportunities: {
    new: Opportunity[];
    resolved: Opportunity[];
  };
}

const formatSavings = (opportunity: Opportunity): string => {
  const savings = [
    opportunity.savingsMs && opportunity.savingsMs > 0 ? `${opportunity.savingsMs}ms` : null,
    opportunity.savingsBytes && opportunity.savingsBytes > 0 ? `${Math.round(opportunity.savingsBytes / 1024)}KB` : null,
  ].filter(Boolean);

  return savings.length > 0 ? `Estimated savings: ${savings.join(", ")}` : "No quantified savings";
};

export const OpportunityDiffList = ({ opportunities }: OpportunityDiffListProps) => (
  <section className="mb-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
    <h3 className="mb-4 text-base font-semibold text-gray-900">Lighthouse Opportunities Diff</h3>
    <div className="grid gap-6 md:grid-cols-[repeat(auto-fit,minmax(280px,1fr))]">
      <div className="flex flex-col">
        <h4 className="mb-1 text-sm font-semibold text-red-600">New Flags ({opportunities.new.length})</h4>
        <p className="mb-3 text-xs text-gray-500">Optimizations flagged in current run that were absent last week.</p>
        {opportunities.new.length === 0 ? (
          <p className="rounded-md border border-dashed border-gray-200 bg-gray-50 p-3 text-center text-sm text-gray-500">
            No new opportunities flagged. Great job keeping the codebase clean!
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {opportunities.new.map(opportunity => (
              <article key={opportunity.id} className="rounded-md border border-red-100 bg-red-50 p-3">
                <strong className="mb-1 block text-sm text-red-800">{opportunity.title}</strong>
                <span className="mb-2 inline-block rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-800">
                  {formatSavings(opportunity)}
                </span>
                <p className="m-0 text-xs leading-5 text-red-950">{opportunity.description}</p>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col">
        <h4 className="mb-1 text-sm font-semibold text-emerald-600">Resolved Opportunities ({opportunities.resolved.length})</h4>
        <p className="mb-3 text-xs text-gray-500">Optimizations solved since last week's audit.</p>
        {opportunities.resolved.length === 0 ? (
          <p className="rounded-md border border-dashed border-gray-200 bg-gray-50 p-3 text-center text-sm text-gray-500">
            No previously flagged opportunities were resolved this week.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {opportunities.resolved.map(opportunity => (
              <article key={opportunity.id} className="rounded-md border border-emerald-100 bg-emerald-50 p-3">
                <strong className="mb-1 block text-sm text-emerald-950">{opportunity.title}</strong>
                <span className="mb-2 inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-800">Fixed</span>
                <p className="m-0 text-xs leading-5 text-emerald-800">{opportunity.description}</p>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  </section>
);
