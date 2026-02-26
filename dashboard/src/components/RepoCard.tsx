import { useState } from 'react';
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
  onRemove: (owner: string, name: string) => Promise<void>;
};

/** Per-repo card with severity breakdown bar, sync time, refresh and remove. */
export function RepoCard({
  repo,
  isSelected,
  isRefreshing,
  onSelect,
  onRefresh,
  onRemove,
}: RepoCardProps) {
  const { owner, name } = parseRepo(repo.repo) ?? { owner: '', name: '' };
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);

  const handleRemove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setRemoving(true);
    try {
      await onRemove(owner, name);
    } catch {
      setRemoving(false);
      setConfirming(false);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !confirming && onSelect(repo.repo)}
      onKeyDown={(e) => {
        if (!confirming && (e.key === 'Enter' || e.key === ' ')) {
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

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between">
        {confirming ? (
          /* Inline confirmation row */
          <div className="flex w-full items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Remove this repo?
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); setConfirming(false); }}
                disabled={removing}
                className="rounded px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleRemove}
                disabled={removing}
                className="inline-flex items-center gap-1 rounded bg-red-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-60"
              >
                {removing && (
                  <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                Remove
              </button>
            </div>
          </div>
        ) : (
          <>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              Synced {formatRelativeTime(repo.lastSync)}
            </span>
            <div className="flex items-center gap-1">
              {/* Remove button */}
              <button
                onClick={(e) => { e.stopPropagation(); setConfirming(true); }}
                aria-label={`Remove ${repo.repo}`}
                className="rounded-md p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:text-slate-500 dark:hover:bg-red-900/20 dark:hover:text-red-400"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              {/* Refresh button */}
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
          </>
        )}
      </div>
    </div>
  );
}
