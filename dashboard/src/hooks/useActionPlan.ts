import { useCallback } from 'react';
import { fetchActionPlan } from '../api/client';
import type { ActionPlanEntry } from '../api/client';
import { useAsync } from './useAsync';

const INITIAL: ActionPlanEntry[] = [];

export function useActionPlan(enabled: boolean) {
  const fetchData = useCallback(() => fetchActionPlan(), []);

  const { data, loading, error, reload } = useAsync(fetchData, {
    initialData: INITIAL,
    enabled,
  });

  return { data, loading, error, reload } as const;
}
