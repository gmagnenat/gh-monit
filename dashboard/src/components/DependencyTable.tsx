import { useState } from 'react';
import type { DependencyGroup } from '../api/client';

const ECOSYSTEM_COLORS: Record<string, string> = {
  npm: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  pip: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  maven: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  nuget: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  rubygems: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  go: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  cargo: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  composer: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
};

const DEFAULT_ECOSYSTEM_STYLE =
  'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';

type DependencyTableProps = {
  data: DependencyGroup[];
};

/** Package risk ranking table sorted by most-critical-first. */
export function DependencyTable({ data }: DependencyTableProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
          Dependency Landscape
        </h3>
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          No open alerts with package data found. Sync repos to populate this
          view.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Dependency Landscape
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {data.length} package{data.length !== 1 ? 's' : ''} with open alerts,
          ranked by risk
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50">
              <th className="px-4 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                Package
              </th>
              <th className="px-4 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                Ecosystem
              </th>
              <th className="px-4 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                Alerts
              </th>
              <th className="px-4 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                Severity Breakdown
              </th>
              <th className="px-4 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                Repos
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.map((dep) => {
              const key = `${dep.packageName}:${dep.ecosystem ?? ''}`;
              const isExpanded = expandedRow === key;
              const ecoStyle =
                ECOSYSTEM_COLORS[(dep.ecosystem ?? '').toLowerCase()] ??
                DEFAULT_ECOSYSTEM_STYLE;
              const mediumCount =
                dep.totalAlerts - dep.criticalCount - dep.highCount;

              return (
                <tr
                  key={key}
                  className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <td className="px-4 py-2 font-mono text-xs text-slate-700 dark:text-slate-300">
                    {dep.packageName}
                  </td>
                  <td className="px-4 py-2">
                    {dep.ecosystem ? (
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${ecoStyle}`}
                      >
                        {dep.ecosystem}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                    {dep.totalAlerts}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1.5">
                      {dep.criticalCount > 0 && (
                        <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-800 dark:bg-red-900/30 dark:text-red-400">
                          {dep.criticalCount} critical
                        </span>
                      )}
                      {dep.highCount > 0 && (
                        <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                          {dep.highCount} high
                        </span>
                      )}
                      {mediumCount > 0 && (
                        <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-[10px] font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                          {mediumCount} other
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => setExpandedRow(isExpanded ? null : key)}
                      className="text-xs font-medium text-slate-700 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400"
                    >
                      {dep.affectedRepos} repo
                      {dep.affectedRepos !== 1 ? 's' : ''}
                      <span className="ml-1 text-[10px] text-slate-400">
                        {isExpanded ? '▲' : '▼'}
                      </span>
                    </button>
                    {isExpanded && (
                      <div className="mt-1 space-y-0.5">
                        {dep.repos.map((repo) => (
                          <div
                            key={repo}
                            className="font-mono text-[10px] text-slate-500 dark:text-slate-400"
                          >
                            {repo}
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
