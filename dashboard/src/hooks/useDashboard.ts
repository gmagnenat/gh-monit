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
  refreshRepo,
} from '../api/client';

type DashboardState = {
  summary: SummaryResponse | null;
  repos: RepoSummary[];
  loading: boolean;
  error: string | null;
};

type RepoLoadingState = {
  refreshing: Set<string>;
  loadingAlerts: Set<string>;
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
  });

  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [repoAlerts, setRepoAlerts] = useState<RepoAlertsResponse | null>(
    null
  );

  const pollRef = useRef<ReturnType<typeof setInterval>>(null);

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
        const updated = await refreshRepo(owner, name);

        // If this repo is currently selected, update its alerts
        if (selectedRepo === key) {
          setRepoAlerts(updated);
        }

        // Reload dashboard to get updated summary + repo list
        await loadDashboard();
      } catch {
        // Errors are surfaced by the server; silently continue
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

  /** Select a repo and fetch its alerts. Pass null to deselect. */
  const handleSelectRepo = useCallback(async (repoFullName: string | null) => {
    setSelectedRepo(repoFullName);
    setRepoAlerts(null);

    if (!repoFullName) return;

    const [owner, name] = repoFullName.split('/');
    if (!owner || !name) return;

    setRepoLoading((prev) => ({
      ...prev,
      loadingAlerts: new Set(prev.loadingAlerts).add(repoFullName),
    }));

    try {
      const result = await fetchRepoAlerts(owner, name);
      setRepoAlerts(result);
    } catch {
      // Silently handle — empty alerts will show
    } finally {
      setRepoLoading((prev) => {
        const next = new Set(prev.loadingAlerts);
        next.delete(repoFullName);
        return { ...prev, loadingAlerts: next };
      });
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Auto-polling every 60 seconds
  useEffect(() => {
    pollRef.current = setInterval(loadDashboard, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadDashboard]);

  return {
    ...state,
    selectedRepo,
    repoAlerts,
    isRefreshing: (repo: string) => repoLoading.refreshing.has(repo),
    isLoadingAlerts: (repo: string) => repoLoading.loadingAlerts.has(repo),
    refreshRepo: handleRefreshRepo,
    selectRepo: handleSelectRepo,
    reload: loadDashboard,
  } as const;
}
