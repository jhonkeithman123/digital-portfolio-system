import { useCallback, useEffect, useRef, useState } from "react";
import { broadcastAuthState, clearGlobalAuthState } from "utils/tabAuth";

type SessionData = {
  success?: boolean;
  expiresInMs?: number;
  user?: {
    id?: string | number;
    [k: string]: any;
  };
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
  const mountedRef = useRef<boolean>(true);

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
    const API_BASE = "http://localhost:5000";
    const url = `${API_BASE}/auth/session`;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);

    try {
      const resp = await fetch(url, {
        method: "GET",
        credentials: "include",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      });
      clearTimeout(timeout);

      if (!resp.ok) {
        console.warn(`[useTokenStatus] Session check failed: ${resp.status}`);
        setExpired(true);
        setReady(true);
        setRemainingMs(0);

        // Broadcast logout to all tabs
        clearGlobalAuthState();

        try {
          window.dispatchEvent(
            new CustomEvent("app:tokenExpired", {
              detail: { reason: `http:${resp.status}` },
            }),
          );
        } catch {
          // ignore
        }
        return;
      }

      const data = (await resp.json()) as SessionData;

      if (data?.success === false || data == null) {
        console.warn("[useTokenStatus] Session invalid:", data);
        setExpired(true);
        setReady(true);
        setRemainingMs(0);

        // Broadcast logout to all tabs
        clearGlobalAuthState();

        try {
          window.dispatchEvent(
            new CustomEvent("app:tokenExpired", {
              detail: { reason: "unauthorized" },
            }),
          );
        } catch {
          // ignore
        }
        return;
      }

      // Valid session - broadcast to all tabs
      console.log("[useTokenStatus] Session valid:", data.user);
      setExpired(false);
      setReady(true);

      const userId = data.user?.id;
      broadcastAuthState(true, userId);

      const next = 5 * 60 * 1000; // 5 minutes
      setRemainingMs(next);
      schedule(next);
    } catch (err) {
      clearTimeout(timeout);
      console.error("[useTokenStatus] Session check error:", err);
      setExpired(true);
      setReady(true);
      setRemainingMs(0);

      // Broadcast logout to all tabs
      clearGlobalAuthState();

      try {
        window.dispatchEvent(
          new CustomEvent("app:tokenExpired", { detail: { reason: "error" } }),
        );
      } catch {
        // ignore
      }
    }
  }, [schedule]);

  useEffect(() => {
    mountedRef.current = true;
    void checkNow();

    const onStorage = (ev: StorageEvent) => {
      const key = ev.key;
      if (!key) {
        void checkNow();
        return;
      }
      if (
        ["user", "role", "token", "justLoggedIn", "globalAuthState"].includes(
          key,
        )
      ) {
        void checkNow();
      }
    };

    const onPop = () => void checkNow();
    const onFocus = () => void checkNow();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void checkNow();
    };

    const onAppLogout = () => {
      clearGlobalAuthState();
      void checkNow();
    };
    const onAppLogin = () => void checkNow();

    window.addEventListener("storage", onStorage);
    window.addEventListener("popstate", onPop);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("app:logout", onAppLogout as EventListener);
    window.addEventListener("app:login", onAppLogin as EventListener);

    return () => {
      mountedRef.current = false;
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("app:logout", onAppLogout as EventListener);
      window.removeEventListener("app:login", onAppLogin as EventListener);
    };
  }, [checkNow]);

  return { expired, ready, remainingMs, refresh: checkNow };
}
