const API_BASE = process.env.REACT_APP_API_URL;

export const clearSession = () => {
  localStorage.removeItem("user");
  localStorage.removeItem("currentClassroom");
};

//* Authed Fetched: with auth-header.
export async function apiFetch(path, options = {}) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
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
  let data = null;
  try {
    data = await res.json();
  } catch {
    //* ignore non-JSON
  }
  return { ok: res.ok, status: res.status, data };
}

//* Public fetch: no auth header, opt-in credentials (use withCredentials: true for login to receive cookie)
export async function apiFetchPublic(
  path,
  options = {},
  { withCredentials = false } = {}
) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(url, {
    credentials: withCredentials ? "include" : "omit",
    ...options,
    headers,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {}
  return { ok: res.ok, status: res.status, data };
}
