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
import { split } from "postcss/lib/list";

const CreateClassroom: React.FC = (): React.ReactElement => {
  const navigate = useNavigate();
  const [logout, LogoutModal] = useLogout();
  const { messageComponent, showMessage } = useMessage();
  const { loading, wrap } = useLoadingState(false);

  const showMsgRef = useRef<typeof showMessage>(showMessage);

  const [name, setName] = useState<string>("");
  const [schoolYear, setSchoolYear] = useState<string>("");
  const [gradeAndSection, setGradeAndSection] = useState<string>("");

  useEffect(() => {
    showMsgRef.current = showMessage;
  }, [showMessage]);

  const validateGradeAndSection = (
    gradeAndSec: string,
  ): { valid: boolean; error?: string } => {
    const parts = gradeAndSec.split("-");

    if (parts.length !== 3) {
      return {
        valid: false,
        error:
          "Grade & Section must be in format: XX-YYYY-XY (e.g., 12-ICT-A2)",
      };
    }

    const [grade, strand, section] = parts;

    // Validate grade (11 or 12)
    if (!["11", "12"].includes(grade)) {
      return {
        valid: false,
        error: "Grade must be 11 or 12",
      };
    }

    // Validate strand (2-5 letters)
    if (!/^[A-Z]{2,5}$/.test(strand)) {
      return {
        valid: false,
        error: "Strand must be 2-5 letters (e.g., ICT, STEM, ABM, HUMSS)",
      };
    }

    // Validate section (letter + digit)
    if (!/^[A-Z]\d$/.test(section)) {
      return {
        valid: false,
        error: "Section must be a letter followed by a digit (e.g., A1, B2)",
      };
    }

    return { valid: true };
  };

  const handleCreate = useCallback(
    async (e?: React.FormEvent) => {
      if (e && typeof e.preventDefault === "function") e.preventDefault();

      await wrap(async () => {
        const trimmedName = name.trim();
        const trimmedYear = schoolYear.trim();

        if (!trimmedName || !trimmedYear) {
          return showMsgRef.current(
            "Please fill all required fields.",
            "error",
          );
        }

        let grade: string | null = null;
        let section: string | null = null;

        if (gradeAndSection.trim()) {
          const parts = gradeAndSection.trim().toUpperCase().split("-");
          if (parts.length === 3) {
            grade = parts[0];
            section = `${parts[1]}-${parts[2]}`;
          }
        }

        const payload: Record<string, string | null> = {
          name: trimmedName,
          schoolYear: trimmedYear,
          section: section || null,
          grade: grade || null,
        };

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
    [name, schoolYear, gradeAndSection, navigate, wrap],
  );

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
              label="Grade & Section"
              name="gradeAndSection"
              value={gradeAndSection}
              onChange={(e) => setGradeAndSection(e.target.value)}
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
