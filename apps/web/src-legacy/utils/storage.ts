export function readJsonStorage<T>(
  key: string,
  storage: Storage = localStorage,
): T | null {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeJsonStorage<T>(
  key: string,
  value: T,
  storage: Storage = localStorage,
): void {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage failures in private mode/quota limits
  }
}
