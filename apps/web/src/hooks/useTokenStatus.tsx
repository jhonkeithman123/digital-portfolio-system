import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "utils/apiClient";
import { clearGlobalAuthState, getGlobalAuthState } from "utils/tabAuth";

type SessionData = {
  success?: boolean;
  expiresInMs?: number;
  user?: {
    id?: string | number;
    [k: string]: any;
  };
  [k: string]: any;
};

const CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 mins
const REFRESH_BEFORE_EXPIRY = 2 * 60 * 1000; // Refresh 2 minutes before expiry

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
  const intervalRef = useRef<number | null>(null);
  const mountedRef = useRef<boolean>(true);
  const lastCheckRef = useRef<number>(0);

  const checkNow = useCallback(async (): Promise<void> => {
    if (!mountedRef.current) return;

    // Debounce: Don't check more than once per 30 seconds
    const now = Date.now();
    if (now - lastCheckRef.current < 30000) {
      console.log(
        "[useTokenStatus] Skipping check (too soon since last check)",
      );
      return;
    }
    lastCheckRef.current = now;

    try {
      const { unauthorized, data } =
        await apiFetch<SessionData>("/auth/session");

      if (!mountedRef.current) return;

      if (unauthorized || !data?.success) {
        console.log("[useTokenStatus] Session invalid or expired");
        setExpired(true);
        setReady(true);
        setRemainingMs(null);
        clearGlobalAuthState();

        // Clear intervals
        if (timerRef.current !== null) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        if (intervalRef.current !== null) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        return;
      }

      console.log("[useTokenStatus] Session valid:", data.user);
      setExpired(false);
      setReady(true);

      const ms = data.expiresInMs ?? null;
      setRemainingMs(ms);

      // Clear existing timer
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      // Set expiry timer
      if (ms !== null && ms > 0) {
        timerRef.current = window.setTimeout(() => {
          if (!mountedRef.current) return;
          console.log("[useTokenStatus] Session expired by timer");
          setExpired(true);
          setRemainingMs(0);
          clearGlobalAuthState();
        }, ms);

        // Set refresh timer (refresh before expiry)
        if (ms > REFRESH_BEFORE_EXPIRY) {
          setTimeout(() => {
            if (!mountedRef.current) return;
            console.log("[useTokenStatus] Refreshing session before expiry");
            checkNow();
          }, ms - REFRESH_BEFORE_EXPIRY);
        }
      }
    } catch (err) {
      if (!mountedRef.current) return;
      console.error("[useTokenStatus] Error checking session:", err);
      // Don't immediately mark as expired on network error
      console.log("[useTokenStatus] Network error, keeping current state");
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    // Check if global auth state exists and is fresh
    const globalAuth = getGlobalAuthState();
    const isFresh =
      globalAuth?.timestamp &&
      Date.now() - globalAuth.timestamp < 2 * 60 * 1000;

    if (globalAuth?.authenticated && isFresh) {
      console.log("[useTokenStatus] Using fresh global auth state");
      setExpired(false);
      setReady(true);
    }

    // Initial check
    checkNow();

    // Set up periodic checks (every 5 minutes)
    intervalRef.current = window.setInterval(() => {
      if (mountedRef.current && !expired) {
        console.log("[useTokenStatus] Periodic session check");
        checkNow();
      }
    }, CHECK_INTERVAL);

    return () => {
      mountedRef.current = false;
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, [checkNow, expired]);

  return { expired, ready, remainingMs, refresh: checkNow };
}
