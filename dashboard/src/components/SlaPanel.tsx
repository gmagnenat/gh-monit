import type { SlaViolation } from '../api/client';

const SLA_DEFAULTS: { severity: string; limit: string }[] = [
  { severity: 'Critical', limit: '2 days' },
  { severity: 'High', limit: '7 days' },
  { severity: 'Medium', limit: '30 days' },
  { severity: 'Low', limit: '90 days' },
];

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  low: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
};

/** Format an ISO date to a short date string. */
function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

type SlaPanelProps = {
  data: SlaViolation[];
};

/** Table of SLA violations sorted by most overdue first. */
export function SlaPanel({ data }: SlaPanelProps) {
  const overdueCount = data.filter((v) => v.overdue).length;

  return (
    <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            SLA Compliance
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {overdueCount > 0 ? (
              <>
                <span className="font-medium text-red-600 dark:text-red-400">
                  {overdueCount} violation{overdueCount !== 1 ? 's' : ''}
                </span>
                {' '}out of {data.length} tracked alerts
              </>
            ) : data.length > 0 ? (
              `All ${data.length} open alerts are within SLA limits`
            ) : (
              'No open alerts to track'
            )}
          </p>
        </div>

        {/* SLA legend */}
        <div className="hidden items-center gap-3 sm:flex">
          {SLA_DEFAULTS.map(({ severity, limit }) => (
            <span
              key={severity}
              className="text-[10px] text-slate-500 dark:text-slate-400"
            >
              <span className="font-medium">{severity}:</span> {limit}
            </span>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="p-6 text-center">
          <p className="text-sm text-green-600 dark:text-green-400">
            No open alerts — SLA tracking will start once alerts are synced.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50">
                <th className="px-4 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  Repo
                </th>
                <th className="px-4 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  Alert
                </th>
                <th className="px-4 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  Severity
                </th>
                <th className="px-4 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  Package
                </th>
                <th className="px-4 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  Open Since
                </th>
                <th className="px-4 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  Days Open
                </th>
                <th className="px-4 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  SLA Limit
                </th>
                <th className="px-4 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  Link
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.map((v) => {
                const isOverdue = v.overdue;
                const sevBadge =
                  SEVERITY_BADGE[v.severity] ?? SEVERITY_BADGE.low;

                return (
                  <tr
                    key={`${v.repo}-${v.alertNumber}`}
                    className={
                      isOverdue
                        ? 'bg-red-50/50 dark:bg-red-900/10'
                        : 'transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }
                  >
                    <td className="px-4 py-2 font-mono text-xs text-slate-700 dark:text-slate-300">
                      {v.repo}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">
                      #{v.alertNumber}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${sevBadge}`}
                      >
                        {v.severity}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-700 dark:text-slate-300">
                      {v.packageName ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">
                      {formatDate(v.firstSeen)}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`text-xs font-medium ${
                          isOverdue
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {v.openDays}d
                        {isOverdue && (
                          <span className="ml-1 text-[10px]">
                            (+{Math.round((v.openDays - v.slaLimitDays) * 10) / 10}d)
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">
                      {v.slaLimitDays}d
                    </td>
                    <td className="px-4 py-2">
                      {v.htmlUrl ? (
                        <a
                          href={v.htmlUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                        >
                          View
                        </a>
                      ) : (
                        <span className="text-xs text-slate-300 dark:text-slate-600">
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
