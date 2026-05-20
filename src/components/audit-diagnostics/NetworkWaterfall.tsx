import { useMemo, useState } from 'react';
import { NetworkRequestItem } from '@/types';

type ResourceFilter = 'all' | 'script' | 'image' | 'stylesheet' | 'font';
type SortKey = 'startTime' | 'duration' | 'transferSize';

interface NetworkWaterfallProps {
  requests: NetworkRequestItem[];
}

const filters: Array<{ value: ResourceFilter; label: string }> = [
  { value: 'all', label: 'All Types' },
  { value: 'script', label: 'Scripts' },
  { value: 'image', label: 'Images' },
  { value: 'stylesheet', label: 'Stylesheets' },
  { value: 'font', label: 'Fonts' },
];

const sortOptions: Array<{ value: SortKey; label: string }> = [
  { value: 'startTime', label: 'Sort by Start Time' },
  { value: 'duration', label: 'Sort by Duration' },
  { value: 'transferSize', label: 'Sort by Size' },
];

const matchesFilter = (request: NetworkRequestItem, filter: ResourceFilter): boolean => {
  if (filter === 'all') return true;

  const type = request.resourceType.toLowerCase();
  const mimeType = request.mimeType.toLowerCase();

  return (
    (filter === 'script' && (type === 'script' || mimeType.includes('javascript'))) ||
    (filter === 'image' && (type === 'image' || mimeType.includes('image'))) ||
    (filter === 'stylesheet' && (type === 'stylesheet' || mimeType.includes('css'))) ||
    (filter === 'font' && (type === 'font' || mimeType.includes('font')))
  );
};

const getBarColor = (type: string): string => {
  const normalizedType = type.toLowerCase();
  if (normalizedType.includes('script')) return '#f59e0b';
  if (normalizedType.includes('image')) return '#3b82f6';
  if (normalizedType.includes('style') || normalizedType.includes('css')) return '#10b981';
  if (normalizedType.includes('font')) return '#8b5cf6';
  if (normalizedType.includes('document')) return '#ef4444';
  return '#9ca3af';
};

export const NetworkWaterfall = ({ requests }: NetworkWaterfallProps) => {
  const [filter, setFilter] = useState<ResourceFilter>('all');
  const [sortBy, setSortBy] = useState<SortKey>('startTime');

  const filteredRequests = useMemo(() => {
    const visibleRequests = requests
      .filter(request => request.url && !request.url.startsWith('data:'))
      .filter(request => matchesFilter(request, filter));

    return [...visibleRequests].sort((a, b) => {
      if (sortBy === 'startTime') return a.startTime - b.startTime;
      if (sortBy === 'duration') return (b.endTime - b.startTime) - (a.endTime - a.startTime);
      return b.transferSize - a.transferSize;
    });
  }, [requests, filter, sortBy]);

  const maxEndTime = useMemo(() => Math.max(...requests.map(({ endTime }) => endTime), 1), [requests]);
  const minStartTime = useMemo(
    () => Math.min(...requests.filter(({ startTime }) => startTime > 0).map(({ startTime }) => startTime), 0),
    [requests],
  );
  const durationScale = Math.max(maxEndTime - minStartTime, 1);

  if (requests.length === 0) return null;

  return (
    <section className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <h3 className="m-0 text-xl font-semibold text-gray-900">Network Waterfall</h3>
        <div className="flex gap-3">
          <select
            value={filter}
            onChange={event => setFilter(event.target.value as ResourceFilter)}
            className="cursor-pointer rounded-md border border-gray-300 bg-gray-50 px-3 py-1.5 text-sm text-gray-700 outline-none"
          >
            {filters.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select
            value={sortBy}
            onChange={event => setSortBy(event.target.value as SortKey)}
            className="cursor-pointer rounded-md border border-gray-300 bg-gray-50 px-3 py-1.5 text-sm text-gray-700 outline-none"
          >
            {sortOptions.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-[700px] w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left font-semibold text-gray-600">
              <th className="w-[35%] px-4 py-3">URL</th>
              <th className="w-[10%] px-4 py-3">Type</th>
              <th className="w-[10%] px-4 py-3">Size</th>
              <th className="w-[10%] px-4 py-3">Time</th>
              <th className="w-[35%] px-4 py-3">Timeline</th>
            </tr>
          </thead>
          <tbody>
            {filteredRequests.map((request, index) => {
              const requestDuration = Math.max((request.endTime - request.startTime) * 1000, 1);
              const leftPct = Math.max(0, ((request.startTime - minStartTime) / durationScale) * 100);
              const widthPct = Math.max(0.5, ((request.endTime - request.startTime) / durationScale) * 100);
              const filename = request.url.split('/').at(-1) || request.url;
              const resourceLabel = request.resourceType || request.mimeType.split('/')[1] || 'Unknown';

              return (
                <tr key={`${request.url}-${index}`} className="border-b border-gray-100 last:border-b-0">
                  <td className="px-4 py-3 align-middle text-gray-700" title={request.url}>
                    <div className="max-w-[300px] truncate">{filename}</div>
                  </td>
                  <td className="px-4 py-3 align-middle text-gray-700">{resourceLabel}</td>
                  <td className="px-4 py-3 align-middle text-gray-700">{(request.transferSize / 1024).toFixed(1)} KB</td>
                  <td className="px-4 py-3 align-middle text-gray-700">{Math.round(requestDuration)} ms</td>
                  <td className="px-4 py-3 align-middle text-gray-700">
                    <div className="relative h-4 w-full rounded bg-gray-100">
                      <div
                        className="absolute h-full min-w-0.5 rounded transition-all"
                        style={{
                          left: `${leftPct}%`,
                          width: `${widthPct}%`,
                          backgroundColor: getBarColor(resourceLabel),
                        }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredRequests.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No requests match the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};
