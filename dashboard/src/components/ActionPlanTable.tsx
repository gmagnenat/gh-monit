import { useState } from 'react';
import type { ActionPlanEntry } from '../api/client';
import { ErrorBanner } from './ErrorBanner';
import { EmptyState } from './EmptyState';
import { Card } from './Card';

type ActionPlanTableProps = {
  data: ActionPlanEntry[];
  loading: boolean;
  error: string | null;
};

const SEVERITY_DOT: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
};

function ActionPlanRow({ entry }: { entry: ActionPlanEntry }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-slate-100 last:border-0 dark:border-slate-800">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50"
      >
        <svg
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-900 dark:text-slate-100">
              {entry.directDependency}
            </span>
            {entry.directVersion && (
              <span className="text-xs text-slate-400">v{entry.directVersion}</span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Fixes {entry.vulnerablePackages.length} vulnerable{' '}
            {entry.vulnerablePackages.length === 1 ? 'package' : 'packages'} in{' '}
            {entry.affectedRepos} {entry.affectedRepos === 1 ? 'repo' : 'repos'}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {entry.criticalAlerts > 0 && (
            <span className="flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400">
              <span className={`inline-block h-2 w-2 rounded-full ${SEVERITY_DOT.critical}`} />
              {entry.criticalAlerts}
            </span>
          )}
          {entry.highAlerts > 0 && (
            <span className="flex items-center gap-1 text-xs font-medium text-orange-600 dark:text-orange-400">
              <span className={`inline-block h-2 w-2 rounded-full ${SEVERITY_DOT.high}`} />
              {entry.highAlerts}
            </span>
          )}
          <span className="text-xs text-slate-500">{entry.totalAlerts} total</span>
        </div>
      </button>

      {expanded && (
        <div className="bg-slate-50 px-4 py-3 pl-11 dark:bg-slate-800/30">
          <div className="space-y-2 text-sm">
            <div>
              <span className="font-medium text-slate-600 dark:text-slate-300">
                Vulnerable packages:{' '}
              </span>
              <span className="text-slate-700 dark:text-slate-400">
                {entry.vulnerablePackages.join(', ')}
              </span>
            </div>
            <div>
              <span className="font-medium text-slate-600 dark:text-slate-300">
                Affected repos:{' '}
              </span>
              <span className="text-slate-700 dark:text-slate-400">
                {entry.repos.join(', ')}
              </span>
            </div>
            {entry.directVersion && (
              <div className="mt-2 rounded bg-slate-100 px-3 py-1.5 font-mono text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                npm install {entry.directDependency}@latest
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function ActionPlanTable({ data, loading, error }: ActionPlanTableProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return <ErrorBanner message={error} />;
  }

  if (data.length === 0) {
    return (
      <EmptyState
        title="Action Plan"
        message="No dependency chain data yet. Data populates after repos are refreshed."
      />
    );
  }

  const totalCritical = data.reduce((s, e) => s + e.criticalAlerts, 0);
  const totalHigh = data.reduce((s, e) => s + e.highAlerts, 0);
  const totalAlerts = data.reduce((s, e) => s + e.totalAlerts, 0);

  return (
    <div className="space-y-4">
      <Card>
        <div className="px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Action Plan
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Update {data.length} direct{' '}
            {data.length === 1 ? 'dependency' : 'dependencies'} to fix{' '}
            {totalAlerts} alerts ({totalCritical} critical, {totalHigh} high).
            Ranked by impact.
          </p>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {data.map((entry) => (
            <ActionPlanRow key={entry.directDependency} entry={entry} />
          ))}
        </div>
      </Card>
    </div>
  );
}
