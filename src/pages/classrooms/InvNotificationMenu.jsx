import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../../utils/apiClient.js";
import "./css/InvNotificationMenu.css";

const InvNotificationMenu = ({
  invites = [],
  setInvites,
  onJoin,
  onClose,
  anchorRef,
}) => {
  const overlayRef = useRef(null);
  const [pos, setPos] = useState({
    top: 0,
    left: 0,
    transformOrigin: "top right",
  });

  useEffect(() => {
    if (!anchorRef?.current || !overlayRef.current) return;

    const anchor = anchorRef.current.getBoundingClientRect();
    const overlay = overlayRef.current;
    const overlayWidth = overlay.offsetWidth || 320;
    const overlayHeight = overlay.offsetHeight || 200;

    const left = window.scrollX + anchor.right - overlayWidth;
    const top = window.scrollY + anchor.bottom + 8 - overlayHeight;

    setPos({ top, left, transformOrigin: "top right" });
  }, [anchorRef, invites.length]);

  const hideInvite = async (inviteId) => {
    try {
      const { ok, unauthorized } = await apiFetch(
        `/classrooms/invites/${inviteId}/hide`,
        { method: "POST" }
      );
      if (unauthorized || !ok) return;
      setInvites((prev) => {
        const next = prev.filter((inv) => inv.id !== inviteId);
        if (next.length === 0 && typeof onClose === "function") onClose();
        return next;
      });
    } catch (err) {
      console.error("Failed to hide invite:", err);
    }
  };

  return (
    <div
      className="inv-notification-overlay"
      role="dialog"
      aria-live="polite"
      onClick={() => {
        if (onClose) onClose();
      }}
    >
      <div
        className="inv-notification-wrapper"
        onClick={(e) => e.stopPropagation()}
      >
        {invites.length === 0 ? (
          <div className="inv-notification">
            <div className="inv-content">
              <h3>No invitations</h3>
              <p className="inv-details">
                You have no invitations at this time.
              </p>
              <div className="inv-actions">
                <button
                  className="inv-dismiss"
                  onClick={() => {
                    setInvites([]);
                    if (onClose) onClose();
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        ) : (
          invites.map((invite) => (
            <div key={invite.id} className="inv-notification">
              <div className="inv-content">
                <h3>Classroom Invitation</h3>
                <p>
                  You've been invited to join{" "}
                  <strong>{invite.classroomName}</strong>
                </p>
                <p className="inv-details">From: {invite.teacherName}</p>
                <div className="inv-actions">
                  <button
                    className="inv-join"
                    onClick={() => {
                      onJoin(invite.code);
                    }}
                  >
                    Join Now
                  </button>
                  <button
                    className="inv-dismiss"
                    onClick={() => hideInvite(invite.id)}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default InvNotificationMenu;
