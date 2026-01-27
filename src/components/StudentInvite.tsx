import React, { useState, useEffect, useRef } from "react";
import useMessage from "hooks/useMessage";
import { apiFetch } from "utils/apiClient";
import useLoadingState from "hooks/useLoading";
import LoadingOverlay from "./Component-elements/loading_overlay";
import useRealTimeData from "hooks/useRealTimeData";
import "./css/StudentInvite.css";

interface Student {
  id: string | number;
  name?: string | null;
  username?: string | null;
  avatar?: string | null;
  section?: string | null;
  grade?: string | null;
  [k: string]: any;
}

interface StudentInviteProps {
  classroomCode: string;
  onClose?: () => void;
  onInvite?: (studentId: string | number) => void;
}

const StudentInvite: React.FC<StudentInviteProps> = ({
  classroomCode,
  onClose,
  onInvite,
}): React.ReactElement => {
  const { messageComponent, showMessage } = useMessage();
  const showMsgRef = useRef<typeof showMessage>(showMessage);
  const { loading, wrap } = useLoadingState(false);

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [invitedIds, setInvitedIds] = useState<Array<string | number>>([]);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  useEffect(() => {
    showMsgRef.current = showMessage;
  }, [showMessage]);

  // Real-time student list polling
  const {
    data: realTimeStudents,
    isPolling,
    refresh,
  } = useRealTimeData<Student[]>({
    fetchFn: async () => {
      const { data, unauthorized } = await apiFetch<{
        success?: boolean;
        students?: Student[];
      }>(`/classrooms/${classroomCode}/students`);

      if (unauthorized) {
        throw new Error("Session expired");
      }

      if (data?.success && Array.isArray(data.students)) {
        return data.students;
      }

      return [];
    },
    interval: 10000, // Poll every 10 seconds
    enabled: true,
    onChange: (newStudents) => {
      setStudents(newStudents);
      // Clear invitedIds for students that are back in the list
      // This handles the case where a classroom was deleted and recreated
      setInvitedIds((prev) => {
        const currentStudentIds = newStudents.map((s) => s.id);
        return prev.filter((id) => !currentStudentIds.includes(id));
      });
    },
    onError: (error) => {
      console.error("StudentInvite fetch error:", error);
      if (error.message === "Session expired") {
        showMsgRef.current?.("Session expired. Please sign in.", "error");
      }
    },
  });

  // Initialize students from real-time data
  useEffect(() => {
    if (realTimeStudents) {
      setStudents(realTimeStudents);
      setFilteredStudents(realTimeStudents);
    }
  }, [realTimeStudents]);

  // Refresh on window focus to catch manual database changes
  useEffect(() => {
    const handleFocus = () => {
      console.log("Window focused, refreshing student list...");
      setRefreshKey((prev) => prev + 1);
      refresh?.();
      // Also clear invitedIds to allow re-inviting
      setInvitedIds([]);
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refresh]);

  useEffect(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) {
      setFilteredStudents(students);
      return;
    }

    const matches = students.filter((student) => {
      const combined = `${student.name ?? ""} ${student.username ?? ""} ${
        student.section ?? ""
      }`.toLowerCase();
      return combined.includes(q);
    });

    setFilteredStudents(matches);
  }, [searchTerm, students]);

  const handleInvite = async (studentId: string | number): Promise<void> => {
    // prevent double invite attempts
    if (invitedIds.includes(studentId)) return;

    await wrap(async () => {
      try {
        const { data, unauthorized } = await apiFetch(
          `/classrooms/${classroomCode}/invite`,
          {
            method: "POST",
            body: JSON.stringify({ studentId }),
            headers: { "Content-Type": "application/json" },
          },
        );

        if (unauthorized) {
          showMsgRef.current?.("Session expired. Please sign in.", "error");
          return;
        }

        if (data?.success) {
          setStudents((prev) => prev.filter((s) => s.id !== studentId));
          setFilteredStudents((prev) => prev.filter((s) => s.id !== studentId));
          setInvitedIds((prev) => [...prev, studentId]);
          if (typeof onInvite === "function") onInvite(studentId);
          showMsgRef.current?.("Invite sent", "success");
        } else {
          showMsgRef.current?.(data?.error || "Invite failed", "error");
        }
      } catch (error) {
        console.error("Invite error:", error);
        showMsgRef.current?.("Invite error", "error");
      }
    });
  };

  const handleManualRefresh = async (): Promise<void> => {
    await wrap(async () => {
      console.log("Manual refresh triggered");
      setRefreshKey((prev) => prev + 1);
      setInvitedIds([]); // Clear invited state
      await refresh?.();
      showMsgRef.current?.("Student list refreshed", "info");
    });
  };

  const copyCode = async (): Promise<void> => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(classroomCode);
        showMsgRef.current?.("Code copied to clipboard", "info");
      } else {
        // fallback
        const el = document.createElement("textarea");
        el.value = classroomCode;
        el.style.position = "fixed";
        el.style.left = "-9999px";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
        showMsgRef.current?.("Code copied to clipboard", "info");
      }
    } catch {
      showMsgRef.current?.("Failed to copy code", "error");
    }
  };

  // Group students by section for better organization
  const groupedStudents = filteredStudents.reduce(
    (acc, student) => {
      const section = student.section || "No Section";
      if (!acc[section]) acc[section] = [];
      acc[section].push(student);
      return acc;
    },
    {} as Record<string, Student[]>,
  );

  return (
    <>
      {messageComponent}
      <div className="invite-popup-overlay" onClick={onClose}>
        <div className="invite-section" onClick={(e) => e.stopPropagation()}>
          <LoadingOverlay loading={loading} text="" fullPage={false} />

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
            }}
          >
            <h4 style={{ margin: 0 }}>Invite Students</h4>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                type="button"
                className="refresh-button"
                onClick={handleManualRefresh}
                disabled={loading}
                title="Refresh student list"
                aria-label="Refresh student list"
              >
                <svg
                  viewBox="0 0 24 24"
                  style={{ width: "16px", height: "16px" }}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                </svg>
              </button>
              {isPolling && (
                <div
                  className="polling-indicator-small"
                  title="Auto-updating student list..."
                >
                  <svg
                    className="polling-icon"
                    viewBox="0 0 24 24"
                    style={{ width: "14px", height: "14px" }}
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      opacity="0.3"
                    />
                    <path
                      d="M12 2a10 10 0 0 1 10 10"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <animateTransform
                        attributeName="transform"
                        type="rotate"
                        from="0 12 12"
                        to="360 12 12"
                        dur="1.5s"
                        repeatCount="indefinite"
                      />
                    </path>
                  </svg>
                </div>
              )}
            </div>
          </div>

          <input
            type="text"
            placeholder="Search by name, username, or section..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="invite-input"
            disabled={loading}
          />

          <div className="invite-results">
            {loading ? (
              <div className="loading-spinner" aria-hidden />
            ) : filteredStudents.length > 0 ? (
              Object.entries(groupedStudents).map(
                ([section, sectionStudents]) => (
                  <div key={section} className="section-group">
                    <div className="section-header">{section}</div>
                    {sectionStudents.map((student) => (
                      <div key={student.id} className="student-card">
                        <img
                          src={student.avatar || "/images/dummy_student_1.jpg"}
                          alt={
                            student.name ? `${student.name} avatar` : "Profile"
                          }
                          className="student-avatar"
                        />
                        <div className="student-info">
                          <div className="student-name">
                            {student.name ?? student.username}
                          </div>
                          {student.section && (
                            <div className="student-section">
                              Grade {student.grade} • {student.section}
                            </div>
                          )}
                        </div>
                        <div style={{ marginLeft: "auto" }}>
                          <button
                            disabled={
                              invitedIds.includes(student.id) || loading
                            }
                            onClick={() => void handleInvite(student.id)}
                            className="custom-button"
                            type="button"
                          >
                            {invitedIds.includes(student.id)
                              ? "Invited"
                              : "Invite"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ),
              )
            ) : (
              <p className="no-results">
                {searchTerm
                  ? "No matching students found."
                  : "No students available to invite."}
              </p>
            )}
          </div>

          <div className="invite-code">
            <span className="code-text" aria-live="polite">
              {classroomCode}
            </span>
            <button
              className="custom-button"
              onClick={() => void copyCode()}
              type="button"
            >
              Copy Code
            </button>
          </div>

          <div className="invite-actions">
            <button className="close-button" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default StudentInvite;
