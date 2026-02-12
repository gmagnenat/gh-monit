import { useMemo } from 'react';
import type { MttrMetric } from '../api/client';
import { parseRepo } from '../utils/repo';
import { SEVERITIES, SEVERITY_CARD } from '../utils/severity';
import { Card } from './Card';
import { EmptyState } from './EmptyState';

type MttrCardsProps = {
  data: MttrMetric[];
};

/** Grid of metric cards showing average remediation time per severity level. */
export function MttrCards({ data }: MttrCardsProps) {
  // Aggregate metrics by severity across all repos
  const bySeverity = useMemo(() => {
    const map = new Map<
      string,
      { totalDays: number; totalResolved: number; repos: Map<string, number> }
    >();

    for (const m of data) {
      let entry = map.get(m.severity);
      if (!entry) {
        entry = { totalDays: 0, totalResolved: 0, repos: new Map() };
        map.set(m.severity, entry);
      }
      entry.totalDays += m.avgDays * m.resolvedCount;
      entry.totalResolved += m.resolvedCount;
      entry.repos.set(m.repo, m.avgDays);
    }

    return SEVERITIES
      .filter((s) => map.has(s))
      .map((severity) => {
        const entry = map.get(severity)!;
        const avgDays =
          entry.totalResolved > 0
            ? Math.round((entry.totalDays / entry.totalResolved) * 10) / 10
            : 0;
        return {
          severity,
          avgDays,
          resolvedCount: entry.totalResolved,
          repos: entry.repos,
        };
      });
  }, [data]);

  if (data.length === 0) {
    return (
      <EmptyState
        title="Mean Time to Remediate"
        message="No resolved alerts yet. MTTR metrics will appear once alerts are fixed or dismissed."
      />
    );
  }

  // Find the max avgDays across all repos for bar scaling
  const maxDays = Math.max(...data.map((m) => m.avgDays), 1);

  return (
    <Card className="p-6">
      <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
        Mean Time to Remediate
      </h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {bySeverity.map(({ severity, avgDays, resolvedCount, repos }) => {
          const styles = SEVERITY_CARD[severity as keyof typeof SEVERITY_CARD] ?? SEVERITY_CARD.low;
          return (
            <div
              key={severity}
              className={`rounded-lg border border-slate-200 p-4 dark:border-slate-700 ${styles.bg}`}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className={`text-xs font-semibold uppercase ${styles.text}`}>
                  {severity}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {resolvedCount} resolved
                </span>
              </div>
              <p className={`text-2xl font-bold ${styles.text}`}>
                {avgDays}
                <span className="text-sm font-normal"> days</span>
              </p>
              {/* Per-repo bars */}
              {repos.size > 1 && (
                <div className="mt-3 space-y-1">
                  {[...repos.entries()]
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([repo, days]) => (
                      <div key={repo} className="flex items-center gap-2">
                        <span className="w-24 truncate text-[10px] text-slate-500 dark:text-slate-400">
                          {parseRepo(repo)?.name ?? repo}
                        </span>
                        <div className="flex-1">
                          <div
                            className={`h-1.5 rounded-full ${styles.bar}`}
                            style={{
                              width: `${Math.max((days / maxDays) * 100, 4)}%`,
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                          {days}d
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
