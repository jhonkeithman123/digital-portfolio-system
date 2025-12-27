import React, { useEffect, useRef, useState, type SetStateAction } from "react";
import { useNavigate } from "react-router-dom";
import useMessage from "../../hooks/useMessage";
import { apiFetch } from "../../utils/apiClient";
import "./css/NotificationMenu.css";

interface Notification {
  id: number;
  message?: string;
  link?: string | null;
  is_read?: boolean;
  created_at?: string | null;
  [k: string]: any;
}

interface NotificationMenuProps {
  setUnreadCount: React.Dispatch<SetStateAction<number>>;
  onClose: () => void;
}

const NotificationMenu: React.FC<NotificationMenuProps> = ({
  setUnreadCount,
  onClose,
}): React.ReactElement => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [selectionMode, setSelectionMode] = useState<boolean>(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const navigate = useNavigate();
  const { showMessage } = useMessage();

  const showMsgRef = useRef<typeof showMessage>(showMessage);

  useEffect(() => {
    showMsgRef.current = showMessage;
  }, [showMessage]);

  const markAsRead = async (id: number) => {
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

  const handleAction = async (n: Notification) => {
    if (selectionMode) {
      toggleSelect(n.id);
      return;
    }

    await markAsRead(n.id);

    const txt = String(n.message ?? "").toLocaleLowerCase();
    const isInvite =
      txt.includes("invite") || txt.includes("invited") || txt.includes("join");

    if (isInvite) {
      const code =
        (n as any).code ||
        (n as any).classroom_code ||
        (n as any).classroomCode ||
        (() => {
          try {
            const link = String(n.link || "");
            const m = link.match(/\/classrooms\/([^\/?#]+)/);
            return m ? decodeURIComponent(m[1]) : null;
          } catch {
            return null;
          }
        })();

      if (code) {
        try {
          const { unauthorized, data } = await apiFetch(
            `/classrooms/${encodeURIComponent(String(code))}/is-member`
          );
          if (unauthorized) return;
          if (data?.isMember) {
            showMsgRef.current?.(
              "You are already enrolled in that classroom.",
              "info"
            );
            return;
          }
        } catch (err: unknown | undefined) {}
      }
    }

    if (n.link && typeof n.link === "string") {
      onClose();
      navigate(n.link);
    } else {
      onClose();
      navigate("/dash");
    }
  };

  const toggleSelectionMode = () => {
    setSelectionMode((s) => {
      if (s) setSelected(new Set<number>());
      return !s;
    });
  };

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(notifications.map((n) => n.id)));
  };

  const deselectAll = () => {
    setSelected(new Set());
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
      setSelected(new Set<number>());
      showMsgRef.current?.("Marked as read", "success");
    } catch (e) {
      showMsgRef.current?.("Failed to mark as read", "error");
    }
  };

  const deleteSelected = async () => {
    if (!selected.size) return;
    const ids = [...selected];

    try {
      const { unauthorized } = await apiFetch(`/notifications/delete-batch`, {
        method: "DELETE",
        body: JSON.stringify({ ids }),
      });

      if (unauthorized) return;

      setNotifications((prev) => {
        const next = prev.filter((n) => !selected.has(n.id));
        setUnreadCount(next.filter((n) => !n.is_read).length);
        return next;
      });
      setSelected(new Set<number>());
      showMsgRef.current?.(`Deleted ${ids.length} notification(s)`, "success");
    } catch (e) {
      showMsgRef.current?.("Failed to delete notifications", "error");
    }
  };

  const deleteAll = async () => {
    if (!window.confirm("Delete all notifications? This cannot be undone.")) {
      return;
    }

    try {
      const { unauthorized } = await apiFetch(`/notifications/delete-all`, {
        method: "DELETE",
      });

      if (unauthorized) return;

      setNotifications([]);
      setUnreadCount(0);
      setSelected(new Set<number>());
      showMsgRef.current?.("All notifications deleted", "success");
    } catch (e) {
      showMsgRef.current?.("Failed to delete notifications", "error");
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
      setSelected(new Set<number>());
      showMsgRef.current?.("All marked as read", "success");
    } catch (e) {
      showMsgRef.current?.("Failed to mark all as read", "error");
    }
  };

  useEffect(() => {
    apiFetch<{ notifications?: Notification[]; message?: Notification[] }>(
      `/notifications`
    )
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

  const allSelected =
    notifications.length > 0 && selected.size === notifications.length;

  return (
    <div className="notification-menu">
      <div className="nm-header">
        <h4 className="nm-title">Notifications</h4>
        <button className="nm-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      <div className="nm-toolbar">
        {!selectionMode ? (
          <>
            <button
              className="nm-btn nm-btn-icon"
              onClick={toggleSelectionMode}
              title="Select multiple"
            >
              <span className="nm-icon">☑</span>
              <span className="nm-label">Select</span>
            </button>
            <button
              className="nm-btn nm-btn-icon"
              onClick={markAllRead}
              disabled={!notifications.some((n) => !n.is_read)}
              title="Mark all as read"
            >
              <span className="nm-icon">✓</span>
              <span className="nm-label">Read All</span>
            </button>
            <button
              className="nm-btn nm-btn-icon nm-btn-danger"
              onClick={deleteAll}
              disabled={notifications.length === 0}
              title="Delete all notifications"
            >
              <span className="nm-icon">🗑</span>
              <span className="nm-label">Delete All</span>
            </button>
          </>
        ) : (
          <>
            <button
              className="nm-btn"
              onClick={toggleSelectionMode}
              title="Exit selection mode"
            >
              Done
            </button>
            <button
              className="nm-btn nm-btn-icon"
              onClick={allSelected ? deselectAll : selectAll}
              disabled={notifications.length === 0}
              title={allSelected ? "Deselect all" : "Select all"}
            >
              <span className="nm-icon">{allSelected ? "☐" : "☑"}</span>
              <span className="nm-label">
                {allSelected ? "Deselect" : "Select All"}
              </span>
            </button>
            <button
              className="nm-btn nm-btn-icon"
              onClick={markSelectedRead}
              disabled={!selected.size}
              title="Mark selected as read"
            >
              <span className="nm-icon">✓</span>
              <span className="nm-label">Read</span>
            </button>
            <button
              className="nm-btn nm-btn-icon nm-btn-danger"
              onClick={deleteSelected}
              disabled={!selected.size}
              title="Delete selected"
            >
              <span className="nm-icon">🗑</span>
              <span className="nm-label">Delete</span>
            </button>
          </>
        )}
      </div>

      {selectionMode && selected.size > 0 && (
        <div className="nm-selection-info">{selected.size} selected</div>
      )}

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
              <button
                type="button"
                className="nm-link"
                onClick={(e) => {
                  e.preventDefault();
                  handleAction(n);
                }}
              >
                {n.message}
              </button>
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
