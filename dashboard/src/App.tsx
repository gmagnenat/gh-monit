import { useState } from 'react';
import { useDashboard } from './hooks/useDashboard';
import { useAlertTimeline, useHistory, useVulnDep } from './hooks/useHistory';
import { useTheme } from './hooks/useTheme';
import { AnalyticsTab } from './components/AnalyticsTab';
import { ErrorBanner } from './components/ErrorBanner';
import { ExportMenu } from './components/ExportMenu';
import { Layout } from './components/Layout';
import { ReposTab } from './components/ReposTab';
import { SummaryCards } from './components/SummaryCards';
import { TabNav } from './components/TabNav';
import { filterReposByName, filterReposBySeverity, sortRepos } from './api/client';

type Tab = 'repos' | 'analytics';
type AnalyticsSubTab = 'trends' | 'vulnerabilities' | 'dependencies';

const MAIN_TABS: { id: Tab; label: string }[] = [
  { id: 'repos', label: 'Repos' },
  { id: 'analytics', label: 'Analytics' },
];

export function App() {
  const { theme, toggle } = useTheme();
  const dashboard = useDashboard();

  // Tab state
  const [activeTab, setActiveTab] = useState<Tab>('repos');
  const [analyticsSubTab, setAnalyticsSubTab] =
    useState<AnalyticsSubTab>('trends');

  // Lazy-loaded analytics hooks
  const history = useHistory(
    activeTab === 'analytics' && analyticsSubTab === 'trends'
  );
  const vulnDep = useVulnDep(
    activeTab === 'analytics' &&
      (analyticsSubTab === 'vulnerabilities' ||
        analyticsSubTab === 'dependencies')
  );

  // Alert timeline for selected repo
  const timeline = useAlertTimeline(dashboard.selectedRepo);

  // Compute sorted repos for ExportMenu (needed at top level)
  const sortedRepos = sortRepos(
    filterReposBySeverity(filterReposByName(dashboard.repos, ''), {
      critical: false,
      high: false,
      medium: false,
      low: false,
    }),
    'name'
  );

  return (
    <Layout
      theme={theme}
      onToggleTheme={toggle}
      headerRight={
        <ExportMenu
          repos={sortedRepos}
          alerts={dashboard.repoAlerts?.alerts ?? null}
          selectedRepo={dashboard.selectedRepo}
        />
      }
    >
      {dashboard.error && <ErrorBanner message={dashboard.error} />}
      {dashboard.refreshError && <ErrorBanner message={dashboard.refreshError} />}

      {dashboard.loading ? (
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
          <SummaryCards summary={dashboard.summary} />
          <TabNav tabs={MAIN_TABS} activeTab={activeTab} onTabChange={setActiveTab} />

          {activeTab === 'repos' && (
            <ReposTab
              repos={dashboard.repos}
              selectedRepo={dashboard.selectedRepo}
              repoAlerts={dashboard.repoAlerts}
              timeline={timeline}
              bulkRefreshing={dashboard.bulkRefreshing}
              isRefreshing={dashboard.isRefreshing}
              isLoadingAlerts={dashboard.isLoadingAlerts}
              onRefreshRepo={dashboard.refreshRepo}
              onRefreshAll={dashboard.refreshAll}
              onSelectRepo={dashboard.selectRepo}
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsTab
              history={history}
              vulnDep={vulnDep}
              activeSubTab={analyticsSubTab}
              onSubTabChange={setAnalyticsSubTab}
            />
          )}
        </div>
      )}
    </Layout>
  );
}
