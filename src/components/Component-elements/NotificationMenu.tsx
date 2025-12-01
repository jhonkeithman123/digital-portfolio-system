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

  //* single entrypoint for notification actions (only navigates to /dash for now)
  const handleAction = async (n: Notification) => {
    //* selection mode handled elsewhere
    if (selectionMode) {
      toggleSelect(n.id);
      return;
    }

    //* mark notification read locally + server
    await markAsRead(n.id);

    const txt = String(n.message ?? "").toLocaleLowerCase();
    const isInvite =
      txt.includes("invite") || txt.includes("invited") || txt.includes("join");

    if (isInvite) {
      //* attempt to find classroom code from notification payload
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
        } catch (err: unknown | undefined) {
          // If backend check fails, fall back to navigating to dash
        }
      }
    }

    // default/fallback navigation for now — only to /dash
    navigate("/dash");
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
      setSelected(new Set<number>());
    } catch (e) {
      // silent
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
