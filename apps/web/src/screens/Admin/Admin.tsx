import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "components/Component-elements/Header";
import TokenGuard from "components/auth/tokenGuard";
import LoadingOverlay from "components/Component-elements/loading_overlay";
import useMessage from "hooks/useMessage";
import useConfirm from "hooks/useConfirm";
import { apiFetch } from "utils/apiClient";
import type { ShowMessageFn, Student, User } from "types/models";
import "./Admin.css";

type EditableMap = Record<string, string>;

const Admin: React.FC = (): React.ReactElement => {
  const navigate = useNavigate();
  const { messageComponent, showMessage } = useMessage();
  const [confirm, ConfirmModal] = useConfirm();
  const showMsgRef = useRef<ShowMessageFn | undefined>(undefined);

  const [user, setUser] = useState<User | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [draftEmails, setDraftEmails] = useState<EditableMap>({});
  const [draftSections, setDraftSections] = useState<EditableMap>({});
  const [draftStudentNumbers, setDraftStudentNumbers] = useState<EditableMap>(
    {},
  );

  useEffect(() => {
    showMsgRef.current = showMessage;
  }, [showMessage]);

  useEffect(() => {
    let mounted = true;

    const boot = async () => {
      setLoading(true);
      try {
        const { unauthorized, data } = await apiFetch("/auth/session");
        if (!mounted) return;

        if (unauthorized || !data?.success || !data.user) {
          navigate("/login", { replace: true });
          return;
        }

        const currentUser = data.user as User;
        // Normalize user id property (some endpoints return `ID`)
        const normalizedCurrentUser = {
          ...currentUser,
          id:
            (currentUser as any).id ??
            (currentUser as any).ID ??
            (currentUser as any).Id ??
            (currentUser as any).userId ??
            (currentUser as any).user_id ??
            null,
        } as User;
        setUser(normalizedCurrentUser);

        if (currentUser.role !== "teacher" || !currentUser.isAdmin) {
          showMsgRef.current?.(
            "Only configured admins can access this page.",
            "error",
          );
          navigate("/dash", { replace: true });
          return;
        }

        const studentsResp = await apiFetch<{
          success?: boolean;
          students?: Student[];
        }>("/admin/users");

        if (!mounted) return;

        if (
          !studentsResp.data?.success ||
          !Array.isArray(studentsResp.data.students)
        ) {
          showMsgRef.current?.("Failed to load users.", "error");
          setStudents([]);
          return;
        }

        // Log the API response for debugging
        // eslint-disable-next-line no-console
        console.log("API /admin/users response:", studentsResp.data.students);

        let fetched = studentsResp.data.students;
        // Extra debug: log all IDs and roles
        // eslint-disable-next-line no-console
        console.log(
          "All user IDs and roles from API:",
          fetched.map((u) => ({
            id: u.id,
            username: u.username,
            role: u.role,
          })),
        );

        if (
          (normalizedCurrentUser as any) &&
          !fetched.some(
            (u: any) =>
              String(u.id) === String((normalizedCurrentUser as any).id),
          )
        ) {
          fetched = [normalizedCurrentUser as any, ...fetched];
        }
        // Extra debug: log after possible prepend
        // eslint-disable-next-line no-console
        console.log(
          "Final user list for display:",
          fetched.map((u) => ({
            id: u.id,
            username: u.username,
            role: u.role,
          })),
        );
        setStudents(fetched);

        const drafts: EditableMap = {};
        const emailDrafts: EditableMap = {};
        const sectionDrafts: EditableMap = {};
        fetched.forEach((s) => {
          emailDrafts[String(s.id)] = s.email ?? "";
          sectionDrafts[String(s.id)] = s.section ?? "";
          drafts[String(s.id)] = s.studentNumber ?? "";
        });
        setDraftEmails(emailDrafts);
        setDraftSections(sectionDrafts);
        setDraftStudentNumbers(drafts);
      } catch {
        if (!mounted) return;
        showMsgRef.current?.(
          "Server error while loading admin panel.",
          "error",
        );
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void boot();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  const onlineCounts = useMemo(() => {
    const acc = { online: 0, offline: 0, unknown: 0 };
    students.forEach((s) => {
      let status = s.onlineStatus;
      if (status !== "online" && status !== "offline") status = "unknown";
      if (status === "online") acc.online += 1;
      else if (status === "offline") acc.offline += 1;
      else acc.unknown += 1;
    });
    return acc;
  }, [students]);

  const updateDraft = (id: string, value: string) => {
    setDraftStudentNumbers((prev) => ({ ...prev, [id]: value }));
  };

  const updateEmailDraft = (id: string, value: string) => {
    setDraftEmails((prev) => ({ ...prev, [id]: value }));
  };

  const updateSectionDraft = (id: string, value: string) => {
    setDraftSections((prev) => ({ ...prev, [id]: value.toUpperCase() }));
  };

  const savingKey = (id: string, action: "email" | "section" | "student") =>
    `${id}:${action}`;

  const validateEmail = (email: string): boolean =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const saveStudentNumber = async (student: Student) => {
    const id = String(student.id);
    const value = (draftStudentNumbers[id] ?? "").trim();
    const key = savingKey(id, "student");

    if ((student.studentNumber ?? "") === (value || null)) {
      showMsgRef.current?.("No student number changes detected.", "info");
      return;
    }

    const ok = await confirm({
      title: "Confirm Student Number Update",
      message: `Update ${student.username || "this student"}'s student number to ${value || "(empty)"}?`,
      confirmText: "Update",
      cancelText: "Cancel",
    });
    if (!ok) return;

    setSaving((prev) => ({ ...prev, [key]: true }));
    try {
      const { data } = await apiFetch(`/admin/users/${id}/student-number`, {
        method: "PATCH",
        body: JSON.stringify({ studentNumber: value || null }),
      });

      if (!data?.success) {
        showMsgRef.current?.(
          data?.message || "Failed to save student number.",
          "error",
        );
        return;
      }

      setStudents((prev) =>
        prev.map((s) =>
          String(s.id) === id ? { ...s, studentNumber: value || null } : s,
        ),
      );
      showMsgRef.current?.("Student number updated.", "success");
    } catch {
      showMsgRef.current?.(
        "Server error while saving student number.",
        "error",
      );
    } finally {
      setSaving((prev) => ({ ...prev, [key]: false }));
    }
  };

  const saveStudentEmail = async (student: Student) => {
    const id = String(student.id);
    const value = (draftEmails[id] ?? "").trim().toLowerCase();
    const key = savingKey(id, "email");

    if (!value || !validateEmail(value)) {
      showMsgRef.current?.("Please enter a valid email address.", "error");
      return;
    }

    if ((student.email ?? "").toLowerCase() === value) {
      showMsgRef.current?.("No email changes detected.", "info");
      return;
    }

    const ok = await confirm({
      title: "Confirm Email Update",
      message: `Change ${student.username || "this student"}'s email to ${value}?`,
      confirmText: "Update",
      cancelText: "Cancel",
    });
    if (!ok) return;

    setSaving((prev) => ({ ...prev, [key]: true }));
    try {
      const { data } = await apiFetch(`/admin/users/${id}/email`, {
        method: "PATCH",
        body: JSON.stringify({ email: value }),
      });

      if (!data?.success) {
        showMsgRef.current?.(data?.message || "Failed to save email.", "error");
        return;
      }

      setStudents((prev) =>
        prev.map((s) => (String(s.id) === id ? { ...s, email: value } : s)),
      );
      showMsgRef.current?.("Student email updated.", "success");
    } catch {
      showMsgRef.current?.("Server error while saving email.", "error");
    } finally {
      setSaving((prev) => ({ ...prev, [key]: false }));
    }
  };

  const saveStudentSection = async (student: Student) => {
    const id = String(student.id);
    const value = (draftSections[id] ?? "").trim().toUpperCase();
    const key = savingKey(id, "section");

    if ((student.section ?? "") === (value || "")) {
      showMsgRef.current?.("No section changes detected.", "info");
      return;
    }

    const ok = await confirm({
      title: "Confirm Section Update",
      message: `Set ${student.username || "this student"}'s section to ${value || "(empty)"}?`,
      confirmText: "Update",
      cancelText: "Cancel",
    });
    if (!ok) return;

    setSaving((prev) => ({ ...prev, [key]: true }));
    try {
      const { data } = await apiFetch(`/admin/users/${id}/section`, {
        method: "PATCH",
        body: JSON.stringify({ section: value || null }),
      });

      if (!data?.success) {
        showMsgRef.current?.(
          data?.message || "Failed to save section.",
          "error",
        );
        return;
      }

      setStudents((prev) =>
        prev.map((s) =>
          String(s.id) === id ? { ...s, section: value || null } : s,
        ),
      );
      showMsgRef.current?.("Student section updated.", "success");
    } catch {
      showMsgRef.current?.("Server error while saving section.", "error");
    } finally {
      setSaving((prev) => ({ ...prev, [key]: false }));
    }
  };

  if (loading || !user) {
    return (
      <LoadingOverlay
        loading={true}
        text="Loading admin panel..."
        fullPage={true}
      />
    );
  }

  return (
    <TokenGuard
      redirectInfo="/login"
      onExpire={() =>
        showMsgRef.current?.("Session expired. Please sign in again.", "error")
      }
    >
      {messageComponent}
      <ConfirmModal />
      <div className="admin-root">
        <Header
          variant="authed"
          user={user}
          section={user.section ?? null}
          headerClass="app-header"
          welcomeClass="app-welcome"
          rightActions={
            <button className="pill-btn" onClick={() => navigate("/dash")}>
              Back to Dashboard
            </button>
          }
        />

        <main className="admin-main">
          <section className="admin-card admin-summary">
            <h2>User Monitoring</h2>
            <p>
              Track status and manage user email, section, and student numbers
              (where applicable) from one page. Admins, teachers, and students
              are all shown.
            </p>
            <div className="admin-stats">
              <div className="admin-stat">
                <span>Online</span>
                <strong>{onlineCounts.online}</strong>
              </div>
              <div className="admin-stat">
                <span>Offline</span>
                <strong>{onlineCounts.offline}</strong>
              </div>
              <div className="admin-stat">
                <span>Unknown</span>
                <strong>{onlineCounts.unknown}</strong>
              </div>
            </div>
          </section>

          <section className="admin-card">
            <h3>Users</h3>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Email</th>
                    <th>Section</th>
                    <th>Student Number</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => {
                    const id = String(student.id);
                    let status = student.onlineStatus;
                    if (status !== "online" && status !== "offline")
                      status = "unknown";
                    const savingEmail = !!saving[savingKey(id, "email")];
                    const savingSection = !!saving[savingKey(id, "section")];
                    const savingStudent = !!saving[savingKey(id, "student")];
                    const isTeacher = student.role === "teacher";
                    return (
                      <tr key={id}>
                        <td>{student.username || "(No username)"}</td>
                        <td>
                          <span
                            className={`status-badge ${status}`}
                            title={
                              status.charAt(0).toUpperCase() + status.slice(1)
                            }
                          >
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </span>
                        </td>
                        <td>
                          {isTeacher ? (
                            <div className="admin-input-actions">
                              <input
                                className="student-email-input"
                                placeholder="user@email.com"
                                value={draftEmails[id] ?? ""}
                                onChange={(e) =>
                                  updateEmailDraft(id, e.target.value)
                                }
                              />
                              <button
                                className="admin-save-btn"
                                disabled={savingEmail}
                                onClick={() => void saveStudentEmail(student)}
                              >
                                {savingEmail ? "Saving..." : "Save"}
                              </button>
                            </div>
                          ) : (
                            <div className="admin-input-actions">
                              <input
                                className="student-email-input"
                                placeholder="user@email.com"
                                value={draftEmails[id] ?? ""}
                                onChange={(e) =>
                                  updateEmailDraft(id, e.target.value)
                                }
                              />
                              <button
                                className="admin-save-btn"
                                disabled={savingEmail}
                                onClick={() => void saveStudentEmail(student)}
                              >
                                {savingEmail ? "Saving..." : "Save"}
                              </button>
                            </div>
                          )}
                        </td>
                        <td>
                          {isTeacher ? (
                            <span
                              className="admin-disabled-field"
                              title="Teachers do not have sections"
                            >
                              —
                            </span>
                          ) : (
                            <div className="admin-input-actions">
                              <input
                                className="student-section-input"
                                placeholder="e.g., ICT-A2"
                                value={draftSections[id] ?? ""}
                                onChange={(e) =>
                                  updateSectionDraft(id, e.target.value)
                                }
                              />
                              <button
                                className="admin-save-btn"
                                disabled={savingSection}
                                onClick={() => void saveStudentSection(student)}
                              >
                                {savingSection ? "Saving..." : "Save"}
                              </button>
                            </div>
                          )}
                        </td>
                        <td>
                          {isTeacher ? (
                            <span
                              className="admin-disabled-field"
                              title="Teachers do not have student numbers"
                            >
                              —
                            </span>
                          ) : (
                            <div className="admin-input-actions">
                              <input
                                className="student-number-input"
                                placeholder="e.g., 2026-001"
                                value={draftStudentNumbers[id] ?? ""}
                                onChange={(e) =>
                                  updateDraft(id, e.target.value)
                                }
                              />
                              <button
                                className="admin-save-btn"
                                disabled={savingStudent}
                                onClick={() => void saveStudentNumber(student)}
                              >
                                {savingStudent ? "Saving..." : "Save"}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </TokenGuard>
  );
};

export default Admin;
