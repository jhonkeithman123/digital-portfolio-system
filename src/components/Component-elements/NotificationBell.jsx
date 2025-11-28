import { useState } from "react";
import NotificationMenu from "./NotificationMenu";
import "./css/NotificationBell.css";

const NotificationBell = ({ unreadCount, setUnreadCount }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="notification-bell-wrapper">
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => setOpen((prev) => !prev)}
        className="notification-icon"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M12 2a7 7 0 0 0-7 7v4.5l-1.7 2.6a1 1 0 0 0 .8 1.6h16a1 1 0 0 0 .8-1.6L19 13.5V9a7 7 0 0 0-7-7zm0 20a2.5 2.5 0 0 0 2.5-2.5h-5A2.5 2.5 0 0 0 12 22z" />
        </svg>
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount}</span>
        )}
      </button>

      {open && (
        <NotificationMenu
          setUnreadCount={setUnreadCount}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
};

export default NotificationBell;
