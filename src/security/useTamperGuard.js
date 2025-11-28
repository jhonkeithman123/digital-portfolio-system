import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

const useTamperGuard = (
  expectedRole,
  showMessage,
  { intervalMs = 3000, enabled = true } = {}
) => {
  const navigate = useNavigate();

  const showMsgRef = useRef(showMessage);
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
      // Clear httpOnly cookie on server
      fetch(`${process.env.REACT_APP_API_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      }).catch(() => {});
    };

    const safeNotify = (text, kind = "error", redirect = "/") => {
      if (triggeredRef.current) return;
      triggeredRef.current = true;
      try {
        showMsgRef.current?.(text, kind);
      } catch {}
      try {
        localStorage.removeItem("user");
      } catch {}
      serverLogout();
      setTimeout(() => navigate(redirect, { replace: true }), 1200);
    };

    const checkLocalStorage = () => {
      if (triggeredRef.current) return;
      const storedUser = localStorage.getItem("user");
      if (!storedUser) return;
      try {
        const parsedUser = JSON.parse(storedUser);
        const currentRole = parsedUser?.role;
        if (currentRole && String(currentRole) !== String(expectedRole)) {
          safeNotify("Role tampering detected", "error", "/");
        }
      } catch {
        safeNotify("Corrupted user data", "error", "/");
      }
    };

    const checkDOM = () => {
      if (triggeredRef.current) return;
      const badge = document.querySelector(".role-badge");
      if (!badge) return;

      const expected = String(expectedRole).toLowerCase();
      const domRole = (badge.getAttribute("data-role") || "").toLowerCase();

      // Only act on explicit dataset mismatch; do NOT rely on visible text
      if (domRole && domRole !== expected) {
        safeNotify("DOM tampering detected", "error", "/");
      }
    };

    const checkingScripts = () => {
      if (triggeredRef.current) return;
      if (window.hackedFunction) {
        safeNotify("Suspicious script detected", "error", "/login");
      }
    };

    // Initial checks
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
  }, [expectedRole, navigate, enabled, intervalMs]);
};

export default useTamperGuard;
