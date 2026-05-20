'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ScoreBadge } from '@/components/ScoreBadge';

interface AuditSummary {
  id: string;
  url: string;
  pageType: string;
  projectTitle: string;
  performanceScore: number | null;
  accessibilityScore: number | null;
  seoScore: number | null;
  bestPracticesScore: number | null;
  status: string;
  createdAt: string;
}

interface ProjectSummary {
  isActive: boolean;
}

interface AuditListResponse {
  data?: AuditSummary[];
  pagination?: {
    total?: number;
  };
}

interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  totalAudits: number;
  recentAudits: AuditSummary[];
  lowScoreUrls: AuditSummary[];
}

const fetchJson = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}`);
  return response.json() as Promise<T>;
};

const DashboardPage = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const [projects, recentData, allData] = await Promise.all([
          fetchJson<ProjectSummary[]>('/api/projects'),
          fetchJson<AuditListResponse>('/api/audits?limit=5'),
          fetchJson<AuditListResponse>('/api/audits?limit=100'),
        ]);

        const allAudits = allData.data ?? [];
        const lowScoreUrls = allAudits
          .filter(({ status, performanceScore }) =>
            status === 'success' && performanceScore !== null && performanceScore < 50,
          )
          .slice(0, 5);

        setStats({
          totalProjects: projects.length,
          activeProjects: projects.filter(({ isActive }) => isActive).length,
          totalAudits: allData.pagination?.total ?? 0,
          recentAudits: recentData.data ?? [],
          lowScoreUrls,
        });
      } finally {
        setLoading(false);
      }
    };

    loadStats().catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl p-8">
        <p className="text-gray-500">Loading dashboard...</p>
      </div>
    );
  }

  const attentionCount = stats?.lowScoreUrls.length ?? 0;

  return (
    <div className="mx-auto max-w-6xl p-6 sm:p-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="mb-1 text-3xl font-bold text-gray-900">Lighthouse Monitor</h1>
          <p className="text-sm text-gray-500">Weekly performance audits for your projects</p>
        </div>
        <Link
          href="/audits/new"
          className="w-fit rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white no-underline transition hover:bg-blue-700"
        >
          ▶ Run Audit
        </Link>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Projects" value={stats?.totalProjects ?? 0}>
          <Link href="/projects" className="text-xs text-blue-600 no-underline hover:underline">
            Manage →
          </Link>
        </StatCard>
        <StatCard label="Active Projects" value={stats?.activeProjects ?? 0} tone="good">
          <span className="text-xs text-gray-400">monitored weekly</span>
        </StatCard>
        <StatCard label="Total Audits" value={stats?.totalAudits ?? 0}>
          <Link href="/audits" className="text-xs text-blue-600 no-underline hover:underline">
            View history →
          </Link>
        </StatCard>
        <StatCard label="URLs Below 50" value={attentionCount} tone={attentionCount ? 'bad' : 'good'}>
          <span className="text-xs text-gray-400">need attention</span>
        </StatCard>
      </div>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <Panel
          title="Recent Audits"
          action={<Link href="/audits" className="text-xs text-blue-600 no-underline hover:underline">View all →</Link>}
        >
          {!stats?.recentAudits.length ? (
            <p className="text-sm text-gray-400">
              No audits yet. <Link href="/audits/new" className="text-blue-600">Run one →</Link>
            </p>
          ) : (
            <div>
              {stats.recentAudits.map(run => <AuditRow key={run.id} run={run} showDate />)}
            </div>
          )}
        </Panel>

        <Panel
          title="⚠️ Needs Attention"
          action={<span className="text-xs text-gray-400">Performance &lt; 50</span>}
        >
          {!stats?.lowScoreUrls.length ? (
            <div className="py-8 text-center">
              <div className="text-3xl">✅</div>
              <p className="mt-2 font-medium text-emerald-800">All URLs performing well</p>
            </div>
          ) : (
            <div>
              {stats.lowScoreUrls.map(run => <AuditRow key={run.id} run={run} />)}
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QuickLink href="/projects/new" icon="➕" label="Add Project" />
        <QuickLink href="/audits/new" icon="▶" label="Run Audit" />
        <QuickLink href="/projects" icon="📋" label="All Projects" />
        <QuickLink href="/audits" icon="📊" label="Audit History" />
      </div>
    </div>
  );
};

interface StatCardProps {
  label: string;
  value: number;
  tone?: 'default' | 'good' | 'bad';
  children: React.ReactNode;
}

const statToneClass: Record<NonNullable<StatCardProps['tone']>, string> = {
  default: 'text-gray-900',
  good: 'text-emerald-800',
  bad: 'text-red-800',
};

const StatCard = ({ label, value, tone = 'default', children }: StatCardProps) => (
  <div className="rounded-lg border border-gray-200 bg-white p-5">
    <div className={`text-3xl font-bold leading-none ${statToneClass[tone]}`}>{value}</div>
    <div className="mb-2 mt-2 text-xs uppercase tracking-wide text-gray-500">{label}</div>
    {children}
  </div>
);

interface PanelProps {
  title: string;
  action: React.ReactNode;
  children: React.ReactNode;
}

const Panel = ({ title, action, children }: PanelProps) => (
  <section className="rounded-lg border border-gray-200 bg-white p-5">
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="m-0 text-base font-semibold text-gray-900">{title}</h2>
      {action}
    </div>
    {children}
  </section>
);

interface AuditRowProps {
  run: AuditSummary;
  showDate?: boolean;
}

const AuditRow = ({ run, showDate = false }: AuditRowProps) => (
  <Link
    href={`/audits/${run.id}`}
    className="flex items-center justify-between gap-3 border-b border-gray-100 py-2.5 text-gray-700 no-underline transition last:border-b-0 hover:text-gray-950"
  >
    <div className="min-w-0 flex-1">
      <div className="text-xs text-gray-500">
        <span className="mr-1.5 inline-block rounded bg-gray-100 px-1.5 py-0.5 text-[0.65rem] text-gray-400">
          {run.pageType}
        </span>
        {run.projectTitle}
      </div>
      <div className="truncate text-sm text-gray-700">{run.url}</div>
    </div>
    <div className="flex shrink-0 items-center gap-1.5">
      {run.status === 'failed' ? (
        <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-800">Failed</span>
      ) : (
        <ScoreBadge score={run.performanceScore} size="sm" />
      )}
      {showDate && (
        <span className="text-xs text-gray-400">
          {new Date(run.createdAt).toLocaleDateString()}
        </span>
      )}
    </div>
  </Link>
);

interface QuickLinkProps {
  href: string;
  icon: string;
  label: string;
}

const QuickLink = ({ href, icon, label }: QuickLinkProps) => (
  <Link
    href={href}
    className="flex flex-col items-center gap-2 rounded-lg border border-gray-200 bg-white p-5 text-sm font-medium text-gray-700 no-underline transition hover:border-blue-200 hover:text-blue-700"
  >
    <span className="text-2xl">{icon}</span>
    <span>{label}</span>
  </Link>
);

export default DashboardPage;
