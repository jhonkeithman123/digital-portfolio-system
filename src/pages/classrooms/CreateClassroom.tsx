import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "utils/apiClient";
import useMessage from "hooks/useMessage";
import useLogout from "hooks/useLogout";
import TokenGuard from "components/auth/tokenGuard";
import LoadingOverlay from "components/Component-elements/loading_overlay";
import useLoadingState from "hooks/useLoading";
import Header from "components/Component-elements/Header";
import InputField from "components/Component-elements/InputField";
import "./css/CreateClassroom.css";

const CreateClassroom: React.FC = (): React.ReactElement => {
  const navigate = useNavigate();
  const [logout, LogoutModal] = useLogout();
  const { messageComponent, showMessage } = useMessage();
  const { loading, wrap } = useLoadingState(false);

  const showMsgRef = useRef<typeof showMessage>(showMessage);

  const [name, setName] = useState<string>("");
  const [schoolYear, setSchoolYear] = useState<string>("");
  const [section, setSection] = useState<string>("");

  useEffect(() => {
    showMsgRef.current = showMessage;
  }, [showMessage]);

  const validateSectionFormat = (sectionInput: string): boolean => {
    const trimmed = sectionInput.trim().toUpperCase();
    // Updated pattern: XX-YYYY-XY (e.g., 12-ICT-A2)
    const sectionPattern = /^\d{2}-[A-Z]{2,5}-[A-Z]\d$/;
    return sectionPattern.test(trimmed);
  };

  const handleCreate = useCallback(
    async (e?: React.FormEvent) => {
      if (e && typeof e.preventDefault === "function") e.preventDefault();

      await wrap(async () => {
        const trimmedName = name.trim();
        const trimmedYear = schoolYear.trim();
        const trimmedSection = section.trim();

        if (!trimmedName || !trimmedYear) {
          return showMsgRef.current(
            "Please fill all required fields.",
            "error",
          );
        }

        if (trimmedSection && !validateSectionFormat(trimmedSection)) {
          return showMsgRef.current(
            "Section must follow format: XX-YYYY-XY (e.g., 12-ICT-A2, 11-STEM-B1)",
            "error",
          );
        }

        const payload: Record<string, unknown> = {
          name: trimmedName,
          schoolYear: trimmedYear,
        };
        if (trimmedSection) payload.section = trimmedSection;

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
          if (data.classroom?.id) {
            navigate(
              `/classrooms/${encodeURIComponent(String(data.classroom.id))}`,
            );
          } else if (data.classroom?.code) {
            navigate(
              `/classrooms/${encodeURIComponent(String(data.classroom.code))}`,
            );
          } else {
            navigate("/dash");
          }
        } else {
          showMsgRef.current(
            data?.error || "Failed to create classroom.",
            "error",
          );
        }
      });
    },
    [name, schoolYear, section, navigate, wrap],
  );

  const handleSectionChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ): void => {
    const value = e.target.value.toUpperCase();
    setSection(value);
  };

  return (
    <TokenGuard
      redirectInfo="/login"
      onExpire={() =>
        showMsgRef.current("Session expired. Please sign in again.", "error")
      }
    >
      <Header
        title="Advisory"
        subtitle="Create Classroom"
        leftActions={
          <button
            onClick={() => navigate(-1)}
            className="header-link"
            aria-label="Go back"
            disabled={loading}
            type="button"
          >
            ← Back
          </button>
        }
      />

      {messageComponent}
      <LoadingOverlay loading={loading} text="" fullPage={false} />

      <div className="create-classroom-wrapper">
        <div className="create-classroom-container">
          <h1>Create Your Advisory Classroom</h1>
          <form onSubmit={handleCreate} className="create-class-form">
            <InputField
              label="Classroom Name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter classroom name"
              required
            />

            <InputField
              label="School Year"
              name="schoolYear"
              value={schoolYear}
              onChange={(e) => setSchoolYear(e.target.value)}
              placeholder="e.g., 2025-2026"
              required
            />

            <InputField
              label="Grade & Section (Optional)"
              name="gradeAndSection"
              value={section}
              onChange={(e) => setSection(e.target.value)}
              placeholder="Format: XX-YYYY-XY"
              helperText="Format: XX-YYYY-XY (e.g., 12-ICT-A2, 11-STEM-B1)"
            />

            <div className="create-actions">
              <button
                className="create-button"
                type="submit"
                disabled={loading}
              >
                Create Classroom
              </button>
              <button
                className="create-button"
                type="button"
                onClick={() => logout()}
                disabled={loading}
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
