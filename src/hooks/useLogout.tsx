import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./css/useLogout.css";
import { clearGlobalAuthState, removeTabAuth } from "utils/tabAuth";

type TriggerLogoutFn = (opts?: { confirm?: boolean }) => void;
type UseLogoutReturn = [TriggerLogoutFn, () => React.ReactElement | null];

/**
 * useLogout - returns a reusable logout handler.
 * Usage:
 *  const logout = useLogout();
 *  <button onClick(() => logout())>Logout</button>
 *
 * Options:
 *  logout({ confirm: false }) - skip confirmation dialog
 *  useLogout({ redirectTo: '/login' }) - change redirect target
 */
export default function useLogout({
  redirectTo = "/login",
} = {}): UseLogoutReturn {
  const navigate = useNavigate();
  const [open, setOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  const performLogout = async (): Promise<void> => {
    setLoading(true);

    try {
      // 1 Reset CSS accent color to default
      try {
        document.documentElement.style.removeProperty("--accent-color");
        console.log("[useLogout] Reset accent color");
      } catch (err) {
        console.error("[useLogout] Error resetting accent color:", err);
      }

      // 2. Call server logout endpoint FIRST to clear HTTP-only cookie
      try {
        await fetch("/auth/logout", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        });
        console.log("[useLogout] Server logout successful");
      } catch (err) {
        console.error("[useLogout] Server logout failed:", err);
        // Continue with client-side logout even if server call fails
      }

      // 3. Clear global auth state (broadcasts to all tabs)
      clearGlobalAuthState();
      console.log("[useLogout] Cleared global auth state");

      // 4. Clear tab-specific auth marker
      removeTabAuth();
      console.log("[useLogout] Removed tab auth");

      // 5. Clear localStorage
      try {
        localStorage.clear(); // Clear everything to be safe
        console.log("[useLogout] Cleared localStorage");
      } catch (err) {
        console.error("[useLogout] Error clearing localStorage:", err);
      }

      // 6. Clear sessionStorage
      try {
        sessionStorage.clear();
        console.log("[useLogout] Cleared sessionStorage");
      } catch (err) {
        console.error("[useLogout] Error clearing sessionStorage:", err);
      }

      // 7. Dispatch logout event for other components to listen
      try {
        window.dispatchEvent(new Event("app:logout"));
        console.log("[useLogout] Dispatched logout event");
      } catch (err) {
        console.error("[useLogout] Error dispatching logout event:", err);
      }

      // 8. Small delay to ensure all cleanup completes
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 9. Navigate to redirect target
      console.log("[useLogout] Navigating to:", redirectTo);
      navigate(redirectTo, { replace: true });

      // 10. Force reload after navigation to clear any cached state
      setTimeout(() => {
        window.location.replace(redirectTo);
      }, 100);
    } catch (error) {
      console.error("[useLogout] Logout error:", error);
      // Force navigation even if there were errors
      window.location.replace(redirectTo);
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  const triggerLogout: TriggerLogoutFn = ({ confirm = true } = {}) => {
    if (!confirm) {
      void performLogout();
      return;
    }
    setOpen(true);
  };

  const LogoutModal = (): React.ReactElement | null => {
    if (!open) return null;

    return (
      <div
        className="logout-modal-overlay"
        role="dialog"
        aria-modal="true"
        onClick={() => setOpen(false)}
      >
        <div className="logout-modal" onClick={(e) => e.stopPropagation()}>
          <h3 className="h3-confirm">Confirm logout</h3>
          <p className="p-ask">Are you sure you want to logout?</p>
          <div className="button-container">
            <button
              onClick={() => setOpen(false)}
              className="cancel-button"
              type="button"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              className="logout-button"
              disabled={loading}
              onClick={() => void performLogout()}
              type="button"
            >
              {loading ? "Logging out..." : "Logout"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return [triggerLogout, LogoutModal];
}
