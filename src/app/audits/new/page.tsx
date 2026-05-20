'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AgentPrompt, ProjectResponse } from '@/types';
import { ScoreBadge } from '@/components/ScoreBadge';
import { AgentPromptCard } from '@/components/AgentPromptCard';

type Device = 'mobile' | 'desktop';

interface AuditResult {
  auditRunId: string;
  url: string;
  status: 'success' | 'failed';
  device: Device;
  performanceScore: number | null;
  accessibilityScore: number | null;
  seoScore: number | null;
  bestPracticesScore: number | null;
  coreWebVitals: {
    lcp: number | null;
    cls: number | null;
    inpOrTbt: number | null;
    fcp: number | null;
    speedIndex: number | null;
  };
  opportunities: Array<{ id: string; title: string; description: string; savingsMs?: number; savingsBytes?: number }>;
  agentPrompts: AgentPrompt[];
  aiSummary: string | null;
  error?: string;
}

type RunAuditResultMap = Record<Device, AuditResult>;

interface ApiErrorResponse {
  error?: string;
}

type ProjectUrlOption = ProjectResponse['urls'][number] & {
  projectTitle: string;
  environment: string;
};

interface VitalConfig {
  label: string;
  value: number | null;
  isCls?: boolean;
  good: number;
  poor: number;
}

type VitalStatus = 'good' | 'needs-improvement' | 'poor' | 'unknown';

const inputClass = 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

const deviceTabClass = (active: boolean): string =>
  `flex items-center rounded-md px-5 py-2 text-sm font-semibold transition ${active ? 'bg-white text-gray-950 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`;

const modeButtonClass = (active: boolean): string =>
  `rounded-md border px-4 py-1.5 text-sm font-medium transition ${active ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`;

const vitalStatus = ({ value, good, poor }: Pick<VitalConfig, 'value' | 'good' | 'poor'>): VitalStatus => {
  if (value === null) return 'unknown';
  if (value <= good) return 'good';
  if (value <= poor) return 'needs-improvement';
  return 'poor';
};

const vitalToneClass = (status: VitalStatus): string => {
  const classes: Record<VitalStatus, string> = {
    good: 'bg-emerald-100 text-emerald-800',
    'needs-improvement': 'bg-amber-100 text-amber-800',
    poor: 'bg-red-100 text-red-800',
    unknown: 'bg-gray-100 text-gray-400',
  };
  return classes[status];
};

