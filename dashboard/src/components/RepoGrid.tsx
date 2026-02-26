import type { RepoSummary } from '../api/client';
import { RepoCard } from './RepoCard';

type RepoGridProps = {
  repos: RepoSummary[];
  selectedRepo: string | null;
  isRefreshing: (repo: string) => boolean;
  onSelectRepo: (repoFullName: string) => void;
  onRefreshRepo: (owner: string, name: string) => void;
  onRemoveRepo: (owner: string, name: string) => Promise<void>;
};

/** Responsive grid of repo cards. 3 cols on desktop, 2 on tablet, 1 on mobile. */
export function RepoGrid({
  repos,
  selectedRepo,
  isRefreshing,
  onSelectRepo,
  onRefreshRepo,
  onRemoveRepo,
}: RepoGridProps) {
  if (repos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No repositories tracked yet.
        </p>
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          Run{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-800">
            gh-monit dependabot --repo owner/name
          </code>{' '}
          to start tracking.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {repos.map((repo) => (
        <RepoCard
          key={repo.repo}
          repo={repo}
          isSelected={selectedRepo === repo.repo}
          isRefreshing={isRefreshing(repo.repo)}
          onSelect={onSelectRepo}
          onRefresh={onRefreshRepo}
          onRemove={onRemoveRepo}
        />
      ))}
    </div>
  );
}
