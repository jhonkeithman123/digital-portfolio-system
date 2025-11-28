import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../../utils/apiClient";

import useMessage from "../../hooks/useMessage";
import useLogout from "../../hooks/useLogout";

import InvNotificationMenu from "./InvNotificationMenu";
import TokenGuard from "../../components/auth/tokenGuard";
import "./css/JoinClassroom.css";
import "./css/InviteBell.css";

type Invite = {
  id: string | number;
  code?: string;
  classroom_name?: string;
  hidden?: boolean;
  [k: string]: any;
};

const JoinClassroom: React.FC = (): React.ReactElement => {
  const navigate = useNavigate();
  const [logout, LogoutModal] = useLogout();
  const { messageComponent, showMessage } = useMessage();

  const [code, setCode] = useState<string>("");
  const [invites, setInvites] = useState<Invite[]>([]);
  const [inviteOpen, setInviteOpen] = useState<boolean>(false);

  const showMsgRef = useRef(showMessage);
  const bellRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    showMsgRef.current = showMessage;
  }, [showMessage]);

  useEffect(() => {
    const ac = new AbortController();
    let mounted = true;

    apiFetch(`/classrooms/invites`, { signal: ac.signal })
      .then(({ unauthorized, data }) => {
        if (!mounted) return;
        if (unauthorized) {
          setInvites([]);
          return;
        }
        if (data?.success && Array.isArray(data.invites)) {
          setInvites(data.invites);
        } else {
          setInvites([]);
        }
      })
      .catch((err) => {
        if (!mounted) return;
        showMsgRef.current?.("Failed to fetch invites", "error");
        // eslint-disable-next-line no-console
        console.error("JoinClassroom invites fetch:", err);
      });

    return () => {
      mounted = false;
      ac.abort();
    };
  }, []);

  const visibleInvitesCount = invites.filter((inv) => !inv.hidden).length;

  const handleJoin = (joinCode?: string) => {
    const useCode = (joinCode ?? code ?? "").trim();
    if (!useCode || useCode.length !== 10) {
      return showMsgRef.current?.(
        "Please enter a valid 10-character classroom code.",
        "error"
      );
    }

    apiFetch(`/classrooms/join`, {
      method: "POST",
      body: JSON.stringify({ code: useCode }),
      headers: { "Content-Type": "application/json" },
    })
      .then(({ unauthorized, data }) => {
        if (unauthorized) {
          return showMsgRef.current?.(
            "Session expired. Please sign in again.",
            "error"
          );
        }
        if (data?.success) {
          showMsgRef.current?.("Successfully enrolled", "success");
          if (data.classroom?.id) {
            navigate(
              `/classrooms/${encodeURIComponent(String(data.classroom.id))}`
            );
          } else {
            navigate("/dash");
          }
        } else {
          showMsgRef.current?.(
            data?.error || "Failed to join classroom",
            "error"
          );
        }
      })
      .catch((err) => {
        showMsgRef.current?.("Server error. Try again later.", "error");
        // eslint-disable-next-line no-console
        console.error("Join classroom error:", err);
      });
  };

  return (
    <TokenGuard
      redirectInfo="/login"
      onExpire={() =>
        showMsgRef.current?.("Session expired. Please sign in again.", "error")
      }
    >
      {messageComponent}

      <div className="invite-bell-wrapper" ref={bellRef}>
        <button
          type="button"
          className="invite-bell"
          aria-label="Invites"
          aria-expanded={inviteOpen}
          onClick={(e) => {
            e.stopPropagation();
            setInviteOpen((v) => !v);
          }}
        >
          <svg className="invite-bell-icon" viewBox="0 0 24 24" aria-hidden>
            <path d="M12 2a7 7 0 0 0-7 7v4.5L3.3 16.1A1 1 0 0 0 4 18h16a1 1 0 0 0 .7-1.6L19 13.5V9a7 7 0 0 0-7-7zM12 22a2.5 2.5 0 0 0 2.5-2.5h-5A2.5 2.5 0 0 0 12 22z" />
          </svg>
          {visibleInvitesCount > 0 && (
            <span className="invite-badge" aria-hidden>
              {visibleInvitesCount}
            </span>
          )}
        </button>
      </div>

      {inviteOpen && (
        <InvNotificationMenu
          invites={invites as any}
          setInvites={setInvites}
          anchorRef={bellRef}
          onClose={() => setInviteOpen(false)}
          onJoin={(c?: string) => {
            handleJoin(c);
            setInviteOpen(false);
          }}
        />
      )}

      <div className="join-classroom-wrapper">
        <div className="join-classroom-container">
          <h1>Welcome to Digital Portfolio</h1>
          <p>You're not enrolled in a classroom yet.</p>
          <p>
            Enter a classroom code below or wait for your teacher to invite you.
          </p>

          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter 10-character code"
            maxLength={10}
            className="code-input"
            aria-label="Classroom code"
          />
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="join-button" onClick={() => handleJoin()}>
              Join Classroom
            </button>
            <button className="join-button" onClick={() => logout()}>
              Logout
            </button>
          </div>

          <LogoutModal />
        </div>
      </div>
    </TokenGuard>
  );
};

export default JoinClassroom;
