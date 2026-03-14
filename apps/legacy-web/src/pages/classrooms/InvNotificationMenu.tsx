import React, { useEffect, useRef, useState } from "react";
import { apiFetch } from "utils/apiClient";
import "./css/InvNotificationMenu.css";

type Invite = {
  id: string | number;
  code?: string;
  classroomName?: string;
  classroom_name?: string;
  teacherName?: string;
  teacher_name?: string;
  hidden?: boolean;
  [k: string]: any;
};

interface InvNotificationMenuProps {
  invites?: Invite[];
  setInvites: React.Dispatch<React.SetStateAction<Invite[]>>;
  onJoin: (code?: string) => void;
  onClose?: () => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
  showDismissed?: boolean;
  setShowDismissed?: React.Dispatch<React.SetStateAction<boolean>>;
  dismissedCount?: number;
}

const InvNotificationMenu: React.FC<InvNotificationMenuProps> = ({
  invites = [],
  setInvites,
  onJoin,
  onClose,
  anchorRef,
  showDismissed = false,
  setShowDismissed,
  dismissedCount = 0,
}): React.ReactElement => {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    transformOrigin: string;
  }>({
    top: 0,
    left: 0,
    transformOrigin: "top right",
  });

  console.log("[InvNotificationMenu] Rendering with invites:", invites);

  useEffect(() => {
    const computePos = () => {
      const anchorEl = anchorRef?.current;
      const overlayEl = overlayRef.current;
      if (!overlayEl) return;

      const overlayW = Math.max(overlayEl.offsetWidth, 240);
      const overlayH = overlayEl.offsetHeight || 200;

      if (!anchorEl) {
        const left = Math.max(
          8 + window.scrollX,
          Math.min(
            Math.round(window.scrollX + (window.innerWidth - overlayW) / 2),
            window.scrollX + window.innerWidth - overlayW - 8,
          ),
        );
        const top = Math.max(
          8 + window.scrollY,
          Math.min(
            Math.round(window.scrollY + (window.innerHeight - overlayH) / 2),
            window.scrollY + window.innerHeight - overlayH - 8,
          ),
        );
        setPos({ top, left, transformOrigin: "center" });
        return;
      }

      const anchor = anchorEl.getBoundingClientRect();

      let left = window.scrollX + anchor.right - overlayW;
      let top = window.scrollY + anchor.bottom + 8 - overlayH;
      let transformOrigin = "top right";

      left = Math.max(
        8 + window.scrollX,
        Math.min(left, window.scrollX + window.innerWidth - overlayW - 8),
      );
      top = Math.max(
        8 + window.scrollY,
        Math.min(top, window.scrollY + window.innerHeight - overlayH - 8),
      );

      if (top + overlayH > window.scrollY + window.innerHeight - 8) {
        top = window.scrollY + anchor.bottom + 8;
        transformOrigin = "top right";
      }

      setPos({ top, left, transformOrigin });
    };

    computePos();
    window.addEventListener("resize", computePos);
    window.addEventListener("scroll", computePos, true);
    return () => {
      window.removeEventListener("resize", computePos);
      window.removeEventListener("scroll", computePos, true);
    };
  }, [anchorRef, invites.length]);

  const hideInvite = async (inviteId: string | number) => {
    console.log("[InvNotificationMenu] Hiding invite:", inviteId);
    try {
      const { data, unauthorized } = await apiFetch<{ success?: boolean }>(
        `/classrooms/invites/${encodeURIComponent(String(inviteId))}/hide`,
        {
          method: "POST",
        },
      );

      console.log("[InvNotificationMenu] Hide response:", {
        data,
        unauthorized,
      });

      if (unauthorized) return;
      if (!data?.success) return;

      // Mark as hidden instead of removing
      setInvites((prev) =>
        prev.map((inv) =>
          inv.id === inviteId ? { ...inv, hidden: true } : inv,
        ),
      );
    } catch (err) {
      console.error("Failed to hide invite:", err);
    }
  };

  const unhideInvite = async (inviteId: string | number) => {
    console.log("[InvNotificationMenu] Unhiding invite:", inviteId);
    try {
      const { data, unauthorized } = await apiFetch<{ success?: boolean }>(
        `/classrooms/invites/${encodeURIComponent(String(inviteId))}/unhide`,
        {
          method: "POST",
        },
      );

      console.log("[InvNotificationMenu] Unhide response:", {
        data,
        unauthorized,
      });

      if (unauthorized) return;
      if (!data?.success) return;

      // Mark as visible
      setInvites((prev) =>
        prev.map((inv) =>
          inv.id === inviteId ? { ...inv, hidden: false } : inv,
        ),
      );
    } catch (err) {
      console.error("Failed to unhide invite:", err);
    }
  };

  return (
    <div
      className="inv-notification-overlay"
      role="dialog"
      aria-modal="true"
      onClick={() => {
        console.log("[InvNotificationMenu] Overlay clicked, closing");
        onClose?.();
      }}
    >
      <div
        className="inv-notification-wrapper"
        ref={overlayRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          top: pos.top,
          left: pos.left,
          transformOrigin: pos.transformOrigin,
        }}
      >
        {/* Toggle button for dismissed invites */}
        {dismissedCount > 0 && setShowDismissed && (
          <div className="inv-toggle-dismissed">
            <button
              type="button"
              className="toggle-dismissed-btn"
              onClick={() => setShowDismissed((prev) => !prev)}
            >
              {showDismissed
                ? "Hide Dismissed"
                : `Show Dismissed (${dismissedCount})`}
            </button>
          </div>
        )}

        {invites.length === 0 ? (
          <div className="inv-notification empty">
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
                    onClose?.();
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        ) : (
          invites.map((invite) => {
            const classroomName =
              invite.classroomName ?? invite.classroom_name ?? "Classroom";
            const teacherName =
              invite.teacherName ?? invite.teacher_name ?? "Teacher";
            const isDismissed = !!invite.hidden;

            console.log("[InvNotificationMenu] Rendering invite:", {
              id: invite.id,
              classroomName,
              teacherName,
              code: invite.code,
              hidden: isDismissed,
              raw: invite,
            });

            return (
              <div
                key={String(invite.id)}
                className={`inv-notification ${isDismissed ? "dismissed" : ""}`}
              >
                <div className="inv-content">
                  <h3>
                    {isDismissed
                      ? "Dismissed Invitation"
                      : "Classroom Invitation"}
                  </h3>
                  <p>
                    You've been invited to join <strong>{classroomName}</strong>
                  </p>
                  <p className="inv-details">From: {teacherName}</p>
                  <div className="inv-actions">
                    <button
                      className="inv-join"
                      onClick={() => {
                        console.log(
                          "[InvNotificationMenu] Join clicked for code:",
                          invite.code,
                        );
                        onJoin(invite.code);
                      }}
                    >
                      Join Now
                    </button>
                    {isDismissed ? (
                      <button
                        className="inv-restore"
                        onClick={() => unhideInvite(invite.id)}
                      >
                        Restore
                      </button>
                    ) : (
                      <button
                        className="inv-dismiss"
                        onClick={() => hideInvite(invite.id)}
                      >
                        Dismiss
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default InvNotificationMenu;
