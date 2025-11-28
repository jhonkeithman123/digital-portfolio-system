import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import useTokenStatus from "../../hooks/useTokenStatus";

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
  const { expired, ready } = useTokenStatus();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (ready && expired) {
      onExpire?.();
      navigate(redirectInfo, {
        replace: true,
        state: { from: location.pathname },
      });
    }
  }, [ready, expired, navigate, redirectInfo, location.pathname, onExpire]);

  if (!ready) return loadingFallback ?? null;
  if (expired) return null;
  return <>{children}</>;
}
