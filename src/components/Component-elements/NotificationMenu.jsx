import { useEffect, useState } from "react";
import { apiFetch } from "../../utils/apiClient.js";
import "./css/NotificationMenu.css";

const NotificationMenu = ({ setUnreadCount, onClose }) => {
  const [notifications, setNotifications] = useState([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState(new Set());

  const markAsRead = async (id) => {
    try {
      const { unauthorized } = await apiFetch(`/notifications/${id}/read`, {
        method: "POST",
      });
      if (unauthorized) return;
      setNotifications((prev) => {
        const next = prev.map((n) =>
          n.id === id ? { ...n, is_read: true } : n
        );
        setUnreadCount(next.filter((n) => !n.is_read).length);
        return next;
      });
    } catch {}
  };

  const toggleSelectionMode = () => {
    setSelectionMode((s) => {
      if (s) setSelected(new Set());
      return !s;
    });
  };

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const markSelectedRead = async () => {
    if (!selected.size) return;
    const ids = [...selected];
    try {
      const { unauthorized } = await apiFetch(`/notifications/read-batch`, {
        method: "POST",
        body: JSON.stringify({ ids }),
      });
      if (unauthorized) return;
      setNotifications((prev) => {
        const next = prev.map((n) =>
          selected.has(n.id) ? { ...n, is_read: true } : n
        );
        setUnreadCount(next.filter((n) => !n.is_read).length);
        return next;
      });
      setSelected(new Set());
    } catch (e) {
      // silent
    }
  };

  const markAllRead = async () => {
    try {
      const { unauthorized } = await apiFetch(`/notifications/mark-all-read`, {
        method: "POST",
      });
      if (unauthorized) return;
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
      setSelected(new Set());
    } catch (e) {
      // silent
    }
  };

  useEffect(() => {
    apiFetch(`/notifications`)
      .then(({ unauthorized, data }) => {
        if (unauthorized) {
          setUnreadCount(0);
          setNotifications([]);
          return;
        }
        const list = Array.isArray(data?.notifications)
          ? data.notifications
          : Array.isArray(data?.message)
          ? data.message
          : [];
        setUnreadCount(list.filter((n) => !n.is_read).length);
        setNotifications(list);
      })
      .catch(() => {
        setUnreadCount(0);
        setNotifications([]);
      });
  }, [setUnreadCount]);

  return (
    <div className="notification-menu">
      <div className="nm-header">
        <h4 className="nm-title">Notifications</h4>
        <button
          className="nm-btn"
          onClick={toggleSelectionMode}
          title={selectionMode ? "Exit selection" : "Select multiple"}
        >
          {selectionMode ? "Done" : "Select"}
        </button>
        {selectionMode && (
          <>
            <button
              className="nm-btn"
              onClick={markSelectedRead}
              disabled={!selected.size}
              title="Mark selected as read"
            >
              Mark selected
            </button>
            <button
              className="nm-btn"
              onClick={() => setSelected(new Set())}
              disabled={!selected.size}
              title="Clear selection"
            >
              Clear
            </button>
          </>
        )}
        <button
          className="nm-btn"
          onClick={markAllRead}
          disabled={!notifications.some((n) => !n.is_read)}
          title="Mark all as read"
        >
          Mark all
        </button>
        <button className="nm-close" onClick={onClose} aria-label="Close">
          x
        </button>
      </div>

      <ul className="nm-list">
        {notifications.length === 0 && (
          <li className="nm-empty">No notifications</li>
        )}
        {notifications.map((n) => {
          const isSel = selected.has(n.id);
          return (
            <li
              key={n.id}
              className={`nm-item ${n.is_read ? "read" : "unread"} ${
                isSel ? "selected" : ""
              }`}
              onClick={() =>
                selectionMode ? toggleSelect(n.id) : markAsRead(n.id)
              }
              title={
                n.created_at ? new Date(n.created_at).toLocaleString() : ""
              }
            >
              {selectionMode && (
                <span
                  className={`nm-check ${isSel ? "on" : ""}`}
                  aria-hidden="true"
                />
              )}
              {!n.is_read && !selectionMode && (
                <span className="nm-dot" aria-hidden="true" />
              )}
              <a
                className="nm-link"
                href={n.link || "#"}
                onClick={(e) => {
                  if (selectionMode) {
                    e.preventDefault();
                    toggleSelect(n.id);
                  } else if (!n.link) e.preventDefault();
                }}
              >
                {n.message}
              </a>
              <span className="nm-time">
                {n.created_at ? new Date(n.created_at).toLocaleString() : ""}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default NotificationMenu;
