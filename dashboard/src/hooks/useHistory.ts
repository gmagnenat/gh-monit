import { useCallback, useEffect, useState } from 'react';
import type {
  AlertTimelineEntry,
  DependencyGroup,
  EcosystemBreakdown,
  MttrMetric,
  SlaViolation,
  TrendPoint,
  VulnerabilityGroup,
} from '../api/client';
import {
  fetchAlertHistory,
  fetchDependencies,
  fetchEcosystems,
  fetchMttr,
  fetchSlaViolations,
  fetchTrends,
  fetchVulnerabilities,
} from '../api/client';

type HistoryState = {
  trends: TrendPoint[];
  mttr: MttrMetric[];
  sla: SlaViolation[];
  loading: boolean;
  error: string | null;
};

type VulnDepState = {
  vulnerabilities: VulnerabilityGroup[];
  dependencies: DependencyGroup[];
  ecosystems: EcosystemBreakdown[];
  loading: boolean;
  error: string | null;
};

type TimelineState = {
  entries: AlertTimelineEntry[];
  loading: boolean;
};

/**
 * Hook for fetching history analytics data (trends, MTTR, SLA).
 * Lazily loads data — only fetches when `enabled` is true (first time Analytics tab opens).
 */
export function useHistory(enabled: boolean) {
  const [state, setState] = useState<HistoryState>({
    trends: [],
    mttr: [],
    sla: [],
    loading: false,
    error: null,
  });
  const [hasFetched, setHasFetched] = useState(false);

  const loadHistory = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const [trends, mttr, sla] = await Promise.all([
        fetchTrends(),
        fetchMttr(),
        fetchSlaViolations(),
      ]);
      setState({ trends, mttr, sla, loading: false, error: null });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load history';
      setState((prev) => ({ ...prev, loading: false, error: message }));
    }
  }, []);

  useEffect(() => {
    if (enabled && !hasFetched) {
      setHasFetched(true);
      loadHistory();
    }
  }, [enabled, hasFetched, loadHistory]);

  return {
    ...state,
    reload: loadHistory,
  } as const;
}

/**
 * Hook for fetching cross-repo vulnerability and dependency data.
 * Lazily loads data — only fetches when `enabled` is true.
 */
export function useVulnDep(enabled: boolean) {
  const [state, setState] = useState<VulnDepState>({
    vulnerabilities: [],
    dependencies: [],
    ecosystems: [],
    loading: false,
    error: null,
  });
  const [hasFetched, setHasFetched] = useState(false);

  const loadData = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const [vulnerabilities, dependencies, ecosystems] = await Promise.all([
        fetchVulnerabilities(),
        fetchDependencies(),
        fetchEcosystems(),
      ]);
      setState({
        vulnerabilities,
        dependencies,
        ecosystems,
        loading: false,
        error: null,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load analytics';
      setState((prev) => ({ ...prev, loading: false, error: message }));
    }
  }, []);

  useEffect(() => {
    if (enabled && !hasFetched) {
      setHasFetched(true);
      loadData();
    }
  }, [enabled, hasFetched, loadData]);

  return {
    ...state,
    reload: loadData,
  } as const;
}

/**
 * Hook for fetching per-alert timeline data for a specific repo.
 * Fetches automatically when `repo` changes to a non-null value.
 */
export function useAlertTimeline(repo: string | null) {
  const [state, setState] = useState<TimelineState>({
    entries: [],
    loading: false,
  });

  useEffect(() => {
    if (!repo) {
      setState({ entries: [], loading: false });
      return;
    }

    const [owner, name] = repo.split('/');
    if (!owner || !name) return;

    setState({ entries: [], loading: true });

    fetchAlertHistory(owner, name)
      .then((entries) => setState({ entries, loading: false }))
      .catch(() => setState({ entries: [], loading: false }));
  }, [repo]);

  return state;
}
