import React, { useState, useEffect, useRef } from "react";
import useMessage from "../hooks/useMessage";
import { apiFetch } from "../utils/apiClient";
import "./css/StudentInvite.css";

interface Student {
  id: string | number;
  name?: string | null;
  username?: string | null;
  avatar?: string | null;
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
  const showMsgRef = useRef(showMessage);

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [invitedIds, setInvitedIds] = useState<Array<string | number>>([]);

  useEffect(() => {
    showMsgRef.current = showMessage;
  }, [showMessage]);

  useEffect(() => {
    let mounted = true;
    const ac = new AbortController();
    setLoading(true);

    apiFetch<{ success?: boolean; students?: Student[] }>(
      `/classrooms/${classroomCode}/students`,
      { signal: ac.signal }
    )
      .then(({ data, unauthorized }) => {
        if (unauthorized) {
          showMsgRef.current("Session expired. Please sign in.", "error");
          return;
        }
        if (data?.success && Array.isArray(data.students)) {
          setStudents(data.students);
          setFilteredStudents(data.students);
        } else {
          showMsgRef.current("Failed to fetch students", "error");
        }
      })
      .catch((err: unknown) => {
        if ((err as any)?.name === "AbortError") return;
        showMsgRef.current("Failed to fetch students", "error");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
  }, [classroomCode]);

  useEffect(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) {
      setFilteredStudents(students);
      return;
    }

    const matches = students.filter((student) => {
      const combined = `${student.name ?? ""} ${
        student.username ?? ""
      }`.toLowerCase();
      return combined.includes(q);
    });

    setFilteredStudents(matches);
  }, [searchTerm, students]);

  const handleInvite = async (studentId: string | number): Promise<void> => {
    try {
      const { data, unauthorized } = await apiFetch(
        `/classrooms/${classroomCode}/invite`,
        {
          method: "POST",
          body: JSON.stringify({ studentId }),
        }
      );

      if (unauthorized) {
        showMsgRef.current("Session expired. Please sign in.", "error");
        return;
      }

      if (data?.success) {
        //* remove invited students from the list so teacher won't see them again
        setStudents((prev) => prev.filter((s) => s.id !== studentId));
        setFilteredStudents((prev) => prev.filter((s) => s.id !== studentId));
        setInvitedIds((prev) => [...prev, studentId]);
        if (typeof onInvite === "function") onInvite(studentId);
        showMsgRef.current("Invite sent", "success");
      } else {
        showMsgRef.current("Invite failed", "error");
      }
    } catch (error) {
      showMsgRef.current("Invite error", "error");
    }
  };

  const copyCode = async (): Promise<void> => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(classroomCode);
        showMsgRef.current("Code copied to clipboard", "info");
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
        showMsgRef.current("Code copied to clipboard", "info");
      }
    } catch {
      showMsgRef.current("Failed to copy code", "error");
    }
  };

  return (
    <>
      {messageComponent}
      <div className="invite-popup-overlay" onClick={onClose}>
        <div className="invite-section" onClick={(e) => e.stopPropagation()}>
          <h4>Invite Students</h4>
          <input
            type="text"
            placeholder="Enter student name or ID"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="invite-input"
          />

          <div className="invite-results">
            {loading ? (
              <div className="loading-spinner"></div>
            ) : (
              <div className="invite-results">
                {filteredStudents.map((student) => (
                  <div key={student.id} className="student-card">
                    <img
                      src={student.avatar || "/images/dummy_student_1.jpg"}
                      alt="Profile"
                      className="student-avatar"
                    />
                    <span>{student.name}</span>
                    <button
                      disabled={invitedIds.includes(student.id)}
                      onClick={() => void handleInvite(student.id)}
                      className="custom-button"
                      type="button"
                    >
                      {invitedIds.includes(student.id) ? "Invited" : "Invite"}
                    </button>
                  </div>
                ))}
              </div>
            )}
            {!loading && filteredStudents.length === 0 && (
              <p className="no-results">No matching students found.</p>
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
