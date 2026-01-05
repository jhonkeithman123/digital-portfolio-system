import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { ShowMessageFn, TamperGuardOptions } from "../types/models";

/**
 * useTamperGuard
 * - expectedRole: role string or array of allowed roles
 * - showMessage: callback to surface a message to the user
 * - options: intervalMs, enabled, redirect path and optional logoutUrl
 */
export default function useTamperGuard(
  expectedRole: string | string[] | undefined,
  showMessage: ShowMessageFn | undefined,
  {
    intervalMs = 3000,
    enabled = true,
    redirect = "/",
    logoutUrl,
  }: TamperGuardOptions = {}
): void {
  const navigate = useNavigate();
  const showMsgRef = useRef<ShowMessageFn | undefined>(showMessage);
  useEffect(() => {
    showMsgRef.current = showMessage;
  }, [showMessage]);

  const triggeredRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    if (!expectedRole) return;
    if (triggeredRef.current) return;

    let stopped = false;

    const serverLogout = () => {
      try {
        const url =
          logoutUrl ?? `${import.meta.env.REACT_APP_API_URL ?? ""}/auth/logout`;
        // best-effort server call to clear httpOnly cookie/session
        if (url) {
          fetch(url, { method: "POST", credentials: "include" }).catch(
            () => {}
          );
        }
      } catch {}
    };

    const safeNotify = (
      text: string,
      kind: "info" | "success" | "error" = "error",
      redirectTo = redirect
    ) => {
      if (triggeredRef.current) return;
      triggeredRef.current = true;
      try {
        showMsgRef.current?.(text, kind);
      } catch {}
      try {
        localStorage.removeItem("user");
      } catch {}
      serverLogout();
      setTimeout(() => {
        try {
          navigate(redirectTo, { replace: true });
        } catch {}
      }, 900);
    };

    const checkLocalStorage = () => {
      if (triggeredRef.current) return;
      let stored: string | null = null;
      try {
        stored = localStorage.getItem("user");
      } catch {
        // ignore
      }
      if (!stored) return;
      try {
        const parsed = JSON.parse(stored);
        const currentRole = parsed?.role;
        if (currentRole) {
          const expectedArray = Array.isArray(expectedRole)
            ? expectedRole.map(String)
            : [String(expectedRole)];
          if (
            !expectedArray
              .map((r) => r.toLowerCase())
              .includes(String(currentRole).toLowerCase())
          ) {
            safeNotify("Role tampering detected", "error", redirect);
          }
        }
      } catch {
        safeNotify("Corrupted user data", "error", redirect);
      }
    };

    const checkDOM = () => {
      if (triggeredRef.current) return;
      try {
        const badge = document.querySelector(".role-badge");
        if (!badge) return;
        const expected = Array.isArray(expectedRole)
          ? String(expectedRole[0]).toLowerCase()
          : String(expectedRole).toLowerCase();
        const domRole = (
          (badge.getAttribute("data-role") ||
            badge.getAttribute("data-role-name") ||
            "") as string
        ).toLowerCase();
        if (domRole && domRole !== expected) {
          safeNotify("DOM tampering detected", "error", redirect);
        }
      } catch {
        // ignore DOM read errors
      }
    };

    const checkingScripts = () => {
      if (triggeredRef.current) return;
      try {
        // detect obvious injected globals
        if (window.hackedFunction || (window as any).__injected__) {
          safeNotify("Suspicious script detected", "error", "/login");
        }
      } catch {
        // ignore
      }
    };

    // initial checks
    checkLocalStorage();
    checkDOM();
    checkingScripts();

    const interval = setInterval(() => {
      if (stopped || triggeredRef.current) return;
      checkLocalStorage();
      checkDOM();
      checkingScripts();
    }, Math.max(500, Number(intervalMs) || 3000));

    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [expectedRole, navigate, enabled, intervalMs, redirect, logoutUrl]);
}
