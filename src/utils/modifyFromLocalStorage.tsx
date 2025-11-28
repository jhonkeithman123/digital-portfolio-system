type KeyParam = { keys: string[] };
type SetParam = { keys: string[]; values: (string | null | undefined)[] };

const hasLocalStorage = (): boolean =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

export const localStorageRemove = ({ keys }: KeyParam): void => {
  if (!hasLocalStorage()) return;
  keys.forEach((key) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      //* Ignore storage error
    }
  });
};

export const localStorageSet = ({ keys, values }: SetParam): void => {
  if (!hasLocalStorage()) return;
  keys.forEach((key, index) => {
    const value = values[index];
    try {
      if (value == null) return;
      window.localStorage.setItem(key, value);
    } catch {
      //* Ignore storage error
    }
  });
};

export const localStorageGet = ({ keys }: KeyParam): (string | null)[] => {
  if (!hasLocalStorage()) return keys.map(() => null);
  return keys.map((key) => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  });
};
