import { useCallback, useEffect, useRef, useState } from 'react';
import type { RepoOption } from '../api/client';
import { fetchAvailableRepos, fetchSetupStatus, postInitialize } from '../api/client';

type WizardStep =
  | 'checking'
  | 'loading-repos'
  | 'selecting'
  | 'initializing'
  | 'done'
  | 'no-targets'
  | 'error';

export type WizardState = {
  step: WizardStep;
  repos: RepoOption[];
  selected: Set<string>;
  search: string;
  errorMessage: string | null;
};

type UseSetupWizardOptions = {
  onDone: () => void;
};

export function useSetupWizard({ onDone }: UseSetupWizardOptions) {
  const [state, setState] = useState<WizardState>({
    step: 'checking',
    repos: [],
    selected: new Set(),
    search: '',
    errorMessage: null,
  });

  // Keep a ref so callbacks can read current state without stale closures
  const stateRef = useRef(state);
  stateRef.current = state;

  const runCheck = useCallback(async () => {
    setState((prev) => ({ ...prev, step: 'checking', errorMessage: null }));
    try {
      const status = await fetchSetupStatus();
      if (!status.isEmpty) {
        setState((prev) => ({ ...prev, step: 'done' }));
        onDone();
        return;
      }
      if (!status.hasTargets) {
        setState((prev) => ({ ...prev, step: 'no-targets' }));
        return;
      }
      setState((prev) => ({ ...prev, step: 'loading-repos' }));
      const repos = await fetchAvailableRepos();
      setState((prev) => ({ ...prev, step: 'selecting', repos }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Setup check failed';
      setState((prev) => ({ ...prev, step: 'error', errorMessage }));
    }
  }, [onDone]);

  // Run check on mount only
  useEffect(() => {
    runCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleRepo = useCallback((fullName: string) => {
    setState((prev) => {
      const next = new Set(prev.selected);
      if (next.has(fullName)) {
        next.delete(fullName);
      } else {
        next.add(fullName);
      }
      return { ...prev, selected: next };
    });
  }, []);

  const toggleAll = useCallback(() => {
    setState((prev) => {
      const visible = prev.repos.filter((r) =>
        r.fullName.toLowerCase().includes(prev.search.toLowerCase())
      );
      const allSelected = visible.every((r) => prev.selected.has(r.fullName));
      const next = new Set(prev.selected);
      if (allSelected) {
        for (const r of visible) next.delete(r.fullName);
      } else {
        for (const r of visible) next.add(r.fullName);
      }
      return { ...prev, selected: next };
    });
  }, []);

  const confirm = useCallback(async () => {
    const { repos, selected } = stateRef.current;
    const selectedRepos = repos.filter((r) => selected.has(r.fullName));
    setState((prev) => ({ ...prev, step: 'initializing' }));
    try {
      await postInitialize(selectedRepos);
      setState((prev) => ({ ...prev, step: 'done' }));
      onDone();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Initialization failed';
      setState((prev) => ({ ...prev, step: 'error', errorMessage }));
    }
  }, [onDone]);

  const skip = useCallback(() => {
    setState((prev) => ({ ...prev, step: 'done' }));
    onDone();
  }, [onDone]);

  const retry = useCallback(() => {
    runCheck();
  }, [runCheck]);

  const setSearch = useCallback((search: string) => {
    setState((prev) => ({ ...prev, search }));
  }, []);

  return { state, toggleRepo, toggleAll, confirm, skip, retry, setSearch };
}
