"use client";

import { useCallback, useEffect, useMemo } from "react";
import {
  useRouter,
  usePathname,
  useParams as useNextParams,
} from "next/navigation";
import {
  getSessionStorage,
  safeStorageGet,
  safeStorageRemove,
  safeStorageSet,
} from "utils/safeStorage";

type NavigateOptions = {
  replace?: boolean;
  state?: unknown;
};

type LocationLike = {
  pathname: string;
  search: string;
  state: any;
};

const STATE_KEY = "__NAV_STATE__";

function toKey(pathname: string, search: string) {
  return `${pathname}${search}`;
}

function readState(pathname: string, search: string): unknown {
  if (typeof window === "undefined") return null;
  const key = `${STATE_KEY}:${toKey(pathname, search)}`;
  try {
    const raw = safeStorageGet(getSessionStorage(), key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeState(pathname: string, search: string, state: unknown) {
  if (typeof window === "undefined") return;
  const key = `${STATE_KEY}:${toKey(pathname, search)}`;
  try {
    const session = getSessionStorage();
    if (state == null) {
      safeStorageRemove(session, key);
      return;
    }
    safeStorageSet(session, key, JSON.stringify(state));
  } catch {
    // Ignore storage write errors
  }
}

export function useNavigate() {
  const router = useRouter();

  return useCallback(
    (to: string | number, options?: NavigateOptions) => {
      if (typeof to === "number") {
        if (typeof window !== "undefined") {
          window.history.go(to);
        }
        return;
      }

      if (options?.state && typeof window !== "undefined") {
        const url = new URL(to, window.location.origin);
        writeState(url.pathname, url.search, options.state);
      }

      if (options?.replace) {
        router.replace(to);
      } else {
        router.push(to);
      }
    },
    [router],
  );
}

export function useLocation(): LocationLike {
  const pathname = usePathname() || "/";
  const search =
    typeof window !== "undefined" ? window.location.search || "" : "";

  return useMemo(
    () => ({ pathname, search, state: readState(pathname, search) }),
    [pathname, search],
  );
}

export function useParams<T extends Record<string, string | string[]>>() {
  return useNextParams() as T;
}

export function BrowserRouter({
  children,
}: {
  children: React.ReactNode;
  basename?: string;
}) {
  return <>{children}</>;
}

export const Router = BrowserRouter;

export function Routes({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function Route(_: { path?: string; element?: React.ReactNode }) {
  return null;
}

export function Navigate({ to, replace }: { to: string; replace?: boolean }) {
  const navigate = useNavigate();

  useEffect(() => {
    navigate(to, { replace });
  }, [navigate, replace, to]);

  return null;
}
