import React, { useState, useCallback } from "react";

type UseLoadingReturn = {
  loading: boolean;
  error: unknown | null;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<unknown | null>>;
  wrap: <T>(fn: () => Promise<T> | T) => Promise<T | undefined>;
};

export default function useLoadingState(initial = false): UseLoadingReturn {
  const [loading, setLoading] = useState<boolean>(initial);
  const [error, setError] = useState<unknown | null>(null);

  const wrap = useCallback(
    async <T,>(fn: () => Promise<T> | T): Promise<T | undefined> => {
      setLoading(true);
      setError(null);

      try {
        const result = await Promise.resolve(fn());
        return result;
      } catch (e) {
        setError(e);
        return undefined;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { loading, error, setLoading, setError, wrap };
}
