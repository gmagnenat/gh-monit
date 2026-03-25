import { useState } from 'react';
import type { FixAction, FixAdvisorResponse } from '../api/client';
import { SEVERITY_BADGE } from '../utils/severity';
import { Card } from './Card';
import { EmptyState } from './EmptyState';

type FixPlanTableProps = {
  data: FixAdvisorResponse;
  loading: boolean;
  error: string | null;
  showRepos?: boolean;
};

/** Fix advisor table showing grouped fix recommendations. */
export function FixPlanTable({ data, loading, error, showRepos }: FixPlanTableProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-4">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      </Card>
    );
  }

  if (data.totalAlerts === 0) {
    return (
      <EmptyState
        title="Fix Plan"
        message="No open alerts to fix. All clear!"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-baseline gap-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Fix Plan
        </h3>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {data.totalAlerts} alert{data.totalAlerts !== 1 ? 's' : ''} &middot;{' '}
          {data.totalActions} fixable
        </span>
      </div>

      {/* Fixable actions */}
      {data.actions.length > 0 && (
        <Card>
          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Fixable
            </h4>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.actions.map((action) => (
              <FixActionRow
                key={`${action.packageName}-${action.ecosystem}`}
                action={action}
                showRepos={showRepos}
              />
            ))}
          </div>
        </Card>
      )}

      {/* No fix available */}
      {data.noFixAvailable.length > 0 && (
        <NoFixSection actions={data.noFixAvailable} showRepos={showRepos} />
      )}
    </div>
  );
}

function FixActionRow({
  action,
  showRepos,
}: {
  action: FixAction;
  showRepos?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const badge =
    SEVERITY_BADGE[action.groupSeverity as keyof typeof SEVERITY_BADGE] ??
    SEVERITY_BADGE.low;

  return (
    <div className="px-4 py-3">
      <div
        className="flex cursor-pointer items-center gap-3"
        onClick={() => setIsExpanded((v) => !v)}
      >
        <svg
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>

        <span className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${badge}`}>
          {action.groupSeverity}
        </span>

        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
          {action.packageName}
        </span>

        {action.ecosystem && (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {action.ecosystem}
          </span>
        )}

        <span className="text-xs text-slate-500 dark:text-slate-400">
          {action.alertCount} alert{action.alertCount !== 1 ? 's' : ''}
        </span>

        {action.patchedVersion && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400">
            update to &gt;={action.patchedVersion}
          </span>
        )}

        {showRepos && action.affectedRepos && (
          <span className="ml-auto text-xs text-slate-400">
            {action.affectedRepos} repo{action.affectedRepos !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {isExpanded && (
        <div className="mt-2 ml-7 space-y-1">
          {action.manifestPaths.length > 0 && (
            <p className="text-xs text-slate-400">
              via {action.manifestPaths.join(', ')}
            </p>
          )}

          {action.maxCvssScore != null && (
            <p className="text-xs text-slate-400">
              Max CVSS: {action.maxCvssScore}
            </p>
          )}

          {showRepos && action.repos && action.repos.length > 0 && (
            <p className="text-xs text-slate-400">
              Repos: {action.repos.join(', ')}
            </p>
          )}

          <div className="mt-1 space-y-0.5">
            {action.alerts.map((alert) => (
              <div
                key={`${alert.repo ?? ''}-${alert.alertNumber}`}
                className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"
              >
                <span className="text-slate-400">#{alert.alertNumber}</span>
                <span>{alert.summary ?? 'No summary'}</span>
              </div>
            ))}
          </div>

          {action.ghsaIds.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {action.ghsaIds.map((id) => (
                <a
                  key={id}
                  href={`https://github.com/advisories/${id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                >
                  {id}
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NoFixSection({
  actions,
  showRepos,
}: {
  actions: FixAction[];
  showRepos?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const totalAlerts = actions.reduce((s, a) => s + a.alertCount, 0);

  return (
    <Card className="opacity-75">
      <div
        className="flex cursor-pointer items-center gap-2 px-4 py-3"
        onClick={() => setIsOpen((v) => !v)}
      >
        <svg
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400">
          No Fix Available
        </h4>
        <span className="text-xs text-slate-400">
          {actions.length} package{actions.length !== 1 ? 's' : ''} &middot;{' '}
          {totalAlerts} alert{totalAlerts !== 1 ? 's' : ''}
        </span>
      </div>

      {isOpen && (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {actions.map((action) => (
            <div
              key={`${action.packageName}-${action.ecosystem}`}
              className="flex items-center gap-3 px-4 py-2 pl-11"
            >
              <span className="text-sm text-slate-600 dark:text-slate-300">
                {action.packageName}
              </span>
              {action.ecosystem && (
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  {action.ecosystem}
                </span>
              )}
              <span className="text-xs text-slate-400">
                {action.alertCount} alert{action.alertCount !== 1 ? 's' : ''} — no patched version
              </span>
              {showRepos && action.affectedRepos && (
                <span className="ml-auto text-xs text-slate-400">
                  {action.affectedRepos} repo{action.affectedRepos !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
