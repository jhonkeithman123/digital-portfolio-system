import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "../utils/apiClient";

type SessionData = {
  success?: boolean;
  expiredMs?: number;
  [k: string]: any;
};

export default function useTokenStatus(): {
  expired: boolean;
  ready: boolean;
  remainingMs: number | null;
  refresh: () => Promise<void>;
} {
  const [expired, setExpired] = useState<boolean>(false);
  const [ready, setReady] = useState<boolean>(false);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const timerRef = useRef<number | null>(null);

  const schedule = useCallback((ms?: number) => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const defaultMs = 5 * 60 * 1000;
    const wait = Math.min(Math.max(ms ?? defaultMs, 5000), 24 * 60 * 60 * 1000);
    timerRef.current = window.setTimeout(() => {
      void checkNow();
    }, wait);
  }, []);

  const checkNow = useCallback(async (): Promise<void> => {
    const { unauthorized, data } = await apiFetch<SessionData>("/auth/session");

    if (unauthorized || data?.success === false) {
      setExpired(true);
      setReady(true);
      setRemainingMs(0);
      return;
    }
    setExpired(false);
    setReady(true);

    const next =
      typeof data?.expiresInMs === "number" ? data.expiresInMs : 5 * 60 * 1000;
    setRemainingMs(next);
    schedule(next);
  }, [schedule]);

  useEffect(() => {
    void checkNow();
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [checkNow]);

  return { expired, ready, remainingMs, refresh: checkNow };
}
