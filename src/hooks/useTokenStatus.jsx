import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../utils/apiClient.js";

export default function useTokenStatus() {
  const [expired, setExpired] = useState(false);
  const [ready, setReady] = useState(false);
  const [remainingMs, setRemainingMs] = useState(null);
  const timerRef = useRef(null);

  const schedule = (ms) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const wait = Math.min(
      Math.max(ms ?? 5 * 60 * 1000, 5000),
      24 * 60 * 60 * 1000
    );
    timerRef.current = setTimeout(() => {
      checkNow();
    }, wait);
  };

  const checkNow = async () => {
    const { unauthorized, data } = await apiFetch("/auth/session");
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
  };

  useEffect(() => {
    checkNow();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { expired, ready, remainingMs, refresh: checkNow };
}
