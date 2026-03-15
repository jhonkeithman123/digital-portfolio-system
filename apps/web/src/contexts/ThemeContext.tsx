"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  getLocalStorage,
  safeStorageGet,
  safeStorageSet,
} from "utils/safeStorage";

const STORAGE_KEY = "theme";
type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Start "light" so server + client initial render match (no hydration mismatch).
  // The blocking inline script in layout.tsx already set data-theme on <html>
  // to the correct value before React hydrates, so there is no visible flash.
  const [theme, setTheme] = useState<Theme>("light");
  const initialised = useRef(false);

  // Hydrate from storage once on mount (client-only).
  useEffect(() => {
    const stored = safeStorageGet(
      getLocalStorage(),
      STORAGE_KEY,
    ) as Theme | null;
    if (stored === "light" || stored === "dark") {
      setTheme(stored);
    } else if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
    }
    initialised.current = true;
  }, []);

  // Sync data-theme attribute and persist to storage whenever theme changes,
  // but skip the very first effect run (theme="light") — the inline script
  // already set the correct value and we don't want to override it immediately.
  useEffect(() => {
    if (!initialised.current) return;
    document.documentElement.setAttribute("data-theme", theme);
    const local = getLocalStorage();
    if (local) safeStorageSet(local, STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = useCallback(
    () => setTheme((prev) => (prev === "light" ? "dark" : "light")),
    [],
  );

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx)
    throw new Error("useThemeContext must be used inside ThemeProvider");
  return ctx;
}
