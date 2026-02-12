import { useCallback, useMemo, useState } from 'react';
import type { Alert } from '../api/client';
import { formatRelativeTime } from '../utils/date';
import { SEVERITY_ORDER } from '../utils/severity';
import { Card } from './Card';
import { SeverityBadge } from './SeverityBadge';
import { Table, TableBody, TableCell, TableRow } from './Table';

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
  // Default to newest alerts first
  const [sortField, setSortField] = useState<SortField>('created');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

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
          const aIdx = SEVERITY_ORDER[a.severity.toLowerCase() as keyof typeof SEVERITY_ORDER] ?? 99;
          const bIdx = SEVERITY_ORDER[b.severity.toLowerCase() as keyof typeof SEVERITY_ORDER] ?? 99;
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
      <Card className="mt-4 p-6 text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Loading alerts...
        </p>
      </Card>
    );
  }

  return (
    <Card className="mt-4 overflow-hidden">
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
          <Table>
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
            <TableBody>
              {sorted.map((alert) => (
                <TableRow key={alert.alertNumber}>
                  <TableCell>
                    <SeverityBadge severity={alert.severity} />
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-700 dark:text-slate-300">
                    {alert.packageName ?? '—'}
                  </TableCell>
                  <TableCell className="text-xs text-slate-500 dark:text-slate-400">
                    {alert.ecosystem ?? '—'}
                  </TableCell>
                  <TableCell className="text-xs text-slate-500 dark:text-slate-400">
                    {alert.state}
                  </TableCell>
                  <TableCell
                    className="text-xs text-slate-500 dark:text-slate-400"
                    title={alert.createdAt ?? undefined}
                  >
                    {formatRelativeTime(alert.createdAt)}
                  </TableCell>
                  <TableCell>
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}
