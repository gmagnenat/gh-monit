import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  RepoAlertsResponse,
  RepoSummary,
  SummaryResponse,
} from '../api/client';
import {
  fetchRepoAlerts,
  fetchRepos,
  fetchSummary,
  refreshAllReposStream,
  refreshRepo,
} from '../api/client';
import { parseRepo } from '../utils/repo';

type DashboardState = {
  summary: SummaryResponse | null;
  repos: RepoSummary[];
  loading: boolean;
  error: string | null;
};

type RepoLoadingState = {
  refreshing: Set<string>;
  loadingAlerts: Set<string>;
  bulkRefreshing: boolean;
  refreshProgress: { completed: number; total: number } | null;
  refreshDone: boolean;
};

const POLL_INTERVAL_MS = 60_000;

/**
 * Central data-fetching hook for the dashboard.
 * Fetches summary + repos on mount, supports per-repo refresh,
 * alert fetching, and auto-polling every 60 seconds.
 */
export function useDashboard() {
  const [state, setState] = useState<DashboardState>({
    summary: null,
    repos: [],
    loading: true,
    error: null,
  });

  const [repoLoading, setRepoLoading] = useState<RepoLoadingState>({
    refreshing: new Set(),
    loadingAlerts: new Set(),
    bulkRefreshing: false,
    refreshProgress: null,
    refreshDone: false,
  });

  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [repoAlerts, setRepoAlerts] = useState<RepoAlertsResponse | null>(
    null
  );
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval>>(null);
  const clearDoneRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Fetch global summary and repo list. */
  const loadDashboard = useCallback(async () => {
    try {
      const [summary, repos] = await Promise.all([
        fetchSummary(),
        fetchRepos(),
      ]);
      setState({ summary, repos, loading: false, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load';
      setState((prev) => ({ ...prev, loading: false, error: message }));
    }
  }, []);

  /** Refresh a single repo from GitHub, then reload the dashboard. */
  const handleRefreshRepo = useCallback(
    async (owner: string, name: string) => {
      const key = `${owner}/${name}`;
      setRepoLoading((prev) => ({
        ...prev,
        refreshing: new Set(prev.refreshing).add(key),
      }));

      try {
        setRefreshError(null);
        const updated = await refreshRepo(owner, name);

        // If this repo is currently selected, update its alerts
        if (selectedRepo === key) {
          setRepoAlerts(updated);
        }

        // Reload dashboard to get updated summary + repo list
        await loadDashboard();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : `Failed to refresh ${key}`;
        setRefreshError(message);
      } finally {
        setRepoLoading((prev) => {
          const next = new Set(prev.refreshing);
          next.delete(key);
          return { ...prev, refreshing: next };
        });
      }
    },
    [selectedRepo, loadDashboard]
  );

  /** Refresh all tracked repos from GitHub with SSE progress streaming. */
  const handleRefreshAll = useCallback(async () => {
    if (clearDoneRef.current) { clearTimeout(clearDoneRef.current); clearDoneRef.current = null; }

    setRepoLoading((prev) => ({ ...prev, bulkRefreshing: true, refreshDone: false, refreshProgress: null }));

    try {
      setRefreshError(null);
      await refreshAllReposStream((progress) => {
        setRepoLoading((prev) => ({
          ...prev,
          refreshProgress: { completed: progress.completed, total: progress.total },
        }));
      });
      await loadDashboard();
      if (selectedRepo) {
        const parsed = parseRepo(selectedRepo);
        if (parsed) {
          const result = await fetchRepoAlerts(parsed.owner, parsed.name);
          setRepoAlerts(result);
        }
      }

      setRepoLoading((prev) => ({ ...prev, bulkRefreshing: false, refreshDone: true }));
      clearDoneRef.current = setTimeout(() => {
        setRepoLoading((prev) => ({ ...prev, refreshDone: false, refreshProgress: null }));
        clearDoneRef.current = null;
      }, 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to refresh all repos';
      setRefreshError(message);
      setRepoLoading((prev) => ({ ...prev, bulkRefreshing: false, refreshDone: false, refreshProgress: null }));
    }
  }, [loadDashboard, selectedRepo]);

  /** Select a repo and fetch its alerts. Pass null to deselect. */
  const handleSelectRepo = useCallback(async (repoFullName: string | null) => {
    setSelectedRepo(repoFullName);
    setRepoAlerts(null);

    if (!repoFullName) return;

    const parsed = parseRepo(repoFullName);
    if (!parsed) return;
    const { owner, name } = parsed;

    setRepoLoading((prev) => ({
      ...prev,
      loadingAlerts: new Set(prev.loadingAlerts).add(repoFullName),
    }));

    try {
      setRefreshError(null);
      const result = await fetchRepoAlerts(owner, name);
      setRepoAlerts(result);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load alerts';
      setRefreshError(message);
    } finally {
      setRepoLoading((prev) => {
        const next = new Set(prev.loadingAlerts);
        next.delete(repoFullName);
        return { ...prev, loadingAlerts: next };
      });
    }
  }, []);

  // Cleanup the auto-clear timer on unmount
  useEffect(() => () => { if (clearDoneRef.current) clearTimeout(clearDoneRef.current); }, []);

  // Initial load
  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Auto-polling every 60 seconds — paused while tab is hidden
  useEffect(() => {
    function startPoll() {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(() => {
        if (!document.hidden) loadDashboard();
      }, POLL_INTERVAL_MS);
    }

    function handleVisibilityChange() {
      if (!document.hidden) loadDashboard();
    }

    startPoll();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadDashboard]);

  return {
    ...state,
    selectedRepo,
    repoAlerts,
    refreshError,
    bulkRefreshing: repoLoading.bulkRefreshing,
    refreshProgress: repoLoading.refreshProgress,
    refreshDone: repoLoading.refreshDone,
    isRefreshing: (repo: string) => repoLoading.refreshing.has(repo),
    isLoadingAlerts: (repo: string) => repoLoading.loadingAlerts.has(repo),
    refreshRepo: handleRefreshRepo,
    refreshAll: handleRefreshAll,
    selectRepo: handleSelectRepo,
    reload: loadDashboard,
  } as const;
}
