export const TAB_AUTH_KEY = "tabAuth";
export const JUST_LOGGED_KEY = "justLoggedIn";
export const FLAG_KEY = "loginRefreshDone";

export function setTabAuth(): void {
  try {
    sessionStorage.setItem(TAB_AUTH_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function removeTabAuth(): void {
  try {
    sessionStorage.removeItem(TAB_AUTH_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Install login page guard: clears tabAuth and, if appropriate,
 * asks server to logout then reloads the page. Returns a cleanup fn.
 */
export function installLoginPageGuard(): () => void {
  if (typeof window === "undefined") return () => {};

  // clear tabAuth asap (per-tab marker)
  removeTabAuth();

  const doLogoutAndReload = async () => {
    try {
      await fetch("/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      /* ignore network errors */
    }
    try {
      window.location.replace(window.location.href);
    } catch {
      window.location.reload();
    }
  };

  const handleRefreshLogic = () => {
    try {
      // If this tab was just used to log in and we haven't done refresh for this tab, force logout+reload
      if (
        sessionStorage.getItem(JUST_LOGGED_KEY) &&
        !sessionStorage.getItem(FLAG_KEY)
      ) {
        sessionStorage.removeItem(JUST_LOGGED_KEY);
        removeTabAuth();
        sessionStorage.setItem(FLAG_KEY, "1");
        void doLogoutAndReload();
        return;
      }

      // avoid repeated work per-tab
      if (sessionStorage.getItem(FLAG_KEY)) return;

      // detect likely auth cookie presence before calling logout
      const hasAuthCookie = (() => {
        try {
          if (!("cookie" in document)) return false;
          const c = document.cookie || "";
          return /(?:^|;\s*)(?:_HOST-token|token|session|sid)=/i.test(c);
        } catch {
          return false;
        }
      })();

      // mark so we don't loop
      sessionStorage.setItem(FLAG_KEY, "1");

      if (!hasAuthCookie) return;

      void doLogoutAndReload();
    } catch {
      /* ignore storage errors */
    }
  };

  // run immediately
  handleRefreshLogic();

  // pageshow and focus cover bfcache and tab restores
  const onPageShow = () => void handleRefreshLogic();
  const onFocus = () => void handleRefreshLogic();

  window.addEventListener("pageshow", onPageShow);
  window.addEventListener("focus", onFocus);

  return () => {
    window.removeEventListener("pageshow", onPageShow);
    window.removeEventListener("focus", onFocus);
  };
}

/**
 * Hook-ish installer for protected pages: calls `revalidate` on popstate/pageshow/focus.
 * Fast-path: if tabAuth is missing, calls onMissing instead of revalidate.
 */
export function useAuthRestoreGuard(
  revalidate: () => Promise<void>,
  onMissing?: () => void
): () => void {
  if (typeof window === "undefined") return () => {};

  const handler = async () => {
    try {
      const tabAuth = sessionStorage.getItem(TAB_AUTH_KEY);
      if (!tabAuth) {
        onMissing?.();
        return;
      }
    } catch {
      // ignore storage errors and continue to revalidate
    }
    try {
      await revalidate();
    } catch {
      // swallow — caller handles navigation/messages
    }
  };

  const onPop = () => void handler();
  const onPageShow = (_ev?: PageTransitionEvent) => {
    // always run when pageshow (covers bfcache), also when visible
    void handler();
  };
  const onFocus = () => void handler();

  window.addEventListener("popstate", onPop);
  window.addEventListener("pageshow", onPageShow);
  window.addEventListener("focus", onFocus);

  return () => {
    window.removeEventListener("popstate", onPop);
    window.removeEventListener("pageshow", onPageShow);
    window.removeEventListener("focus", onFocus);
  };
}
