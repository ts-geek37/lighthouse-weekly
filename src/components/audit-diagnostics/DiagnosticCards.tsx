import { AdvancedDiagnostics } from '@/types';

interface DiagnosticCardsProps {
  diagnostics: AdvancedDiagnostics;
}

interface CardProps {
  title: string;
  children: React.ReactNode;
}

const listItemClass = 'flex items-center justify-between border-b border-gray-100 pb-3 text-sm';
const itemLabelClass = 'max-w-[200px] truncate whitespace-nowrap font-medium text-gray-700';
const itemValueClass = 'shrink-0 font-semibold text-gray-900';
const codeBlockClass = 'overflow-x-auto whitespace-nowrap rounded-md border border-slate-200 bg-slate-100 p-3 font-mono text-xs text-slate-900';

const Card = ({ title, children }: CardProps) => (
  <article className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
    <h4 className="m-0 border-b border-gray-200 bg-gray-50 px-5 py-4 text-base font-semibold text-gray-900">{title}</h4>
    <div className="flex-1 p-5">{children}</div>
  </article>
);

const DiagnosticCards = ({ diagnostics }: DiagnosticCardsProps) => {
  if (!diagnostics) return null;

  return (
    <div className="mb-8 grid gap-6 md:grid-cols-[repeat(auto-fill,minmax(350px,1fr))]">
      {diagnostics.mainthreadWorkBreakdown && diagnostics.mainthreadWorkBreakdown.length > 0 && (
        <Card title="Main-thread Work Breakdown">
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {diagnostics.mainthreadWorkBreakdown.slice(0, 5).map((item, index) => (
              <li key={`${item.groupLabel}-${index}`} className={listItemClass}>
                <span className={itemLabelClass}>{item.groupLabel}</span>
                <span className={itemValueClass}>{Math.round(item.duration)} ms</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {diagnostics.bootupTime && diagnostics.bootupTime.length > 0 && (
        <Card title="JavaScript Bootup Time">
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {diagnostics.bootupTime.slice(0, 5).map((item, index) => {
              const filename = item.url.split('/').at(-1) || item.url;
              return (
                <li key={`${item.url}-${index}`} className={listItemClass}>
                  <span className={itemLabelClass} title={item.url}>{filename}</span>
                  <span className={itemValueClass}>{Math.round(item.total)} ms</span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {diagnostics.thirdPartySummary && diagnostics.thirdPartySummary.length > 0 && (
        <Card title="Third-Party Summary">
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {diagnostics.thirdPartySummary.slice(0, 5).map((item, index) => (
              <li key={`${item.entityName}-${index}`} className={listItemClass}>
                <span className={itemLabelClass}>{item.entityName}</span>
                <span className={itemValueClass}>
                  {Math.round(item.transferSize / 1024)} KB
                  <span className="ml-1 text-xs font-normal text-gray-400">({Math.round(item.blockingTime)}ms block)</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {diagnostics.lcpElement && (
        <Card title="Largest Contentful Paint Element">
          <div className={codeBlockClass}>
            <code>{diagnostics.lcpElement.snippet || diagnostics.lcpElement.nodeLabel}</code>
          </div>
          {diagnostics.lcpElement.path && (
            <div className="mt-3 break-all font-mono text-xs text-slate-500">Selector: {diagnostics.lcpElement.path}</div>
          )}
        </Card>
      )}

      {diagnostics.layoutShiftElements && diagnostics.layoutShiftElements.length > 0 && (
        <Card title="Layout Shift Elements (CLS)">
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {diagnostics.layoutShiftElements.map((item, index) => (
              <li key={`${item.score}-${index}`} className="flex flex-col items-start gap-1 border-b border-gray-100 pb-3 text-sm">
                <div className="flex w-full justify-between">
                  <span className={itemLabelClass}>Shift Score Contribution</span>
                  <span className="shrink-0 font-semibold text-red-500">{item.score.toFixed(4)}</span>
                </div>
                <div className={`${codeBlockClass} w-full`}>
                  <code>{item.snippet || item.nodeLabel}</code>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {diagnostics.domSize !== null && (
        <Card title="DOM Size">
          <div className="py-4 text-center text-3xl font-bold text-blue-500">
            {diagnostics.domSize} <span className="text-base font-medium text-gray-500">elements</span>
          </div>
          {diagnostics.domSize > 1500 && (
            <div className="rounded bg-red-100 p-2 text-center text-sm text-red-500">
              Warning: Exceeds recommended 1,500 elements
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

export { DiagnosticCards };