const formatVital = ({ value, isCls }: Pick<VitalConfig, 'value' | 'isCls'>): string => {
  if (value === null) return 'N/A';
  if (isCls) return value.toFixed(3);
  return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${Math.round(value)}ms`;
};

const RunAuditPage = () => {
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [mode, setMode] = useState<'adhoc' | 'project'>('adhoc');
  const [url, setUrl] = useState('');
  const [selectedProjectUrlId, setSelectedProjectUrlId] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunAuditResultMap | null>(null);
  const [activeDeviceTab, setActiveDeviceTab] = useState<Device>('mobile');
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const response = await fetch('/api/projects');
        if (!response.ok) return;
        setProjects(await response.json() as ProjectResponse[]);
      } catch {
        setProjects([]);
      }
    };

    loadProjects();
  }, []);

  useEffect(() => {
    if (!running) {
      setElapsed(0);
      return;
    }

    const interval = window.setInterval(() => setElapsed(current => current + 1), 1000);
    return () => window.clearInterval(interval);
  }, [running]);

  const allProjectUrls = useMemo<ProjectUrlOption[]>(
    () => projects.flatMap(project =>
      project.urls.map(urlEntry => ({
        ...urlEntry,
        projectTitle: project.title,
        environment: project.environment,
      })),
    ),
    [projects],
  );

  const handleRun = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRunning(true);
    setResult(null);
    setError(null);

    const targetUrl = mode === 'project'
      ? allProjectUrls.find(urlEntry => urlEntry.id === selectedProjectUrlId)?.url ?? ''
      : url;

    const body: Record<string, string> = { url: targetUrl };
    if (mode === 'project' && selectedProjectUrlId) {
      body.projectUrlId = selectedProjectUrlId;
    }

    try {
      const response = await fetch('/api/audits/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json() as RunAuditResultMap | ApiErrorResponse;

      if (!response.ok) {
        setError('error' in data ? data.error ?? 'Audit failed' : 'Audit failed');
      } else {
        setResult(data as RunAuditResultMap);
        setActiveDeviceTab('mobile');
      }
    } catch {
      setError('Network error - is the server running?');
    } finally {
      setRunning(false);
    }
  };

  const activeResult = result?.[activeDeviceTab] ?? null;

  return (
    <div className="mx-auto max-w-4xl p-6 sm:p-8">
      <header className="mb-8">
        <Link href="/audits" className="text-sm text-gray-500 no-underline hover:text-gray-800">
          ← Audit History
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">Run Audit</h1>
        <p className="mt-1 text-sm text-gray-500">Run an immediate Lighthouse audit for any URL. Results appear below without waiting for the weekly schedule.</p>
      </header>

      <form onSubmit={handleRun} className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-6">
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setMode('adhoc')} className={modeButtonClass(mode === 'adhoc')}>
            Any URL
          </button>
          <button type="button" onClick={() => setMode('project')} className={modeButtonClass(mode === 'project')}>
            Project URL
          </button>
        </div>

        {mode === 'adhoc' ? (
          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">URL to audit</label>
            <input
              className={inputClass}
              type="url"
              value={url}
              onChange={event => setUrl(event.target.value)}
              placeholder="https://example.com"
              required
            />
            <p className="mt-1 text-xs text-gray-400">Results will not be saved to the database.</p>
          </div>
        ) : (
          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Select a monitored URL</label>
            <select
              className={inputClass}
              value={selectedProjectUrlId}
              onChange={event => setSelectedProjectUrlId(event.target.value)}
              required
            >
              <option value="">— choose a URL —</option>
              {allProjectUrls.map(urlEntry => (
                <option key={urlEntry.id} value={urlEntry.id}>
                  [{urlEntry.projectTitle} / {urlEntry.pageType}] {urlEntry.url}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-400">Results will be saved and appear in audit history.</p>
          </div>
        )}

        <button
          type="submit"
          disabled={running}
          className="rounded-md bg-blue-600 px-8 py-2.5 text-base font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {running ? `Running audits... ${elapsed}s` : '▶ Run Audits'}
        </button>
      </form>

      {running && (
        <div className="mb-6 flex items-start gap-4 rounded-lg border border-blue-200 bg-blue-50 p-5">
          <div className="mt-0.5 h-6 w-6 shrink-0 animate-spin rounded-full border-[3px] border-blue-200 border-t-blue-600" />
          <div>
            <strong>Audit in progress</strong>
            <p className="mt-1 text-sm text-gray-500">Lighthouse is running headless Chrome for both mobile and desktop. This typically takes 30-80 seconds.</p>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-lg border border-red-300 bg-red-100 p-4 text-red-800">
          <strong>Audit failed:</strong> {error}
        </div>
      )}

      {result && activeResult && (
        <ResultPanel
          result={activeResult}
          activeDevice={activeDeviceTab}
          onDeviceChange={setActiveDeviceTab}
        />
      )}
    </div>
  );
};

interface ResultPanelProps {
  result: AuditResult;
  activeDevice: Device;
  onDeviceChange: (device: Device) => void;
}

const ResultPanel = ({ result, activeDevice, onDeviceChange }: ResultPanelProps) => {
  const vitals: VitalConfig[] = [
    { label: 'LCP', value: result.coreWebVitals.lcp, good: 2500, poor: 4000 },
    { label: 'CLS', value: result.coreWebVitals.cls, isCls: true, good: 0.1, poor: 0.25 },
    { label: 'INP/TBT', value: result.coreWebVitals.inpOrTbt, good: 200, poor: 500 },
    { label: 'FCP', value: result.coreWebVitals.fcp, good: 1800, poor: 3000 },
    { label: 'Speed Index', value: result.coreWebVitals.speedIndex, good: 3400, poor: 5800 },
  ];

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="mb-6 flex w-fit rounded-lg border border-slate-200 bg-slate-100 p-1">
        <button type="button" onClick={() => onDeviceChange('mobile')} className={deviceTabClass(activeDevice === 'mobile')}>
          📱 Mobile
        </button>
        <button type="button" onClick={() => onDeviceChange('desktop')} className={deviceTabClass(activeDevice === 'desktop')}>
          💻 Desktop
        </button>
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="m-0 text-lg font-semibold text-gray-900">
            {result.status === 'success' ? '✅' : '❌'} {result.url}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {result.status === 'failed' ? `Failed: ${result.error}` : 'Audit completed'}
          </p>
        </div>
        {result.status === 'success' && result.auditRunId && !result.auditRunId.startsWith('adhoc-') && (
          <Link href={`/audits/${result.auditRunId}`} className="w-fit rounded-md bg-gray-100 px-3.5 py-2 text-sm text-gray-700 no-underline transition hover:bg-gray-200">
            View Full Report →
          </Link>
        )}
      </div>

      {result.status === 'success' && (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Performance', score: result.performanceScore },
              { label: 'Accessibility', score: result.accessibilityScore },
              { label: 'SEO', score: result.seoScore },
              { label: 'Best Practices', score: result.bestPracticesScore },
            ].map(({ label, score }) => (
              <div key={label} className="rounded-lg bg-gray-50 p-4 text-center">
                <ScoreBadge score={score} size="lg" />
                <div className="mt-2 text-xs text-gray-500">{label}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 border-t border-gray-200 pt-6">
            <h3 className="mb-3 text-base font-semibold text-gray-700">Core Web Vitals</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {vitals.map(vital => {
                const status = vitalStatus(vital);
                return (
                  <div key={vital.label} className={`rounded-md p-3 text-center ${vitalToneClass(status)}`}>
                    <div className="mb-1 text-xs text-gray-500">{vital.label}</div>
                    <div className="text-lg font-bold">{formatVital(vital)}</div>
                    {status !== 'unknown' && (
                      <div className="mt-1 text-[0.65rem] font-semibold capitalize">
                        {status.replace('-', ' ')}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {result.opportunities.length > 0 && (
            <div className="mt-6 border-t border-gray-200 pt-6">
              <h3 className="mb-3 text-base font-semibold text-gray-700">Top Opportunities</h3>
              <ul className="m-0 list-disc space-y-2 pl-5 text-sm">
                {result.opportunities.map(opportunity => (
                  <li key={opportunity.id}>
                    <strong>{opportunity.title}</strong>
                    {opportunity.savingsMs !== undefined && opportunity.savingsMs > 0 && (
                      <span className="ml-2 text-gray-500">
                        {opportunity.savingsMs >= 1000 ? `~${(opportunity.savingsMs / 1000).toFixed(1)}s` : `~${Math.round(opportunity.savingsMs)}ms`} savings
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.aiSummary && (
            <div className="mt-6 border-t border-gray-200 pt-6">
              <h3 className="mb-3 text-base font-semibold text-gray-700">AI Engineering Summary</h3>
              <div className="rounded-md bg-gray-50 p-4 text-sm leading-6 text-gray-700">
                {result.aiSummary.split('\n').map((line, index) => {
                  if (line.startsWith('## ')) {
                    return <h4 key={index} className="mb-1 mt-3 text-base font-semibold text-gray-900">{line.replace('## ', '')}</h4>;
                  }
                  if (line.startsWith('- ')) {
                    return <p key={index} className="my-1 pl-4">• {line.slice(2)}</p>;
                  }
                  return line ? <p key={index} className="my-1">{line}</p> : null;
                })}
              </div>
            </div>
          )}

          {result.agentPrompts.length > 0 && (
            <div className="mt-6 border-t border-gray-200 pt-6">
              <h3 className="mb-1 text-base font-semibold text-gray-700">🤖 Agent Investigation Prompts</h3>
              <p className="mb-3 text-xs text-gray-500">Paste into Cursor, Copilot, or Claude to find root causes, not implement fixes.</p>
              <div className="space-y-3">
                {result.agentPrompts.map((prompt, index) => (
                  <AgentPromptCard key={prompt.opportunityId} prompt={prompt} index={index} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default RunAuditPage;
