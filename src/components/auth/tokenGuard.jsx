import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import useTokenStatus from "../../hooks/useTokenStatus";

export default function TokenGuard({
  children,
  redirectInfo = "/login",
  onExpire = null,
  loadingFallback = null,
}) {
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
  return children;
}
