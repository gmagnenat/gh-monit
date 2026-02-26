import { useState } from 'react';
import { useDashboard } from './hooks/useDashboard';
import { useAlertTimeline, useHistory, useVulnDep } from './hooks/useHistory';
import { useTheme } from './hooks/useTheme';
import { useSetupWizard } from './hooks/useSetupWizard';
import { AnalyticsTab } from './components/AnalyticsTab';
import { ErrorBanner } from './components/ErrorBanner';
import { ExportMenu } from './components/ExportMenu';
import { Layout } from './components/Layout';
import { ReposTab } from './components/ReposTab';
import { SetupWizard } from './components/SetupWizard';
import { SettingsPanel } from './components/SettingsPanel';
import { SummaryCards } from './components/SummaryCards';
import { TabNav } from './components/TabNav';
import { deleteRepo, filterReposByName, filterReposBySeverity, sortRepos } from './api/client';

type Tab = 'repos' | 'analytics';
type AnalyticsSubTab = 'trends' | 'vulnerabilities' | 'dependencies';

const MAIN_TABS: { id: Tab; label: string }[] = [
  { id: 'repos', label: 'Repos' },
  { id: 'analytics', label: 'Analytics' },
];

function NormalDashboard({
  theme,
  toggle,
  onReset,
}: {
  theme: 'light' | 'dark';
  toggle: () => void;
  onReset: () => void;
}) {
  const dashboard = useDashboard();

  const [activeTab, setActiveTab] = useState<Tab>('repos');
  const [analyticsSubTab, setAnalyticsSubTab] =
    useState<AnalyticsSubTab>('trends');

  const history = useHistory(
    activeTab === 'analytics' && analyticsSubTab === 'trends'
  );
  const vulnDep = useVulnDep(
    activeTab === 'analytics' &&
      (analyticsSubTab === 'vulnerabilities' ||
        analyticsSubTab === 'dependencies')
  );

  const timeline = useAlertTimeline(dashboard.selectedRepo);

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
        <div className="flex items-center gap-2">
          <ExportMenu
            repos={sortedRepos}
            alerts={dashboard.repoAlerts?.alerts ?? null}
            selectedRepo={dashboard.selectedRepo}
          />
          <SettingsPanel onReset={onReset} />
        </div>
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
              onAddedRepos={dashboard.reload}
              onRemoveRepo={async (owner, name) => {
                const fullName = `${owner}/${name}`;
                if (dashboard.selectedRepo === fullName) {
                  dashboard.selectRepo(null);
                }
                await deleteRepo(owner, name);
                await dashboard.reload();
              }}
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

export function App() {
  const { theme, toggle } = useTheme();
  const [setupDone, setSetupDone] = useState(false);
  const wizard = useSetupWizard({ onDone: () => setSetupDone(true) });

  if (!setupDone) {
    return (
      <Layout theme={theme} onToggleTheme={toggle}>
        <SetupWizard
          state={wizard.state}
          onToggle={wizard.toggleRepo}
          onToggleAll={wizard.toggleAll}
          onConfirm={wizard.confirm}
          onSkip={wizard.skip}
          onRetry={wizard.retry}
          onSearchChange={wizard.setSearch}
        />
      </Layout>
    );
  }

  const handleReset = () => {
    setSetupDone(false);
    wizard.retry();
  };

  return <NormalDashboard theme={theme} toggle={toggle} onReset={handleReset} />;
}
