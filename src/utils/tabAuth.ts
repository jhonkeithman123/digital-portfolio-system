export const TAB_AUTH_KEY = "tabAuth";
export const JUST_LOGGED_KEY = "justLoggedIn";
export const FLAG_KEY = "loginRefreshDone";
export const GLOBAL_AUTH_KEY = "globalAuthState";
export const AUTH_SYNC_EVENT = "authStateSync";

interface AuthState {
  authenticated: boolean;
  userId?: string | number;
  timestamp: number;
}

/**
 * Broadcast authentication state change to all tabs
 */
export function broadcastAuthState(
  authenticated: boolean,
  userId?: string | number
): void {
  try {
    const state: AuthState = {
      authenticated,
      userId,
      timestamp: Date.now(),
    };
    localStorage.setItem(GLOBAL_AUTH_KEY, JSON.stringify(state));

    // Dispatch custom event for same-tab listeners
    window.dispatchEvent(new CustomEvent(AUTH_SYNC_EVENT, { detail: state }));
  } catch {
    /* ignore storage errors */
  }
}

/**
 * Get current global auth state
 */
export function getGlobalAuthState(): AuthState | null {
  try {
    const raw = localStorage.getItem(GLOBAL_AUTH_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthState;
  } catch {
    return null;
  }
}

/**
 * Clear global auth state
 */
export function clearGlobalAuthState(): void {
  try {
    localStorage.removeItem(GLOBAL_AUTH_KEY);
    broadcastAuthState(false);
  } catch {
    /* ignore */
  }
}

/**
 * Set tab-specific auth marker
 */
export function setTabAuth(): void {
  try {
    sessionStorage.setItem(TAB_AUTH_KEY, "1");
  } catch {
    /* ignore */
  }
}

/**
 * Remove tab-specific auth marker
 */
export function removeTabAuth(): void {
  try {
    sessionStorage.removeItem(TAB_AUTH_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Check if current tab is authenticated
 */
export function isTabAuthenticated(): boolean {
  try {
    return sessionStorage.getItem(TAB_AUTH_KEY) === "1";
  } catch {
    return false;
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

    // Clear all auth-related storage
    clearGlobalAuthState();
    try {
      localStorage.removeItem("user");
      sessionStorage.clear();
    } catch {
      /* ignore */
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
 * Also listens for cross-tab auth state changes.
 */
export function useAuthRestoreGuard(
  revalidate: () => Promise<void>,
  onMissing?: () => void
): () => void {
  if (typeof window === "undefined") return () => {};

  const handler = async () => {
    try {
      const tabAuth = sessionStorage.getItem(TAB_AUTH_KEY);
      const globalAuth = getGlobalAuthState();

      // If global auth says not authenticated, clear tab auth
      if (globalAuth && !globalAuth.authenticated) {
        removeTabAuth();
        onMissing?.();
        return;
      }

      // If tab auth is missing but global auth exists, restore tab auth
      if (!tabAuth && globalAuth?.authenticated) {
        setTabAuth();
      }

      // If neither tab nor global auth exist, trigger missing callback
      if (!tabAuth && !globalAuth?.authenticated) {
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

  // Listen for cross-tab storage changes
  const onStorage = (event: StorageEvent) => {
    if (event.key === GLOBAL_AUTH_KEY) {
      console.log("[TabAuth] Cross-tab auth state change detected");
      void handler();
    }
  };

  // Listen for same-tab custom events
  const onAuthSync = ((event: CustomEvent<AuthState>) => {
    console.log("[TabAuth] Same-tab auth sync event", event.detail);
    if (!event.detail.authenticated) {
      removeTabAuth();
      onMissing?.();
    } else {
      setTabAuth();
      void handler();
    }
  }) as EventListener;

  const onPop = () => void handler();
  const onPageShow = (_ev?: PageTransitionEvent) => {
    void handler();
  };
  const onFocus = () => void handler();

  window.addEventListener("storage", onStorage);
  window.addEventListener(AUTH_SYNC_EVENT, onAuthSync);
  window.addEventListener("popstate", onPop);
  window.addEventListener("pageshow", onPageShow);
  window.addEventListener("focus", onFocus);

  // Run initial check
  void handler();

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(AUTH_SYNC_EVENT, onAuthSync);
    window.removeEventListener("popstate", onPop);
    window.removeEventListener("pageshow", onPageShow);
    window.removeEventListener("focus", onFocus);
  };
}
