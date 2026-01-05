import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./css/useLogout.css";

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
export default function useLogout({ redirectTo = "/" } = {}): UseLogoutReturn {
  const navigate = useNavigate();
  const [open, setOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  const performLogout = (): void => {
    setLoading(true);
    try {
      // perform any cleanup you want here
      window.localStorage.clear();
      // navigate after clearing storage
      navigate(redirectTo, { replace: true });
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  const triggerLogout: TriggerLogoutFn = ({ confirm = true } = {}) => {
    if (!confirm) {
      performLogout();
      return;
    }
    setOpen(true);
  };

  const logoutModal = (): React.ReactElement | null => {
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
            >
              Cancel
            </button>
            <button
              className="logout-button"
              disabled={loading}
              onClick={performLogout}
              type="button"
            >
              {loading ? "Logging out..." : "Logout"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return [triggerLogout, logoutModal];
}
