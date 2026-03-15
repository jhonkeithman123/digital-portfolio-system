type StorageLike = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem" | "clear"
>;

function isStorageLike(value: unknown): value is StorageLike {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as StorageLike).getItem === "function" &&
    typeof (value as StorageLike).setItem === "function" &&
    typeof (value as StorageLike).removeItem === "function" &&
    typeof (value as StorageLike).clear === "function"
  );
}

export function getLocalStorage(): StorageLike | null {
  if (typeof window !== "undefined" && isStorageLike(window.localStorage)) {
    return window.localStorage;
  }

  if (
    typeof globalThis !== "undefined" &&
    isStorageLike((globalThis as { localStorage?: unknown }).localStorage)
  ) {
    return (globalThis as { localStorage: StorageLike }).localStorage;
  }

  return null;
}

export function getSessionStorage(): StorageLike | null {
  if (typeof window !== "undefined" && isStorageLike(window.sessionStorage)) {
    return window.sessionStorage;
  }

  if (
    typeof globalThis !== "undefined" &&
    isStorageLike((globalThis as { sessionStorage?: unknown }).sessionStorage)
  ) {
    return (globalThis as { sessionStorage: StorageLike }).sessionStorage;
  }

  return null;
}

export function safeStorageGet(
  storage: StorageLike | null,
  key: string,
): string | null {
  if (!storage) return null;

  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function safeStorageSet(
  storage: StorageLike | null,
  key: string,
  value: string,
): boolean {
  if (!storage) return false;

  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function safeStorageRemove(
  storage: StorageLike | null,
  key: string,
): boolean {
  if (!storage) return false;

  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function safeStorageClear(storage: StorageLike | null): boolean {
  if (!storage) return false;

  try {
    storage.clear();
    return true;
  } catch {
    return false;
  }
}
