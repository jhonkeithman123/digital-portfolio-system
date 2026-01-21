import { clearGlobalAuthState } from "./tabAuth";

// const REMOTE_API_BASE: string =
//   (import.meta.env.VITE_API_URL as string | undefined) ??
//   (typeof window !== "undefined" ? window.location.origin : "");
const REMOTE_API_BASE: string = "http://localhost:5000";
const LOCAL_API_BASE: string | undefined = import.meta.env
  .VITE_API_URL_LOCAL as string | undefined;

//* hard fallback when remote is marked unavailable
const FALLBACK_LOCALHOST = "http://localhost:5000";
const DEV_MODE = (import.meta.env.MODE as string | undefined) !== "production";

let last401Time = 0;
const CLEAR_DEBOUNCE = 5000; // Only clear auth state once per 5 seconds

/** Check remote API root for "unavailable" signals (500 status, x-db-status header, or body text) */
async function isRemoteUnavailable(timeoutMs = 1200): Promise<boolean> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    const root = REMOTE_API_BASE.endsWith("/")
      ? REMOTE_API_BASE
      : REMOTE_API_BASE + "/";
    const res = await fetch(root, {
      method: "GET",
      mode: "cors",
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(id);

    // server-side signals that we consider "unavailable"
    if (res.status >= 500) return true;
    const dbHeader = res.headers.get("x-db-status");
    if (dbHeader && /down|unavailable|false/i.test(dbHeader)) return true;

    // try to read lightweight text/json to find an "unavailable" marker
    let txt = "";
    try {
      // prefer JSON but fall back to text
      const ct = res.headers.get("content-type") || "";
      if (/application\/json/i.test(ct)) {
        const json = await res.json();
        txt = JSON.stringify(json);
      } else {
        txt = await res.text();
      }
    } catch {
      txt = "";
    }
    if (/unavailable|service unavailable|db not available|down/i.test(txt))
      return true;
    return false;
  } catch {
    // network failure / timeout — do not mark as "unavailable" here (treat as unreachable)
    return false;
  }
}

/** Resolve API base: prefer local dev server when in dev mode and reachable */
async function resolveApiBase(): Promise<string> {
  if (DEV_MODE) {
    console.log("[apiClient] DEV_MODE - using localhost:5000");
    return "http://localhost:5000";
  }

  if (REMOTE_API_BASE) {
    try {
      const remoteUnavailable = await isRemoteUnavailable();
      if (remoteUnavailable) {
        if (LOCAL_API_BASE) {
          console.warn(
            "[apiClient] remote reports unavailable — using LOCAL_API_BASE:",
            LOCAL_API_BASE,
          );
          return LOCAL_API_BASE;
        }
        console.warn(
          "[apiClient] remote reports unavailable — using fallback localhost:5000",
        );
        return FALLBACK_LOCALHOST;
      }
    } catch (e) {
      console.error("[apiClient] Error checking remote:", e);
    }
  }

  return REMOTE_API_BASE || FALLBACK_LOCALHOST;
}

async function buildUrl(path: string): Promise<string> {
  if (path.startsWith("http")) return path;
  const base = (await resolveApiBase()) || "";
  try {
    return new URL(path, base.endsWith("/") ? base : base + "/").toString();
  } catch {
    if (!base) return path;
    if (base.endsWith("/") || path.startsWith("/")) return `${base}${path}`;
    return `${base}/${path}`;
  }
}

export const clearSession = (): void => {
  try {
    localStorage.removeItem("user");
    localStorage.removeItem("currentClassroom");
  } catch {
    //* Ignore it
  }
};

interface ApiResponse<T = any> {
  ok: boolean;
  status: number;
  data: T | null;
  unauthorized?: boolean;
}

//* Authed Fetched: with auth-header.
export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const url = await buildUrl(path);
  const headers = new Headers((options as any).headers || {});
  const bodyIsForm = (options as any).body instanceof FormData;

  if (!headers.has("Content-Type") && !bodyIsForm) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, {
    credentials: "include", //* send cookie
    ...options,
    headers,
  });

  if (res.status === 403) {
    console.log("[apiFetch] 403 Forbidden response detected");

    window.dispatchEvent(
      new CustomEvent("auth:forbidden", {
        detail: {
          message: "You don't have permission to access this resource",
          endpoint: path,
        },
      }),
    );

    return { ok: false, status: 403, data: null, unauthorized: true };
  }

  if (res.status === 401) {
    console.log("[apiFetch] 401 unauthorized for:", path);

    // Debounce clearing auth state to prevent excessive calls
    const now = Date.now();
    if (now - last401Time > CLEAR_DEBOUNCE) {
      last401Time = now;
      console.log("[apiFetch] Clearing auth state (debounced)");
      clearGlobalAuthState();
      try {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      } catch {}
    } else {
      console.log("[apiFetch] Skipping auth clear (too soon)");
    }

    return { ok: false, status: 401, data: null, unauthorized: true };
  }

  let data: T | null = null;
  try {
    data = (await res.json()) as T;
  } catch {
    //* ignore non-JSON responses
  }
  return {
    ok: res.ok,
    status: res.status,
    data,
    unauthorized: res.status === 401,
  };
}

//* Public fetch: no auth header, opt-in credentials (use withCredentials: true for login to receive cookie)
export async function apiFetchPublic<T = any>(
  path: string,
  options: RequestInit = {},
  { withCredentials = false } = {},
): Promise<ApiResponse<T>> {
  const url = await buildUrl(path);
  const headers = new Headers((options as any).headers || {});
  const bodyIsForm = (options as any).body instanceof FormData;

  if (!headers.has("Content-Type") && !bodyIsForm) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, {
    credentials: withCredentials ? "include" : "omit",
    ...options,
    headers,
  });

  let data: T | null = null;
  try {
    data = (await res.json()) as T;
  } catch {
    //* Ignore non-json
  }
  return {
    ok: res.ok,
    status: res.status,
    data,
    unauthorized: res.status === 401,
  };
}
