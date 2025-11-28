export function getStoredToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    sessionStorage.getItem("token") ||
    ""
  );
}

export function parseJwt(token) {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function isTokenExpired(token, skewMs = 0) {
  const p = parseJwt(token);
  if (!p || !p.exp) return true;
  const expMs = p.exp * 1000;
  return Date.now() + skewMs >= expMs;
}

export function msUntilExpiry(token) {
  const p = parseJwt(token);
  if (!p || !p.exp) return 0;
  return Math.max(0, p.exp * 1000 - Date.now());
}