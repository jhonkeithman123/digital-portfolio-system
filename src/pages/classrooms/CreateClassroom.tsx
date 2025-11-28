import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../../utils/apiClient";
import useMessage from "../../hooks/useMessage";
import useLogout from "../../hooks/useLogout";
import TokenGuard from "../../components/auth/tokenGuard";
import "./css/CreateClassroom.css";

const CreateClassroom: React.FC = (): React.ReactElement => {
  const navigate = useNavigate();
  const [logout, LogoutModal] = useLogout();
  const { messageComponent, showMessage } = useMessage();

  const showMsgRef = useRef(showMessage);

  const [name, setName] = useState<string>("");
  const [schoolYear, setSchoolYear] = useState<string>("");
  const [section, setSection] = useState<string>("");
  const [creating, setCreating] = useState<boolean>(false);

  useEffect(() => {
    showMsgRef.current = showMessage;
  }, [showMessage]);

  const handleCreate = useCallback(
    async (e?: React.FormEvent) => {
      if (e && typeof e.preventDefault === "function") e.preventDefault();
      const trimmedName = name.trim();
      const trimmedYear = schoolYear.trim();
      const trimmedSection = section.trim();

      if (!trimmedName || !trimmedYear) {
        return showMsgRef.current("Please fill all required fields.", "error");
      }

      const payload: Record<string, unknown> = {
        name: trimmedName,
        schoolYear: trimmedYear,
      };
      if (trimmedSection) payload.section = trimmedSection;

      setCreating(true);
      try {
        const { data, unauthorized } = await apiFetch(`/classrooms/create`, {
          method: "POST",
          body: JSON.stringify(payload),
          headers: { "Content-Type": "application/json" },
        });

        if (unauthorized) {
          showMsgRef.current("Session expired. Please sign in again.", "error");
          return;
        }

        if (data?.success) {
          showMsgRef.current("Classroom created", "success");
          // prefer server-provided classroom path when available
          if (data.classroom?.id) {
            navigate(
              `/classrooms/${encodeURIComponent(String(data.classroom.id))}`
            );
          } else if (data.classroom?.code) {
            navigate(
              `/classrooms/${encodeURIComponent(String(data.classroom.code))}`
            );
          } else {
            navigate("/dash");
          }
        } else {
          showMsgRef.current(
            data?.error || "Failed to create classroom.",
            "error"
          );
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("Create classroom error:", err);
        showMsgRef.current("Server error. Try again later.", "error");
      } finally {
        setCreating(false);
      }
    },
    [name, schoolYear, section, navigate]
  );

  return (
    <TokenGuard
      redirectInfo="/login"
      onExpire={() =>
        showMsgRef.current("Session expired. Please sign in again.", "error")
      }
    >
      {messageComponent}

      <div className="create-classroom-wrapper">
        <div className="create-classroom-container">
          <h1>Create Your Advisory Classroom</h1>
          <form onSubmit={handleCreate} className="create-class-form">
            <input
              className="create-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Classroom Name"
              aria-label="Classroom name"
              required
            />
            <input
              className="create-input"
              type="text"
              value={schoolYear}
              onChange={(e) => setSchoolYear(e.target.value)}
              placeholder="School Year (e.g. 2025-2026)"
              aria-label="School year"
              required
            />
            <input
              className="create-input"
              type="text"
              value={section}
              onChange={(e) => setSection(e.target.value)}
              placeholder="Section (e.g. STEM-2)"
              aria-label="Section (optional)"
            />
            <div className="create-actions">
              <button
                className="create-button"
                type="submit"
                disabled={creating}
              >
                {creating ? "Creating…" : "Create Classroom"}
              </button>
              <button
                className="create-button"
                type="button"
                onClick={() => logout()}
                disabled={creating}
              >
                Logout
              </button>
            </div>
          </form>

          <LogoutModal />
        </div>
      </div>
    </TokenGuard>
  );
};

export default CreateClassroom;
