import React, { useEffect, useRef, useState } from "react";
import { apiFetch } from "../../utils/apiClient";
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
}

const InvNotificationMenu: React.FC<InvNotificationMenuProps> = ({
  invites = [],
  setInvites,
  onJoin,
  onClose,
  anchorRef,
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

  useEffect(() => {
    const computePos = () => {
      const anchorEl = anchorRef?.current;
      const overlayEl = overlayRef.current;
      if (!overlayEl) return;

      const overlayW = Math.max(overlayEl.offsetWidth, 240);
      const overlayH = overlayEl.offsetHeight || 200;

      // If anchor provided, position relative to it; otherwise center in viewport
      if (!anchorEl) {
        const left = Math.max(
          8 + window.scrollX,
          Math.min(
            Math.round(window.scrollX + (window.innerWidth - overlayW) / 2),
            window.scrollX + window.innerWidth - overlayW - 8
          )
        );
        const top = Math.max(
          8 + window.scrollY,
          Math.min(
            Math.round(window.scrollY + (window.innerHeight - overlayH) / 2),
            window.scrollY + window.innerHeight - overlayH - 8
          )
        );
        setPos({ top, left, transformOrigin: "center" });
        return;
      }

      const anchor = anchorEl.getBoundingClientRect();

      // preferred position: align right edge of overlay with right of anchor, above anchor
      let left = window.scrollX + anchor.right - overlayW;
      let top = window.scrollY + anchor.bottom + 8 - overlayH;
      let transformOrigin = "top right";

      // clamp inside viewport
      left = Math.max(
        8 + window.scrollX,
        Math.min(left, window.scrollX + window.innerWidth - overlayW - 8)
      );
      top = Math.max(
        8 + window.scrollY,
        Math.min(top, window.scrollY + window.innerHeight - overlayH - 8)
      );

      // if there's not enough space above, put below anchor
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
    try {
      const { data, unauthorized } = await apiFetch<{ success?: boolean }>(
        `/classrooms/invites/${encodeURIComponent(String(inviteId))}/hide`,
        {
          method: "POST",
        }
      );
      if (unauthorized) return;
      if (!data?.success) return;

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
      aria-modal="true"
      onClick={() => {
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
            return (
              <div key={String(invite.id)} className="inv-notification">
                <div className="inv-content">
                  <h3>Classroom Invitation</h3>
                  <p>
                    You've been invited to join <strong>{classroomName}</strong>
                  </p>
                  <p className="inv-details">From: {teacherName}</p>
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
            );
          })
        )}
      </div>
    </div>
  );
};

export default InvNotificationMenu;
