import { useCallback, useEffect, useState } from 'react';
import type { FixAdvisorResponse } from '../api/client';
import { fetchCrossRepoFixAdvisor, fetchFixAdvisor } from '../api/client';
import { parseRepo } from '../utils/repo';

export type FixAdvisorState = {
  data: FixAdvisorResponse;
  loading: boolean;
  error: string | null;
};

const INITIAL: FixAdvisorResponse = {
  repo: 'all',
  totalActions: 0,
  totalAlerts: 0,
  actions: [],
  noFixAvailable: [],
};

/**
 * Hook for fetching cross-repo fix advisor data.
 * Lazily loads when `enabled` becomes true.
 */
export function useCrossRepoFixAdvisor(enabled: boolean): FixAdvisorState & { reload: () => Promise<void> } {
  const [state, setState] = useState<FixAdvisorState>({
    data: INITIAL,
    loading: false,
    error: null,
  });
  const [hasFetched, setHasFetched] = useState(false);

  const reload = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await fetchCrossRepoFixAdvisor();
      setState({ data, loading: false, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setState((prev) => ({ ...prev, loading: false, error: message }));
    }
  }, []);

  useEffect(() => {
    if (enabled && !hasFetched) {
      setHasFetched(true);
      reload();
    }
  }, [enabled, hasFetched, reload]);

  return { ...state, reload };
}

/**
 * Hook for fetching per-repo fix advisor data.
 * Fetches when `repo` changes to a non-null value.
 */
export function useRepoFixAdvisor(repo: string | null): FixAdvisorState {
  const [state, setState] = useState<FixAdvisorState>({
    data: INITIAL,
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!repo) {
      setState({ data: INITIAL, loading: false, error: null });
      return;
    }

    const parsed = parseRepo(repo);
    if (!parsed) return;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    fetchFixAdvisor(parsed.owner, parsed.name)
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err) => {
        const message = err instanceof Error ? err.message : 'Failed to load fix plan';
        setState({ data: INITIAL, loading: false, error: message });
      });
  }, [repo]);

  return state;
}
