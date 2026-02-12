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
import { parseRepo } from '../utils/repo';
import { useAsync } from './useAsync';

export type HistoryData = {
  trends: TrendPoint[];
  mttr: MttrMetric[];
  sla: SlaViolation[];
};

export type HistoryState = HistoryData & {
  loading: boolean;
  error: string | null;
};

export type VulnDepData = {
  vulnerabilities: VulnerabilityGroup[];
  dependencies: DependencyGroup[];
  ecosystems: EcosystemBreakdown[];
};

export type VulnDepState = VulnDepData & {
  loading: boolean;
  error: string | null;
};

export type TimelineState = {
  entries: AlertTimelineEntry[];
  loading: boolean;
  error: string | null;
};

const INITIAL_HISTORY: HistoryData = { trends: [], mttr: [], sla: [] };
const INITIAL_VULNDEP: VulnDepData = { vulnerabilities: [], dependencies: [], ecosystems: [] };

/**
 * Hook for fetching history analytics data (trends, MTTR, SLA).
 * Lazily loads data — only fetches when `enabled` is true.
 */
export function useHistory(enabled: boolean) {
  const fetchAll = useCallback(
    async () => {
      const [trends, mttr, sla] = await Promise.all([
        fetchTrends(),
        fetchMttr(),
        fetchSlaViolations(),
      ]);
      return { trends, mttr, sla };
    },
    []
  );

  const { data, loading, error, reload } = useAsync(fetchAll, {
    initialData: INITIAL_HISTORY,
    enabled,
  });

  return { ...data, loading, error, reload } as const;
}

/**
 * Hook for fetching cross-repo vulnerability and dependency data.
 * Lazily loads data — only fetches when `enabled` is true.
 */
export function useVulnDep(enabled: boolean) {
  const fetchAll = useCallback(
    async () => {
      const [vulnerabilities, dependencies, ecosystems] = await Promise.all([
        fetchVulnerabilities(),
        fetchDependencies(),
        fetchEcosystems(),
      ]);
      return { vulnerabilities, dependencies, ecosystems };
    },
    []
  );

  const { data, loading, error, reload } = useAsync(fetchAll, {
    initialData: INITIAL_VULNDEP,
    enabled,
  });

  return { ...data, loading, error, reload } as const;
}

/**
 * Hook for fetching per-alert timeline data for a specific repo.
 * Fetches automatically when `repo` changes to a non-null value.
 */
export function useAlertTimeline(repo: string | null) {
  const [state, setState] = useState<TimelineState>({
    entries: [],
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!repo) {
      setState({ entries: [], loading: false, error: null });
      return;
    }

    const parsed = parseRepo(repo);
    if (!parsed) return;

    setState({ entries: [], loading: true, error: null });

    fetchAlertHistory(parsed.owner, parsed.name)
      .then((entries) => setState({ entries, loading: false, error: null }))
      .catch((err) => {
        const message =
          err instanceof Error ? err.message : 'Failed to load timeline';
        setState({ entries: [], loading: false, error: message });
      });
  }, [repo]);

  return state;
}
