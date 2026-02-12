import { useTheme } from './hooks/useTheme';
import { useDashboard } from './hooks/useDashboard';
import { Layout } from './components/Layout';
import { SummaryCards } from './components/SummaryCards';
import { RepoGrid } from './components/RepoGrid';
import { AlertsTable } from './components/AlertsTable';

export function App() {
  const { theme, toggle } = useTheme();
  const {
    summary,
    repos,
    loading,
    error,
    selectedRepo,
    repoAlerts,
    isRefreshing,
    isLoadingAlerts,
    refreshRepo,
    selectRepo,
  } = useDashboard();

  return (
    <Layout theme={theme} onToggleTheme={toggle}>
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

          {/* Repo grid */}
          <RepoGrid
            repos={repos}
            selectedRepo={selectedRepo}
            isRefreshing={isRefreshing}
            onSelectRepo={(repoFullName) => {
              // Toggle selection: click again to deselect
              selectRepo(selectedRepo === repoFullName ? null : repoFullName);
            }}
            onRefreshRepo={refreshRepo}
          />

          {/* Alerts table for selected repo */}
          {selectedRepo && (
            <AlertsTable
              alerts={repoAlerts?.alerts ?? []}
              repoFullName={selectedRepo}
              isLoading={isLoadingAlerts(selectedRepo)}
            />
          )}
        </div>
      )}
    </Layout>
  );
}
