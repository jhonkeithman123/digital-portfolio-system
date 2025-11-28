import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../../utils/apiClient.js";

import useMessage from "../../hooks/useMessage";
import useLogout from "../../hooks/useLogout";

import InvNotificationMenu from "./InvNotificationMenu";
import TokenGuard from "../../components/auth/tokenGuard";
import "./css/JoinClassroom.css";
import "./css/InviteBell.css";

const JoinClassroom = () => {
  const navigate = useNavigate();
  const [logout, LogoutModal] = useLogout();
  const { messageComponent, showMessage } = useMessage();

  const [code, setCode] = useState("");
  const [invites, setInvites] = useState([]);
  const [inviteOpen, setInviteOpen] = useState(false);

  const showMsgRef = useRef(showMessage);
  const bellRef = useRef(null);

  const visibleInvitesCount = invites.filter((inv) =>
    !inv.hidden && !inv.hidden === false ? true : !inv.hidden
  ).length;

  useEffect(() => {
    showMsgRef.current = showMessage;
  }, [showMessage]);

  useEffect(() => {
    apiFetch(`/classrooms/invites`)
      .then(({ unauthorized, data }) => {
        console.log("[JoinClassroom] invites response:", data);
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
        console.log("[JoinClassroom] failed to fetch invites:", err);
        showMsgRef.current("Failed to fetch invites", "error");
      });
  }, []);

  const handleJoin = (joinCode) => {
    const useCode = joinCode || code;
    if (!useCode || useCode.length !== 10)
      return showMsgRef.current(
        "Please enter a valid 10-character classroom code.",
        "error"
      );
    apiFetch(`/classrooms/join`, {
      method: "POST",
      body: JSON.stringify({ code: useCode }),
    })
      .then(({ unauthorized, data }) => {
        if (unauthorized)
          return showMsgRef.current(
            "Session expired. Please sign in again.",
            "error"
          );
        if (data?.success) {
          showMsgRef.current("Successfully enrolled", "success");
          navigate("/dash");
        } else {
          showMsgRef.current(
            data?.error || "Failed to join classroom",
            "error"
          );
        }
      })
      .catch(() =>
        showMsgRef.current("Server error. Try again later.", "error")
      );
  };

  return (
    <TokenGuard
      redirectInfo="/login"
      onExpire={() =>
        showMsgRef.current("Session expired. Please sign in again.", "error")
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
            console.log("[InviteBell] clicked - toggle:", !inviteOpen);
            setInviteOpen((v) => !v);
          }}
        >
          <svg className="invite-bell-icon" viewBox="0 0 24 24" aria-hidden>
            <path d="M12 2a7 7 0 0 0-7 7v4.5L3.3 16.1A1 1 0 0 0 4 18h16a1 1 0 0 0 .7-1.6L19 13.5V9a7 7 0 0 0-7-7zM12 22a2.5 2.5 0 0 0 2.5-2.5h-5A2.5 2.5 0 0 0 12 22z" />
          </svg>
          {visibleInvitesCount > 0 && (
            <span className="invite-badge">{visibleInvitesCount}</span>
          )}
        </button>
      </div>

      {inviteOpen && (
        <InvNotificationMenu
          invites={invites}
          setInvites={setInvites}
          anchorRef={bellRef}
          onClose={() => setInviteOpen(false)}
          onJoin={(c) => {
            console.log("Openinng the inv notification menu");
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
          />
          <button className="join-button" onClick={() => handleJoin()}>
            Join Classroom
          </button>
          <LogoutModal />
          <button className="join-button" onClick={logout}>
            Logout
          </button>
        </div>
      </div>
    </TokenGuard>
  );
};

export default JoinClassroom;
