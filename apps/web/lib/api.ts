import type { ApiResult } from "@/types/api";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";

function toUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return new URL(
    path,
    API_BASE.endsWith("/") ? API_BASE : `${API_BASE}/`,
  ).toString();
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResult<T>> {
  const headers = new Headers(options.headers || {});
  const bodyIsForm = options.body instanceof FormData;

  if (!headers.has("Content-Type") && !bodyIsForm) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(toUrl(path), {
    ...options,
    credentials: "include",
    headers,
    cache: "no-store",
  });

  let data: T | null = null;
  try {
    data = (await res.json()) as T;
  } catch {
    data = null;
  }

  return {
    ok: res.ok,
    status: res.status,
    data,
    unauthorized: res.status === 401,
  };
}
