import {
  getLocalStorage,
  getSessionStorage,
  safeStorageGet,
  safeStorageRemove,
  safeStorageSet,
} from "./safeStorage";

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
  userId?: string | number,
): void {
  try {
    const state: AuthState = {
      authenticated,
      userId,
      timestamp: Date.now(),
    };
    const local = getLocalStorage();
    if (local) {
      safeStorageSet(local, GLOBAL_AUTH_KEY, JSON.stringify(state));
    }

    // Dispatch event for same-tab listening (but prevent infinite loops)
    if (typeof window !== "undefined") {
      const event = new CustomEvent(AUTH_SYNC_EVENT, { detail: state });
      window.dispatchEvent(event);
    }

    console.log("[TabAuth] Broadcast auth state:", state);
  } catch (err) {
    console.error("[TabAuth] Failed to broadcast auth state:", err);
  }
}

/**
 * Get current global auth state
 */
export function getGlobalAuthState(): AuthState | null {
  try {
    const raw = safeStorageGet(getLocalStorage(), GLOBAL_AUTH_KEY);
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
    const local = getLocalStorage();
    if (local) {
      safeStorageRemove(local, GLOBAL_AUTH_KEY);
      safeStorageRemove(local, TAB_AUTH_KEY);
      safeStorageRemove(local, JUST_LOGGED_KEY);
      safeStorageRemove(local, FLAG_KEY);
    }
    console.log("[TabAuth] Cleared all auth state");
  } catch (err) {
    console.error("[TabAuth] Failed to clear auth state:", err);
  }
}

/**
 * Set tab-specific auth marker
 */
export function setTabAuth(): void {
  try {
    safeStorageSet(getSessionStorage(), TAB_AUTH_KEY, "1");
  } catch {
    /* ignore */
  }
}

/**
 * Remove tab-specific auth marker
 */
export function removeTabAuth(): void {
  try {
    safeStorageRemove(getSessionStorage(), TAB_AUTH_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Check if current tab is authenticated
 */
export function isTabAuthenticated(): boolean {
  try {
    return safeStorageGet(getSessionStorage(), TAB_AUTH_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Install login page guard: clears tabAuth and, if appropriate,
 * asks server to logout then reloads the page. Returns a cleanup fn.
 */
export function installLoginPageGuard(): () => void {
  let redirectPending = false;

  const handler = (e: StorageEvent) => {
    if (redirectPending) return;

    if (e.key === GLOBAL_AUTH_KEY && e.newValue) {
      try {
        const state = JSON.parse(e.newValue) as AuthState;
        if (state.authenticated) {
          console.log("[TabAuth] Auth detected in another tab, redirecting...");
          redirectPending = true;
          setTimeout(() => {
            window.location.href = "/dash";
          }, 100);
        }
      } catch {
        // ignore parse errors
      }
    }
  };

  window.addEventListener("storage", handler);

  // Same-tab events with debouncing
  let lastEventTime = 0;
  const sameTabHandler = (e: Event) => {
    if (redirectPending) return;

    const now = Date.now();
    if (now - lastEventTime < 1000) {
      console.log("[TabAuth] Ignoring duplicate auth sync event");
      return;
    }
    lastEventTime = now;

    const customEvent = e as CustomEvent<AuthState>;
    console.log("[TabAuth] Same-tab auth sync event", customEvent.detail);

    if (customEvent.detail?.authenticated) {
      redirectPending = true;
      setTimeout(() => {
        window.location.href = "/dash";
      }, 100);
    }
  };

  window.addEventListener(AUTH_SYNC_EVENT, sameTabHandler);

  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(AUTH_SYNC_EVENT, sameTabHandler);
  };
}

/**
 * Hook-ish installer for protected pages: calls `revalidate` on popstate/pageshow/focus.
 * Fast-path: if tabAuth is missing, calls onMissing instead of revalidate.
 * Also listens for cross-tab auth state changes.
 */
export function useAuthRestoreGuard(
  revalidate: () => Promise<void>,
  onMissing?: () => void,
): () => void {
  if (typeof window === "undefined") return () => {};

  let isChecking = false;
  let lastCheck = 0;
  const MIN_CHECK_INTERVAL = 30000; // 30 seconds minimum between checks

  const handler = async () => {
    if (isChecking) {
      console.log("[TabAuth] Check already in progress, skipping");
      return;
    }

    const now = Date.now();
    if (now - lastCheck < MIN_CHECK_INTERVAL) {
      console.log("[TabAuth] Check too soon, skipping");
      return;
    }

    isChecking = true;
    lastCheck = now;

    try {
      const tabAuth = safeStorageGet(getSessionStorage(), TAB_AUTH_KEY);
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
      // ignore storage errors
    }

    try {
      await revalidate();
    } catch {
      // swallow — caller handles navigation/messages
    } finally {
      isChecking = false;
    }
  };

  // Listen for cross-tab storage changes (debounced)
  let storageTimeout: number | null = null;
  const onStorage = (event: StorageEvent) => {
    if (event.key === GLOBAL_AUTH_KEY) {
      if (storageTimeout) clearTimeout(storageTimeout);
      storageTimeout = window.setTimeout(() => {
        console.log("[TabAuth] Cross-tab auth state change detected");
        void handler();
      }, 500);
    }
  };

  // Listen for same-tab custom events (debounced)
  let authSyncTimeout: number | null = null;
  const onAuthSync = ((event: CustomEvent<AuthState>) => {
    if (authSyncTimeout) clearTimeout(authSyncTimeout);
    authSyncTimeout = window.setTimeout(() => {
      console.log("[TabAuth] Same-tab auth sync event", event.detail);
      if (!event.detail.authenticated) {
        removeTabAuth();
        onMissing?.();
      } else {
        setTabAuth();
        void handler();
      }
    }, 500);
  }) as EventListener;

  // Reduce frequency of event listeners
  const onPop = () => void handler();
  const onPageShow = (_ev?: PageTransitionEvent) => {
    // Only check on actual page show, not bfcache restore
    if (!_ev?.persisted) {
      void handler();
    }
  };

  // Only check focus if tab was hidden for more than 1 minute
  let lastFocusCheck = Date.now();
  const onFocus = () => {
    const now = Date.now();
    if (now - lastFocusCheck > 60000) {
      lastFocusCheck = now;
      void handler();
    }
  };

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
    if (storageTimeout) clearTimeout(storageTimeout);
    if (authSyncTimeout) clearTimeout(authSyncTimeout);
  };
}
