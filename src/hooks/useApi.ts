'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DependencyList } from 'react';

export interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/**
 * Small loading/error/retry helper for API-backed views.
 *
 * A request that finishes after a newer one started is ignored, so a slow
 * response cannot overwrite fresh data.
 */
export function useApi<T>(
  loader: () => Promise<T>,
  deps: DependencyList,
  enabled = true,
): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<string | null>(null);

  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const requestId = useRef(0);

  const reload = useCallback(async () => {
    const id = requestId.current + 1;
    requestId.current = id;

    setLoading(true);
    setError(null);

    try {
      const result = await loaderRef.current();
      if (requestId.current === id) setData(result);
    } catch (err: any) {
      if (requestId.current === id) {
        setError(err?.message || 'Request failed');
      }
    } finally {
      if (requestId.current === id) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      requestId.current += 1;
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  return { data, loading, error, reload };
}
