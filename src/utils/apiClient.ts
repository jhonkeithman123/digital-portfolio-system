const API_BASE: string =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  (typeof window !== "undefined" ? window.location.origin : "");

function buildUrl(path: string): string {
  if (path.startsWith("http")) return path;
  const base = API_BASE || "";
  try {
    // new URL handles slashes cleanly
    return new URL(path, base.endsWith("/") ? base : base + "/").toString();
  } catch {
    // fallback safe concat
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
  const url = buildUrl(path);
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
  return { ok: res.ok, status: res.status, data };
}

//* Public fetch: no auth header, opt-in credentials (use withCredentials: true for login to receive cookie)
export async function apiFetchPublic<T = any>(
  path: string,
  options: RequestInit = {},
  { withCredentials = false } = {}
): Promise<ApiResponse<T>> {
  const url = buildUrl(path);
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
    data = await res.json();
  } catch {
    //* Ignore
  }
  return { ok: res.ok, status: res.status, data };
}
