import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../api/client';

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

// Small fetch-with-loading-and-error hook used by every page — reload()
// re-runs the same fetcher, which pages call after a mutation.
export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[]): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const lastDeps = useRef<unknown[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Different inputs (another center, another patient…) — drop the old
    // answer so it's never shown as if it belonged to the new one. A plain
    // reload() of the same inputs keeps it on screen while refreshing.
    const prev = lastDeps.current;
    if (prev && (prev.length !== deps.length || prev.some((d, i) => !Object.is(d, deps[i])))) setData(null);
    lastDeps.current = deps;
    setLoading(true);
    setError(null);
    fetcher()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Something went wrong');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  return { data, loading, error, reload };
}
