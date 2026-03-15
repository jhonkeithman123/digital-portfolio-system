export function readJsonStorage<T>(key: string, storage?: Storage): T | null {
  const resolved =
    storage || (typeof window !== "undefined" ? window.localStorage : null);
  if (!resolved) return null;

  try {
    const raw = resolved.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeJsonStorage<T>(
  key: string,
  value: T,
  storage?: Storage,
): void {
  const resolved =
    storage || (typeof window !== "undefined" ? window.localStorage : null);
  if (!resolved) return;

  try {
    resolved.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage failures in private mode/quota limits
  }
}
