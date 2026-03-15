import {
  getLocalStorage,
  safeStorageGet,
  safeStorageRemove,
  safeStorageSet,
} from "./safeStorage";

type KeyParam = { keys: string[] };
type SetParam = { keys: string[]; values: (string | null | undefined)[] };

const hasLocalStorage = (): boolean => getLocalStorage() !== null;

export const localStorageRemove = ({ keys }: KeyParam): void => {
  const storage = getLocalStorage();
  if (!hasLocalStorage() || !storage) return;
  keys.forEach((key) => {
    safeStorageRemove(storage, key);
  });
};

export const localStorageSet = ({ keys, values }: SetParam): void => {
  const storage = getLocalStorage();
  if (!hasLocalStorage() || !storage) return;
  keys.forEach((key, index) => {
    const value = values[index];
    if (value == null) return;
    safeStorageSet(storage, key, value);
  });
};

export const localStorageGet = ({ keys }: KeyParam): (string | null)[] => {
  const storage = getLocalStorage();
  if (!hasLocalStorage() || !storage) return keys.map(() => null);
  return keys.map((key) => safeStorageGet(storage, key));
};
