import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./css/useLogout.css";

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
export default function useLogout({ redirectTo = "/" } = {}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const performLogout = () => {
    setLoading(true);
    try {
      // perform any cleanup you want here
      localStorage.clear();
      // navigate after clearing storage
      navigate(redirectTo, { replace: true });
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  const triggerLogout = ({ confirm = true } = {}) => {
    if (!confirm) {
      performLogout();
      return;
    }
    setOpen(true);
  };

  const logoutModal = () => {
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
