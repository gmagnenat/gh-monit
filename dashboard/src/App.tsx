import { useState } from 'react';
import { useTheme } from './hooks/useTheme';
import { useDashboard } from './hooks/useDashboard';
import { useHistory, useAlertTimeline, useVulnDep } from './hooks/useHistory';
import { Layout } from './components/Layout';
import { SummaryCards } from './components/SummaryCards';
import { RepoToolbar } from './components/RepoToolbar';
import { RepoGrid } from './components/RepoGrid';
import { AlertsTable } from './components/AlertsTable';
import { AlertTimeline } from './components/AlertTimeline';
import { ExportMenu } from './components/ExportMenu';
import { TrendChart } from './components/TrendChart';
import { MttrCards } from './components/MttrCards';
import { SlaPanel } from './components/SlaPanel';
import { VulnerabilityTable } from './components/VulnerabilityTable';
import { DependencyTable } from './components/DependencyTable';
import { EcosystemChart } from './components/EcosystemChart';
import type { RepoSortOption, SeverityFilter } from './api/client';
import {
  filterReposByName,
  filterReposBySeverity,
  sortRepos,
} from './api/client';

type Tab = 'repos' | 'analytics';
type AnalyticsSubTab = 'trends' | 'vulnerabilities' | 'dependencies';

export function App() {
  const { theme, toggle } = useTheme();
  const {
    summary,
    repos,
    loading,
    error,
    selectedRepo,
    repoAlerts,
    bulkRefreshing,
    isRefreshing,
    isLoadingAlerts,
    refreshRepo,
    refreshAll,
    selectRepo,
  } = useDashboard();

  // Tab state
  const [activeTab, setActiveTab] = useState<Tab>('repos');
  const [analyticsSubTab, setAnalyticsSubTab] =
    useState<AnalyticsSubTab>('trends');

  // History analytics — lazy loaded when Analytics/Trends tab is first opened
  const history = useHistory(
    activeTab === 'analytics' && analyticsSubTab === 'trends'
  );

  // Vulnerability & dependency analytics — lazy loaded on first view
  const vulnDep = useVulnDep(
    activeTab === 'analytics' &&
      (analyticsSubTab === 'vulnerabilities' ||
        analyticsSubTab === 'dependencies')
  );

  // Alert timeline for selected repo
  const timeline = useAlertTimeline(selectedRepo);

  // Filter and sort state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<RepoSortOption>('name');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>({
    critical: false,
    high: false,
    medium: false,
    low: false,
  });

  // Apply filters and sort
  const filteredRepos = filterReposBySeverity(
    filterReposByName(repos, searchQuery),
    severityFilter
  );
  const sortedRepos = sortRepos(filteredRepos, sortOption);

  return (
    <Layout
      theme={theme}
      onToggleTheme={toggle}
      headerRight={
        <ExportMenu
          repos={sortedRepos}
          alerts={repoAlerts?.alerts ?? null}
          selectedRepo={selectedRepo}
        />
      }
    >
      {/* Error banner */}
      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800"
              />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-36 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800"
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary stats */}
          <SummaryCards summary={summary} />

          {/* Tab navigation */}
          <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800">
            {(
              [
                ['repos', 'Repos'],
                ['analytics', 'Analytics'],
              ] as [Tab, string][]
            ).map(([tab, label]) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Repos tab */}
          {activeTab === 'repos' && (
            <>
              {/* Toolbar: search, sort, filter, refresh all */}
              <RepoToolbar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                sortOption={sortOption}
                onSortChange={setSortOption}
                severityFilter={severityFilter}
                onSeverityFilterChange={setSeverityFilter}
                onRefreshAll={refreshAll}
                bulkRefreshing={bulkRefreshing}
                repoCount={repos.length}
                filteredCount={sortedRepos.length}
              />

              {/* Repo grid */}
              <RepoGrid
                repos={sortedRepos}
                selectedRepo={selectedRepo}
                isRefreshing={isRefreshing}
                onSelectRepo={(repoFullName) => {
                  selectRepo(
                    selectedRepo === repoFullName ? null : repoFullName
                  );
                }}
                onRefreshRepo={refreshRepo}
              />

              {/* Alerts table for selected repo */}
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
          )}

          {/* Analytics tab */}
          {activeTab === 'analytics' && (
            <>
              {/* Analytics sub-tabs */}
              <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800">
                {(
                  [
                    ['trends', 'Trends'],
                    ['vulnerabilities', 'Vulnerabilities'],
                    ['dependencies', 'Dependencies'],
                  ] as [AnalyticsSubTab, string][]
                ).map(([tab, label]) => (
                  <button
                    key={tab}
                    onClick={() => setAnalyticsSubTab(tab)}
                    className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                      analyticsSubTab === tab
                        ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Trends sub-tab */}
              {analyticsSubTab === 'trends' && (
                <>
                  {history.loading ? (
                    <div className="space-y-6">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div
                          key={i}
                          className="h-48 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800"
                        />
                      ))}
                    </div>
                  ) : history.error ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                      {history.error}
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <TrendChart data={history.trends} />
                      <MttrCards data={history.mttr} />
                      <SlaPanel data={history.sla} />
                    </div>
                  )}
                </>
              )}

              {/* Vulnerabilities sub-tab */}
              {analyticsSubTab === 'vulnerabilities' && (
                <>
                  {vulnDep.loading ? (
                    <div className="h-48 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
                  ) : vulnDep.error ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                      {vulnDep.error}
                    </div>
                  ) : (
                    <VulnerabilityTable data={vulnDep.vulnerabilities} />
                  )}
                </>
              )}

              {/* Dependencies sub-tab */}
              {analyticsSubTab === 'dependencies' && (
                <>
                  {vulnDep.loading ? (
                    <div className="space-y-6">
                      <div className="h-48 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
                      <div className="h-48 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
                    </div>
                  ) : vulnDep.error ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                      {vulnDep.error}
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <EcosystemChart data={vulnDep.ecosystems} />
                      <DependencyTable data={vulnDep.dependencies} />
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </Layout>
  );
}
