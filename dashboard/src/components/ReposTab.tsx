import { useState } from 'react';
import type { RepoAlertsResponse, RepoSortOption, RepoSummary, SeverityFilter } from '../api/client';
import { filterReposByName, filterReposBySeverity, sortRepos } from '../api/client';
import type { TimelineState } from '../hooks/useHistory';
import { AddReposModal } from './AddReposModal';
import { AlertsTable } from './AlertsTable';
import { AlertTimeline } from './AlertTimeline';
import { RepoGrid } from './RepoGrid';
import { RepoToolbar } from './RepoToolbar';

type ReposTabProps = {
  repos: RepoSummary[];
  selectedRepo: string | null;
  repoAlerts: RepoAlertsResponse | null;
  timeline: TimelineState;
  bulkRefreshing: boolean;
  isRefreshing: (repo: string) => boolean;
  isLoadingAlerts: (repo: string) => boolean;
  onRefreshRepo: (owner: string, name: string) => void;
  onRefreshAll: () => void;
  onSelectRepo: (repoFullName: string | null) => void;
  onAddedRepos: () => void;
  onRemoveRepo: (owner: string, name: string) => Promise<void>;
};

/** Repos tab content: toolbar, grid, alerts table, and timeline. */
export function ReposTab({
  repos,
  selectedRepo,
  repoAlerts,
  timeline,
  bulkRefreshing,
  isRefreshing,
  isLoadingAlerts,
  onRefreshRepo,
  onRefreshAll,
  onSelectRepo,
  onAddedRepos,
  onRemoveRepo,
}: ReposTabProps) {
  const monitoredRepoNames = new Set(repos.map((r) => r.repo));
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<RepoSortOption>('name');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>({
    critical: false,
    high: false,
    medium: false,
    low: false,
  });

  const filteredRepos = filterReposBySeverity(
    filterReposByName(repos, searchQuery),
    severityFilter
  );
  const sortedRepos = sortRepos(filteredRepos, sortOption);

  return (
    <>
      <RepoToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sortOption={sortOption}
        onSortChange={setSortOption}
        severityFilter={severityFilter}
        onSeverityFilterChange={setSeverityFilter}
        onRefreshAll={onRefreshAll}
        bulkRefreshing={bulkRefreshing}
        repoCount={repos.length}
        filteredCount={sortedRepos.length}
        extraActions={
          <AddReposModal
            monitoredRepoNames={monitoredRepoNames}
            onAdded={onAddedRepos}
          />
        }
      />

      <RepoGrid
        repos={sortedRepos}
        selectedRepo={selectedRepo}
        isRefreshing={isRefreshing}
        onSelectRepo={(repoFullName) => {
          onSelectRepo(
            selectedRepo === repoFullName ? null : repoFullName
          );
        }}
        onRefreshRepo={onRefreshRepo}
        onRemoveRepo={onRemoveRepo}
      />

      {selectedRepo && (
        <>
          <AlertsTable
            alerts={repoAlerts?.alerts ?? []}
            repoFullName={selectedRepo}
            isLoading={isLoadingAlerts(selectedRepo)}
          />
          <AlertTimeline
            entries={timeline.entries}
            loading={timeline.loading}
          />
        </>
      )}
    </>
  );
}
