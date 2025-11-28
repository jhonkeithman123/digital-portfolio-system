import { useState, useCallback } from "react";

export default function useLoadingState(initial = false) {
  const [loading, setLoading] = useState(initial);
  const [error, setError] = useState(null);

  const wrap = useCallback(async (fn) => {
    setLoading(true);
    setError(null);

    try {
      return await fn();
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, setLoading, setError, wrap };
}
