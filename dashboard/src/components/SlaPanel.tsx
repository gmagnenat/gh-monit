import type { SlaViolation } from '../api/client';
import { formatDate } from '../utils/date';
import { SEVERITY_BADGE } from '../utils/severity';
import { Card } from './Card';
import { EmptyState } from './EmptyState';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './Table';

const SLA_DEFAULTS: { severity: string; limit: string }[] = [
  { severity: 'Critical', limit: '2 days' },
  { severity: 'High', limit: '7 days' },
  { severity: 'Medium', limit: '30 days' },
  { severity: 'Low', limit: '90 days' },
];

type SlaPanelProps = {
  data: SlaViolation[];
};

/** Table of SLA violations sorted by most overdue first. */
export function SlaPanel({ data }: SlaPanelProps) {
  const overdueCount = data.filter((v) => v.overdue).length;

  return (
    <Card>
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
        <EmptyState
          variant="positive"
          message="No open alerts — SLA tracking will start once alerts are synced."
        />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHead>
              <TableHeader>Repo</TableHeader>
              <TableHeader>Alert</TableHeader>
              <TableHeader>Severity</TableHeader>
              <TableHeader>Package</TableHeader>
              <TableHeader>Open Since</TableHeader>
              <TableHeader>Days Open</TableHeader>
              <TableHeader>SLA Limit</TableHeader>
              <TableHeader>Link</TableHeader>
            </TableHead>
            <TableBody>
              {data.map((v) => {
                const isOverdue = v.overdue;
                const sevBadge =
                  SEVERITY_BADGE[v.severity as keyof typeof SEVERITY_BADGE] ?? SEVERITY_BADGE.low;

                return (
                  <TableRow
                    key={`${v.repo}-${v.alertNumber}`}
                    className={
                      isOverdue
                        ? 'bg-red-50/50 dark:bg-red-900/10'
                        : 'transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }
                  >
                    <TableCell className="font-mono text-xs text-slate-700 dark:text-slate-300">
                      {v.repo}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500 dark:text-slate-400">
                      #{v.alertNumber}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${sevBadge}`}
                      >
                        {v.severity}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-700 dark:text-slate-300">
                      {v.packageName ?? '—'}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500 dark:text-slate-400">
                      {formatDate(v.firstSeen)}
                    </TableCell>
                    <TableCell>
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
                    </TableCell>
                    <TableCell className="text-xs text-slate-500 dark:text-slate-400">
                      {v.slaLimitDays}d
                    </TableCell>
                    <TableCell>
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
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}
