import type { DependencyGroup } from '../api/client';
import { useExpandableRow } from '../hooks/useExpandableRow';
import { SEVERITY_BADGE } from '../utils/severity';
import { Card } from './Card';
import { EmptyState } from './EmptyState';
import { ExpandButton } from './ExpandButton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './Table';

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
  const { isExpanded, toggle } = useExpandableRow();

  if (data.length === 0) {
    return (
      <EmptyState
        title="Dependency Landscape"
        message="No open alerts with package data found. Sync repos to populate this view."
      />
    );
  }

  return (
    <Card>
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
        <Table>
          <TableHead>
            <TableHeader>Package</TableHeader>
            <TableHeader>Ecosystem</TableHeader>
            <TableHeader>Alerts</TableHeader>
            <TableHeader>Severity Breakdown</TableHeader>
            <TableHeader>Repos</TableHeader>
          </TableHead>
          <TableBody>
            {data.map((dep) => {
              const key = `${dep.packageName}:${dep.ecosystem ?? ''}`;
              const expanded = isExpanded(key);
              const ecoStyle =
                ECOSYSTEM_COLORS[(dep.ecosystem ?? '').toLowerCase()] ??
                DEFAULT_ECOSYSTEM_STYLE;
              const mediumCount =
                dep.totalAlerts - dep.criticalCount - dep.highCount;

              return (
                <TableRow key={key}>
                  <TableCell className="font-mono text-xs text-slate-700 dark:text-slate-300">
                    {dep.packageName}
                  </TableCell>
                  <TableCell>
                    {dep.ecosystem ? (
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${ecoStyle}`}
                      >
                        {dep.ecosystem}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    {dep.totalAlerts}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {dep.criticalCount > 0 && (
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${SEVERITY_BADGE.critical}`}>
                          {dep.criticalCount} critical
                        </span>
                      )}
                      {dep.highCount > 0 && (
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${SEVERITY_BADGE.high}`}>
                          {dep.highCount} high
                        </span>
                      )}
                      {mediumCount > 0 && (
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${SEVERITY_BADGE.medium}`}>
                          {mediumCount} other
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <ExpandButton
                      count={dep.affectedRepos}
                      expanded={expanded}
                      onClick={() => toggle(key)}
                    />
                    {expanded && (
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
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
