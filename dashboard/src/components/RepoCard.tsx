import type { RepoSummary } from '../api/client';
import { formatRelativeTime } from '../utils/date';
import { parseRepo } from '../utils/repo';
import { SEVERITIES, SEVERITY_BAR } from '../utils/severity';

type RepoCardProps = {
  repo: RepoSummary;
  isSelected: boolean;
  isRefreshing: boolean;
  onSelect: (repoFullName: string) => void;
  onRefresh: (owner: string, name: string) => void;
};

/** Per-repo card with severity breakdown bar, sync time, and refresh button. */
export function RepoCard({
  repo,
  isSelected,
  isRefreshing,
  onSelect,
  onRefresh,
}: RepoCardProps) {
  const { owner, name } = parseRepo(repo.repo) ?? { owner: '', name: '' };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(repo.repo)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(repo.repo);
        }
      }}
      className={`cursor-pointer rounded-xl border bg-white p-4 shadow-sm transition-all hover:shadow-md dark:bg-slate-900 ${
        isSelected
          ? 'border-blue-500 ring-2 ring-blue-500/20 dark:border-blue-400 dark:ring-blue-400/20'
          : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      {/* Repo name */}
      <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
        {repo.repo}
      </h3>

      {/* Severity breakdown bar */}
      {repo.totalAlerts > 0 ? (
        <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          {SEVERITIES.map((key) => {
            const count = repo.severityCounts[key] ?? 0;
            if (count === 0) return null;
            const pct = (count / repo.totalAlerts) * 100;
            return (
              <div
                key={key}
                className={`${SEVERITY_BAR[key]} transition-all`}
                style={{ width: `${pct}%` }}
                title={`${key}: ${count}`}
              />
            );
          })}
        </div>
      ) : (
        <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div className="w-full bg-green-400/40 dark:bg-green-500/30" />
        </div>
      )}

      {/* Severity counts */}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
        {SEVERITIES.map((key) => {
          const count = repo.severityCounts[key] ?? 0;
          return (
            <span key={key}>
              {count} {key}
            </span>
          );
        })}
      </div>

      {/* Footer: sync time + refresh */}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-slate-400 dark:text-slate-500">
          Synced {formatRelativeTime(repo.lastSync)}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRefresh(owner, name);
          }}
          disabled={isRefreshing}
          aria-label={`Refresh ${repo.repo}`}
          className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
          >
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
      </div>
    </div>
  );
}
