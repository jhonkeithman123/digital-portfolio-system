import React, { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import useTokenStatus from "../../hooks/useTokenStatus";
import { useAuthRestoreGuard, TAB_AUTH_KEY } from "../../utils/tabAuth";

interface TokenGuardProps {
  children: React.ReactNode;
  redirectInfo?: string;
  onExpire?: (() => void) | null;
  loadingFallback?: React.ReactNode | null;
}
("");

export default function TokenGuard({
  children,
  redirectInfo = "/login",
  onExpire = null,
  loadingFallback = null,
}: TokenGuardProps): React.ReactNode {
  const { expired, ready, refresh } = useTokenStatus();
  const navigate = useNavigate();
  const location = useLocation();

  // keep a ref of the latest `expired` so revalidate can inspect it after `refresh()`
  const expiredRef = useRef<boolean>(expired);
  useEffect(() => {
    expiredRef.current = expired;
  }, [expired]);

  useEffect(() => {
    if (ready && expired) {
      onExpire?.();
      navigate(redirectInfo, {
        replace: true,
        state: { from: location.pathname },
      });
    }
  }, [ready, expired, navigate, redirectInfo, location.pathname, onExpire]);

  // Install global restore guard for all protected pages:
  // - fast-fail when tabAuth is missing (user visited login/unauthed page)
  // - otherwise trigger a token refresh/revalidation (covers bfcache, popstate, focus)
  useEffect(() => {
    // fast synchronous check: if the per-tab auth marker is missing, redirect now.
    try {
      const tabAuth = sessionStorage.getItem(TAB_AUTH_KEY);
      if (!tabAuth) {
        onExpire?.();
        try {
          localStorage.removeItem("user");
        } catch {}
        navigate(redirectInfo, {
          replace: true,
          state: { from: location.pathname },
        });
        return;
      }
    } catch {
      // ignore storage errors and continue to install guard
    }

    if (!refresh) return;

    const revalidate = async () => {
      try {
        await refresh();
      } catch {
        // refresh sets expired/ready; swallow errors here
      }

      // If refresh resulted in an expired state, perform expire handling now.
      // Use the ref to avoid stale-closure issues.
      if (expiredRef.current) {
        onExpire?.();
        try {
          localStorage.removeItem("user");
        } catch {}
        navigate(redirectInfo, {
          replace: true,
          state: { from: location.pathname },
        });
      }
    };

    const cleanup = useAuthRestoreGuard(revalidate, () => {
      // missing per-tab auth marker -> treat as expired immediately
      onExpire?.();
      try {
        localStorage.removeItem("user");
      } catch {}
      navigate(redirectInfo, {
        replace: true,
        state: { from: location.pathname },
      });
    });

    return () => cleanup();
  }, [refresh, navigate, redirectInfo, location.pathname, onExpire]);

  if (!ready) return loadingFallback ?? null;
  if (expired) return null;
  return <>{children}</>;
}
