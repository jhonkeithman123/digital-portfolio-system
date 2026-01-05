import { useCallback, useEffect, useRef, useState } from "react";

type SessionData = {
  success?: boolean;
  expiresInMs?: number;
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

  // keep checkNow declaration hoisted so schedule can call it
  const checkNow = useCallback(async (): Promise<void> => {
    // Build backend URL from env (fallback to same-origin). Ensure credentials are sent.
    const API_BASE = "http://localhost:5000";
    const url = `${API_BASE}/auth/session`;

    // Use fetch directly with credentials to ensure cookie is sent/checked by server.
    // Treat non-200 / 401 responses or explicit success:false as expired.
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
        // 401/403/other errors -> treat as expired
        setExpired(true);
        setReady(true);
        setRemainingMs(0);
        try {
          window.dispatchEvent(
            new CustomEvent("app:tokenExpired", {
              detail: { reason: `http:${resp.status}` },
            })
          );
        } catch {
          // ignore
        }
        return;
      }

      const data = (await resp.json()) as SessionData;

      // server can indicate success:false or missing success -> treat as unauthorized
      if (data?.success === false || data == null) {
        console.warn("[useTokenStatus] Session invalid:", data);
        setExpired(true);
        setReady(true);
        setRemainingMs(0);
        try {
          window.dispatchEvent(
            new CustomEvent("app:tokenExpired", {
              detail: { reason: "unauthorized" },
            })
          );
        } catch {
          // ignore
        }
        return;
      }

      // valid session
      console.log("[useTokenStatus] Session valid:", data.user);
      setExpired(false);
      setReady(true);

      const next = 5 * 50 * 1000;
      setRemainingMs(next);
      schedule(next);
    } catch (err) {
      clearTimeout(timeout);
      // network error or fetch aborted -> treat as expired for UX safety
      setExpired(true);
      setReady(true);
      setRemainingMs(0);
      try {
        window.dispatchEvent(
          new CustomEvent("app:tokenExpired", { detail: { reason: "error" } })
        );
      } catch {
        // ignore
      }
    }
  }, [schedule]);

  useEffect(() => {
    mountedRef.current = true;
    // initial check
    void checkNow();

    const onStorage = (ev: StorageEvent) => {
      // react to auth-related localStorage changes across tabs (user, role, token etc.)
      const key = ev.key;
      if (!key) {
        // full storage clear -> recheck
        void checkNow();
        return;
      }
      if (["user", "role", "token", "justLoggedIn"].includes(key)) {
        void checkNow();
      }
    };

    const onPop = () => void checkNow();
    const onFocus = () => void checkNow();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void checkNow();
    };

    const onAppLogout = () => void checkNow();
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
