const REMOTE_API_BASE: string =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  (typeof window !== "undefined" ? window.location.origin : "");

const LOCAL_API_BASE: string | undefined = import.meta.env
  .VITE_API_URL_LOCAL as string | undefined;

const DEV_MODE = (import.meta.env.MODE as string | undefined) !== "production";

// cache local probe result for a short TTL to avoid repeated probes
let _localProbe = {
  available: false,
  expiresAt: 0,
  promise: null as Promise<boolean> | null,
};

function now() {
  return Date.now();
}

/** Probe localhost briefly to see if a dev server is up. Caches result for 5s. */
async function isLocalServerAvailable(
  timeoutMs = 500,
  ttlMs = 5000
): Promise<boolean> {
  const t = now();
  if (_localProbe.expiresAt > t && _localProbe.promise) {
    return _localProbe.promise;
  }

  if (!DEV_MODE || !LOCAL_API_BASE) {
    _localProbe.available = false;
    _localProbe.expiresAt = t + ttlMs;
    _localProbe.promise = Promise.resolve(false);
    return _localProbe.promise;
  }

  // create a probe promise and cache it immediately so concurrent callers share it
  const probe = (async () => {
    try {
      const controller = new AbortController();
      const signal = controller.signal;
      const id = setTimeout(() => controller.abort(), timeoutMs);

      // hit the root (server responds even if 404) to test reachability
      const probeUrl = LOCAL_API_BASE.endsWith("/")
        ? LOCAL_API_BASE
        : LOCAL_API_BASE + "/";
      const res = await fetch(probeUrl, {
        method: "GET",
        mode: "cors",
        cache: "no-store",
        signal,
      });
      clearTimeout(id);

      // if the origin responds at all (200/404/500/401) treat as available
      const ok = typeof res !== "undefined" && res.status !== 0;
      _localProbe.available = !!ok;
    } catch {
      _localProbe.available = false;
    }
    _localProbe.expiresAt = now() + ttlMs;
    return _localProbe.available;
  })();

  _localProbe.promise = probe;
  return probe;
}

/** Resolve API base: prefer local dev server when in dev mode and reachable */
async function resolveApiBase(): Promise<string> {
  // priority: local (if dev + reachable) -> remote -> fallback to empty
  if (DEV_MODE && LOCAL_API_BASE) {
    const ok = await isLocalServerAvailable();
    if (ok) return LOCAL_API_BASE;
  }
  return REMOTE_API_BASE || "";
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
  options: RequestInit = {}
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

  if (res.status === 401) {
    return { ok: false, status: 401, unauthorized: true, data: null };
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
  { withCredentials = false } = {}
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
