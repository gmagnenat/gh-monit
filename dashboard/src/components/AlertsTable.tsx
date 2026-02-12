import { useCallback, useMemo, useState } from 'react';
import type { Alert } from '../api/client';
import { SeverityBadge } from './SeverityBadge';

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

type SortField = 'severity' | 'package' | 'ecosystem' | 'state' | 'created';
type SortDir = 'asc' | 'desc';

type AlertsTableProps = {
  alerts: Alert[];
  repoFullName: string;
  isLoading: boolean;
};

/** Sortable alerts table shown when a repo is selected. */
export function AlertsTable({
  alerts,
  repoFullName,
  isLoading,
}: AlertsTableProps) {
  const [sortField, setSortField] = useState<SortField>('severity');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortDir('asc');
      }
    },
    [sortField]
  );

  const sorted = useMemo(() => {
    const mult = sortDir === 'asc' ? 1 : -1;
    return [...alerts].sort((a, b) => {
      switch (sortField) {
        case 'severity': {
          const aIdx = SEVERITY_ORDER[a.severity.toLowerCase()] ?? 99;
          const bIdx = SEVERITY_ORDER[b.severity.toLowerCase()] ?? 99;
          return (aIdx - bIdx) * mult;
        }
        case 'package':
          return (
            (a.packageName ?? '').localeCompare(b.packageName ?? '') * mult
          );
        case 'ecosystem':
          return (
            (a.ecosystem ?? '').localeCompare(b.ecosystem ?? '') * mult
          );
        case 'state':
          return a.state.localeCompare(b.state) * mult;
        case 'created':
          return (
            (a.createdAt ?? '').localeCompare(b.createdAt ?? '') * mult
          );
        default:
          return 0;
      }
    });
  }, [alerts, sortField, sortDir]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return (
        <span className="ml-1 text-slate-300 dark:text-slate-600">↕</span>
      );
    }
    return (
      <span className="ml-1">
        {sortDir === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Loading alerts...
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Alerts for{' '}
          <span className="text-blue-600 dark:text-blue-400">
            {repoFullName}
          </span>
          <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">
            ({alerts.length} {alerts.length === 1 ? 'alert' : 'alerts'})
          </span>
        </h3>
      </div>

      {alerts.length === 0 ? (
        <div className="p-6 text-center">
          <p className="text-sm text-green-600 dark:text-green-400">
            No open alerts — looking good!
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50">
                {(
                  [
                    ['severity', 'Severity'],
                    ['package', 'Package'],
                    ['ecosystem', 'Ecosystem'],
                    ['state', 'State'],
                    ['created', 'Created'],
                  ] as [SortField, string][]
                ).map(([field, label]) => (
                  <th
                    key={field}
                    onClick={() => handleSort(field)}
                    className="cursor-pointer select-none px-4 py-2 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    {label}
                    <SortIcon field={field} />
                  </th>
                ))}
                <th className="px-4 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  Link
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sorted.map((alert) => (
                <tr
                  key={alert.alertNumber}
                  className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <td className="px-4 py-2">
                    <SeverityBadge severity={alert.severity} />
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-700 dark:text-slate-300">
                    {alert.packageName ?? '—'}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">
                    {alert.ecosystem ?? '—'}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">
                    {alert.state}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">
                    {alert.createdAt
                      ? new Date(alert.createdAt).toLocaleDateString()
                      : '—'}
                  </td>
                  <td className="px-4 py-2">
                    {alert.htmlUrl ? (
                      <a
                        href={alert.htmlUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
