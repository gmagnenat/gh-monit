import { useCallback, useEffect, useRef, useState } from 'react';

export type AsyncState<T> = {
  data: T;
  loading: boolean;
  error: string | null;
};

type UseAsyncOptions<T> = {
  /** Initial data value before the first fetch. */
  initialData: T;
  /** When false, the hook will not fetch automatically. Defaults to true. */
  enabled?: boolean;
  /** When true, delays the initial fetch until `reload()` is called manually. Defaults to false. */
  lazy?: boolean;
};

/**
 * Generic async data-fetching hook.
 * Automatically fetches when enabled, supports lazy loading and manual reload.
 */
export function useAsync<T>(
  fetchFn: () => Promise<T>,
  options: UseAsyncOptions<T>
): AsyncState<T> & { reload: () => Promise<void> } {
  const { initialData, enabled = true, lazy = false } = options;

  const [state, setState] = useState<AsyncState<T>>({
    data: initialData,
    loading: false,
    error: null,
  });

  const hasFetched = useRef(false);

  const reload = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await fetchFn();
      setState({ data, loading: false, error: null });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'An error occurred';
      setState((prev) => ({ ...prev, loading: false, error: message }));
    }
  }, [fetchFn]);

  useEffect(() => {
    if (enabled && !lazy && !hasFetched.current) {
      hasFetched.current = true;
      reload();
    }
  }, [enabled, lazy, reload]);

  return { ...state, reload };
}
