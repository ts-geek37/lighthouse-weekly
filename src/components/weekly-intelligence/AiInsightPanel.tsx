import { useEffect, useState } from "react";

interface AiInsightPanelProps {
  projectId: string;
  projectUrlId: string;
  latestRunId: string;
  previousRunId: string;
  initialAiInsight: string | null;
}

interface AiInsightResponse {
  aiInsight?: string;
  error?: string;
}

const buildInsightUrl = ({ projectId, projectUrlId, latestRunId, previousRunId }: Omit<AiInsightPanelProps, "initialAiInsight">): string =>
  `/api/projects/${projectId}/weekly-intelligence/ai?projectUrlId=${projectUrlId}&latestRunId=${latestRunId}&previousRunId=${previousRunId}`;

const formatMarkdown = (text: string) =>
  text.split("\n").map((line, index) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("## ")) {
      return <h4 key={index} className="mb-1 mt-4 border-b border-gray-100 pb-1 text-base font-semibold text-gray-800">{trimmed.replace("## ", "")}</h4>;
    }
    if (trimmed.startsWith("# ")) {
      return <h3 key={index} className="mb-2 mt-4 text-lg font-bold text-gray-900">{trimmed.replace("# ", "")}</h3>;
    }
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      return (
        <div key={index} className="my-1 flex items-start gap-2">
          <span className="font-bold text-blue-600">•</span>
          <span className="flex-1">{trimmed.replace(/^[-*]\s+/, "")}</span>
        </div>
      );
    }
    if (trimmed === "") return <div key={index} className="h-2" />;
    return <p key={index} className="mb-2">{line}</p>;
  });

export const AiInsightPanel = ({
  projectId,
  projectUrlId,
  latestRunId,
  previousRunId,
  initialAiInsight,
}: AiInsightPanelProps) => {
  const [insight, setInsight] = useState<string | null>(initialAiInsight);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInsight = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(buildInsightUrl({ projectId, projectUrlId, latestRunId, previousRunId }));
      const data = await response.json() as AiInsightResponse;
      if (!response.ok) throw new Error(data.error || "Failed to fetch AI insights");
      setInsight(data.aiInsight ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setInsight(initialAiInsight);
    setError(null);

    if (!initialAiInsight && latestRunId && previousRunId) {
      fetchInsight();
    }
    // fetchInsight depends on changing ids; keeping the explicit dependency list avoids re-fetch loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, projectUrlId, latestRunId, previousRunId, initialAiInsight]);

  return (
    <section className="mb-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="m-0 text-base font-semibold text-gray-900">⚡ AI Performance Intelligence</h3>
        {insight && !loading && (
          <button type="button" onClick={fetchInsight} className="p-0 text-sm font-medium text-blue-600 underline">
            Regenerate
          </button>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-3 rounded-md bg-gray-50 p-6">
          <div className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-gray-200 border-t-blue-600" />
          <span className="text-sm text-gray-600">Running AI analysis on deltas...</span>
        </div>
      )}

      {error && (
        <div className="flex flex-col items-start gap-2 rounded-md border border-red-200 bg-red-50 p-4">
          <p className="m-0 text-sm font-medium text-red-800">Error: {error}</p>
          <button type="button" onClick={fetchInsight} className="rounded bg-red-600 px-3 py-1.5 text-sm text-white transition hover:bg-red-700">
            Retry Analysis
          </button>
        </div>
      )}

      {!insight && !loading && !error && (
        <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
          <p className="mb-4 text-sm text-gray-600">AI analysis has not been generated for this week's audit cycle yet.</p>
          <button type="button" onClick={fetchInsight} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700">
            Analyze Performance Regressions
          </button>
        </div>
      )}

      {insight && !loading && (
        <div className="text-sm leading-6 text-gray-700">{formatMarkdown(insight)}</div>
      )}
    </section>
  );
};
