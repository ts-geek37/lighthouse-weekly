import { ScreenshotThumbnailItem } from '@/types';

interface FilmstripViewerProps {
  thumbnails: ScreenshotThumbnailItem[];
}

export const FilmstripViewer = ({ thumbnails }: FilmstripViewerProps) => {
  if (thumbnails.length === 0) return null;

  return (
    <section className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-5 text-lg font-semibold text-gray-900">Visual Loading Progression (Filmstrip)</h3>
      <div className="overflow-x-auto pb-4 [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]">
        <div className="flex min-w-max items-start gap-4">
          {thumbnails.map(({ data, timing }, index) => (
            <div key={`${timing}-${index}`} className="flex w-[120px] flex-col items-center gap-2">
              <div className="aspect-[9/16] w-full overflow-hidden rounded-md border border-gray-200 bg-gray-50 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={data} alt={`Frame at ${timing}ms`} className="h-full w-full object-cover" />
              </div>
              <div className="font-mono text-[0.8rem] font-medium text-gray-500">{timing}ms</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
