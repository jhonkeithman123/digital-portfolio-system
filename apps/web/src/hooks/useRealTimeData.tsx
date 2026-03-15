import { useCallback, useEffect, useRef, useState } from "react";

interface RealTimeOptions<T> {
  /** Fetch function that returns data */
  fetchFn: () => Promise<T>;
  /** Polling interval in milliseconds (default: 5000) or 5 seconds */
  interval?: number;
  /** Whenever polling is enabled (default: true) */
  enabled?: boolean;
  /** Callback when data changes */
  onChange?: (data: T) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
  /** Skip first fetch (if data already loaded) */
  skipInitial?: boolean;
  /** Compare function to detect changes (default: JSON.stringify comparison) */
  compareFn?: (prev: T, next: T) => boolean;
}

/**
 * Real-time data hool with intelligent polling
 * Similar to Github's live updates without page refresh
 *
 * Features
 * - Automatic polling with configurable interval
 * - Pause/resume polling when tab os hidden/visible
 * - Cleanup on unmount
 * - Error handling
 *
 * @example
 * const { data, refresh, isPolling } = useRealTimeData({
 *  fetchFn: async () => {
 *      const { data } await apiFetch('/showcase');
 *      return data.items;
 *  },
 *  interval: 5000,
 *  onChange: (newData) => console.log('Data updated:', newData)
 * });
 */
export function useRealTimeData<T>({
  fetchFn,
  interval = 5000,
  enabled = true,
  onChange,
  onError,
  skipInitial = false,
  compareFn,
}: RealTimeOptions<T>) {
  const [data, setData] = useState<T | null>(null);
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const timerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const dataRef = useRef<T | null>(null);
  const isVisibleRef = useRef(false);

  // Default comparison using JSON.stringify
  const defaultCompare = useCallback((prev: T, next: T): boolean => {
    try {
      return JSON.stringify(prev) === JSON.stringify(next);
    } catch {
      return false;
    }
  }, []);

  const compare = compareFn || defaultCompare;

  const fetch = useCallback(async () => {
    if (!enabled || !mountedRef.current) return;

    setIsPolling(true);

    try {
      const result = await fetchFn();

      if (!mountedRef.current) return;

      const hasChanged =
        dataRef.current === null || !compare(dataRef.current, result);

      if (hasChanged) {
        dataRef.current = result;
        setData(result);
        onChange?.(result);
      }

      setError(null);
    } catch (err) {
      if (!mountedRef.current) return;

      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
    } finally {
      if (mountedRef.current) {
        setIsPolling(false);
      }
    }
  }, [enabled, fetchFn, compare, onChange, onError]);

  // Start polling
  const startPolling = useCallback(() => {
    if (!enabled || !isVisibleRef.current) return;

    // Clear existing timer
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
    }

    // Initial fetch (unless skipped)
    if (!skipInitial || dataRef.current === null) {
      void fetch();
    }

    // Setup interval
    timerRef.current = window.setInterval(() => {
      if (isVisibleRef.current && mountedRef.current) {
        void fetch();
      }
    }, interval);
  }, [enabled, skipInitial, fetch, interval]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Manual refresh
  const refresh = useCallback(() => {
    void fetch();
  }, [fetch]);

  // Handle visibility change (pause when tab hidden)
  useEffect(() => {
    const handleVisibilityChange = () => {
      isVisibleRef.current = !document.hidden;

      if (isVisibleRef.current) {
        // Tab became visible - resume polling
        startPolling();
      } else {
        // Tab hidden - pause polling
        stopPolling();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [startPolling, stopPolling]);

  //Start/stop polling based on enabled flag
  useEffect(() => {
    if (enabled) {
      startPolling();
    } else {
      stopPolling();
    }

    return () => {
      stopPolling();
    };
  }, [enabled, startPolling, stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      stopPolling();
    };
  }, [stopPolling]);

  return {
    data,
    refresh,
    isPolling,
    error,
    startPolling,
    stopPolling,
  };
}

export default useRealTimeData;
