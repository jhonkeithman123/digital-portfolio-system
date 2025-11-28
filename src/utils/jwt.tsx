export function getStoredToken(): string {
  const keys = ["token", "authToken"];
  for (const k of keys) {
    try {
      const v = localStorage.getItem(k);
      if (v) return v;
    } catch {}
    try {
      const v = sessionStorage.getItem(k);
      if (v) return v;
    } catch {}
  }
  return "";
}

export function parseJwt(token: string): Record<string, any> | null {
  if (!token || typeof token !== "string") return null;
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1];

    // base64url -> base64
    let b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    // pad with '='
    while (b64.length % 4) b64 += "=";

    // atob in browser, Buffer in Node env
    let jsonStr: string;
    if (typeof window !== "undefined" && typeof window.atob === "function") {
      jsonStr = decodeURIComponent(
        Array.prototype.map
          .call(window.atob(b64), (c: string) => {
            return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
          })
          .join("")
      );
    } else if (typeof (globalThis as any).Buffer !== "undefined") {
      jsonStr = (globalThis as any).Buffer.from(b64, "base64").toString("utf8");
    } else {
      // last-resort: try atob if available
      jsonStr = atob(b64);
    }

    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

export function getTokenExpiry(
  token: string | null | undefined
): number | null {
  const p = token ? parseJwt(token) : null;
  if (!p || (p.exp == null && p.expire == null)) return null;
  const exp = p.exp ?? p.expire;
  const n = Number(exp);
  if (Number.isFinite(n)) return Math.floor(n) * 1000;
  return null;
}

export function isTokenExpired(
  token?: string | null,
  skewMs: number = 0
): boolean {
  if (!token) return true;
  const expMs = getTokenExpiry(token);
  if (expMs == null) return true;
  return Date.now() + skewMs >= expMs;
}

export function msUntilExpiry(token?: string | null): number {
  if (!token) return 0;
  const expMs = getTokenExpiry(token);
  if (expMs == null) return 0;
  return Math.max(0, expMs - Date.now());
}
