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
    try {
      const { unauthorized, data } = await apiFetch<SessionData>(
        "/auth/session"
      );

      if (unauthorized || data?.success === false) {
        setExpired(true);
        setReady(true);
        setRemainingMs(0);
        // notify app that token/session expired
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

      setExpired(false);
      setReady(true);

      const next =
        typeof data?.expiresInMs === "number"
          ? data.expiresInMs
          : 5 * 60 * 1000;
      setRemainingMs(next);
      schedule(next);
    } catch (err) {
      // network / server error -> treat as expired for UX safety, but allow retries
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
