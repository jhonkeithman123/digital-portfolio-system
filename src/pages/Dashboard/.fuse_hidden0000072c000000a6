import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "utils/apiClient";
import type {
  User,
  ShowcaseItem,
  Student,
  ClassroomInfo,
  ShowMessageFn,
} from "types/models";
import useTamperGuard from "security/useTamperGuard";
import useMessage from "hooks/useMessage";
import useLogout from "hooks/useLogout";
import useConfirm from "hooks/useConfirm";
import BurgerMenu from "components/Component-elements/burger_menu";
import StudentInvite from "components/StudentInvite";
import Header from "components/Component-elements/Header";
import TokenGuard from "components/auth/tokenGuard";
import InputField from "components/Component-elements/InputField";
import NotificationBell from "components/Component-elements/NotificationBell";
import LoadingOverlay from "components/Component-elements/loading_overlay";
import useLoadingState from "hooks/useLoading";
import "./Dashboard.css";
import {
  setTabAuth,
  broadcastAuthState,
  getGlobalAuthState,
} from "utils/tabAuth";

const roleColors = {
  student: "#007bff",
  teacher: "#dc3545",
};

const Dashboard: React.FC = (): React.ReactElement => {
  const navigate = useNavigate();
  const [logout, LogoutModal] = useLogout();
  const [confirm, ConfirmModal] = useConfirm();
  const { messageComponent, showMessage } = useMessage();

  // For safegurading the useEffects to prevent infinite loops
  const didInit = useRef<boolean>(false);
  const enrollmentChecked = useRef<boolean>(false);
  const teacherChecked = useRef<boolean>(false);
  const studentsLoadedRef = useRef<boolean>(false);

  const [user, setUser] = useState<User | null>(null);
  const [hasActivity, setHasActivity] = useState<boolean>(false);
  const [checkingEnrollment, setCheckingEnrollment] = useState<boolean>(true);
  const [classroomInfo, setClassroomInfo] = useState<ClassroomInfo | null>(
    null,
  );
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [inviteOpen, setInviteOpen] = useState<boolean>(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [classroomSectionDraft, setClassroomSectionDraft] =
    useState<string>("");

  const [showSections, setShowSections] = useState<boolean>(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState<boolean>(false);
  const [editSections, setEditSections] = useState<Record<string, string>>({}); // id -> string
  const [mySection, setMySection] = useState<string | null>(null); // for students
  const [mySectionDraft, setMySectionDraft] = useState<string>(""); // for students
  const [savingMySection, setSavingMySection] = useState<boolean>(false); // for students

  const [showcaseItems, setShowcaseItems] = useState<ShowcaseItem[]>([]); // Ignore: Unused variable
  const { loading: loadingShowcase } = useLoadingState(false);

  // Make showMessage stable for effects
  const showMsgRef = useRef<ShowMessageFn | undefined>(undefined);
  useEffect(() => {
    showMsgRef.current = showMessage;
  }, [showMessage]);

  // // post a public comment on a showcased item
  // const postShowcaseComment = async (
  //   showcaseId: string,
  //   comment: string
  // ): Promise<void> => {
  //   if (!comment?.trim()) return;
  //   try {
  //     const { data } = await apiFetch(`/showcase/${showcaseId}/comments`, {
  //       method: "POST",
  //       body: JSON.stringify({ comment }),
  //     });

  //     if (data?.success && data.comment) {
  //       setShowcaseItems((prev: ShowcaseItem[]) =>
  //         prev.map((it) =>
  //           it.id === showcaseId
  //             ? { ...it, comments: [data.comment, ...(it.comments || [])] }
  //             : it
  //         )
  //       );
  //     } else {
  //       showMsgRef.current?.("Failed to post comment", "error");
  //     }
  //   } catch {
  //     showMsgRef.current?.("Server error", "error");
  //   }
  // };

  //* post a reply to a comment on a showcased item (Will be enabled in the future)
  // const postShowcaseReply = async (
  //   showcaseId: string,
  //   commentId: string,
  //   reply: string
  // ): Promise<void> => {
  //   if (!reply?.trim()) return;
  //   try {
  //     const { data } = await apiFetch(
  //       `/showcase/${showcaseId}/comments/${commentId}/replies`,
  //       {
  //         method: "POST",
  //         body: JSON.stringify({ reply }),
  //       }
  //     );

  //     if (data?.success && data.reply) {
  //       setShowcaseItems((prev: ShowcaseItem[]) =>
  //         prev.map((it) =>
  //           it.id === showcaseId
  //             ? {
  //                 ...it,
  //                 comments: (it.comments || []).map((c) =>
  //                   c.id === commentId
  //                     ? { ...c, replies: [...(c.replies || []), data.reply] }
  //                     : c
  //                 ),
  //               }
  //             : it
  //         )
  //       );
  //     } else {
  //       showMsgRef.current?.("Failed to post reply", "error");
  //     }
  //   } catch {
  //     showMsgRef.current?.("Server error", "error");
  //   }
  // ;

  // Showcase real-time data (disabled for now)
  // const {
  //   data: showCaseData,
  //   refresh: refreshShowcase,
  //   isPolling: isPollingShowcase,
  // } = useRealTimeData({
  //   fetchFn: async () => {
  //     const { data } = await apiFetch("/showcase");
  //     if (data?.success && Array.isArray(data.items)) {
  //       return data.items as ShowcaseItem[];
  //     }
  //     return [];
  //   },
  //   interval: 5000, // Poll every 5 seconds
  //   enabled: !!user, // Only poll when user is loaded
  //   onChange: (items) => {
  //     setShowcaseItems(items);
  //   },
  //   onError: (error) => {
  //     console.error("Showcase polling error:", error);
  //   },
  // });

  // Real-time quizzes for students

  useTamperGuard(user?.role, showMsgRef.current);

  //* Init effect
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    (async () => {
      // Clear the justLoggedIn marker once we reach dashboard
      try {
        sessionStorage.removeItem("justLoggedIn");
      } catch {
        // ignore
      }

      // Check global auth state first
      const globalAuth = getGlobalAuthState();

      const cachedUser = localStorage.getItem("user");
      if (cachedUser) {
        try {
          const parsed = JSON.parse(cachedUser) as User;
          setUser(parsed);
          if (parsed.section) setMySection(parsed.section);
          const accent =
            roleColors[parsed.role as keyof typeof roleColors] ?? "#6c757d";
          document.documentElement.style.setProperty("--accent-color", accent);

          // If user exists in cache and global auth is valid, set tab auth immediately
          if (globalAuth?.authenticated && globalAuth.userId === parsed.id) {
            setTabAuth();
            console.log("[Dashboard] restored tab auth from global state");
          }
        } catch {
          localStorage.removeItem("user");
        }
      }

      const { unauthorized, data } = await apiFetch("/auth/session");
      if (unauthorized || !data?.success) {
        showMsgRef.current?.("Session invalid", "error");
        localStorage.removeItem("user");
        navigate("/login", { replace: true });
        setCheckingEnrollment(false);
        return;
      }

      // If server returns canonical user, override cache
      if (data.user) {
        setUser(data.user as User);
        localStorage.setItem("user", JSON.stringify(data.user));
        if ((data.user as User).section)
          setMySection((data.user as User).section!);

        // Broadcast authenticated state to all tabs
        setTabAuth();
        broadcastAuthState(true, (data.user as User).id);
      }
    })();
  }, [navigate]);

  //* Keep mySection synced if user updates later
  useEffect(() => {
    if (user?.role === "student" && user.section && !mySection) {
      setMySection(user.section);
    }
  }, [user, mySection]);

  // // load showcase when user is available
  // useEffect(() => {
  //   if (!user) return;
  //   loadShowcase();
  // }, [user, loadShowcase]);

  //* Teacher: load students
  useEffect(() => {
    if (user?.role !== "teacher") return;
    if (!showSections) {
      studentsLoadedRef.current = false;
      return;
    }

    if (studentsLoadedRef.current) return;
    studentsLoadedRef.current = true;
    setLoadingStudents(true);

    const abort = new AbortController();
    apiFetch("/users/students", { signal: abort.signal })
      .then(({ data }) => {
        if (data?.success && Array.isArray(data.students)) {
          const fetched = data.students as Student[];
          setStudents(fetched);
          const draft: Record<string, string> = {};
          data.students.forEach((s: Record<string, string>) => {
            if (!s.section) draft[s.id] = "";
          });
          setEditSections(draft);
        } else {
          showMsgRef.current?.("Failed to load students", "error");
        }
      })
      .catch((e) => {
        if (e.name !== "AbortError")
          showMsgRef.current?.("Server error while loading students", "error");
      })
      .finally(() => setLoadingStudents(false));

    return () => abort.abort();
  }, [user?.role, showSections]);

  const validateSectionFormat = (sectionInput: string): boolean => {
    const trimmed = sectionInput.trim().toUpperCase();
    // Pattern: STRAND-LETTER+NUMBER
    const sectionPattern = /^[A-Z]+-[A-Z]\d+$/;
    return sectionPattern.test(trimmed);
  };

  const saveSection = async (id: string): Promise<void> => {
    const value = (editSections[id] ?? "").trim().toUpperCase();
    if (!value) return;

    if (!validateSectionFormat(value)) {
      showMsgRef.current?.(
        "Section must follow format: STRAND-LETTER+NUMBER (e.g., ICT-A2, STEM-B1)",
        "error",
      );
      return;
    }

    try {
      const { data } = await apiFetch(`/users/${id}/section`, {
        method: "PATCH",
        body: JSON.stringify({ section: value }),
      });
      if (!data?.success) throw new Error();
      setStudents((prev: Student[]) =>
        prev.map((s) => (s.id === id ? { ...s, section: value } : s)),
      );
      setEditSections((prev) => ({ ...prev, [id]: "" }));
      showMsgRef.current?.("Section saved", "success");
    } catch {
      showMsgRef.current?.("Failed to save section", "error");
    }
  };

  //* Enrollment effect
  useEffect(() => {
    if (!user) return;

    if (user.role === "student") {
      if (enrollmentChecked.current) return;
      enrollmentChecked.current = true;

      apiFetch("/classrooms/student")
        .then(({ data }) => {
          if (!data?.success) {
            showMsgRef.current?.("Failed to check enrollment", "error");
          } else if (!data.enrolled || !data.classroomId) {
            showMsgRef.current?.("Not enrolled. Join a classroom.", "info");
            navigate("/join");
          } else {
            setHasActivity(true);
            setClassroomInfo({
              name: data.name,
              code: data.code,
              id: data.classroomId,
            });
          }
        })
        .catch(() =>
          showMsgRef.current?.(
            "Server error while checking classroom",
            "error",
          ),
        )
        .finally(() => setCheckingEnrollment(false));
    } else if (user.role === "teacher") {
      if (teacherChecked.current) return;
      teacherChecked.current = true;

      apiFetch("/classrooms/teacher")
        .then(({ data }) => {
          if (!data?.success) {
            showMsgRef.current?.("Failed to check classroom", "error");
          } else if (!(data as any).created) {
            navigate("/create");
          } else {
            // Cast to a known shape so TypeScript recognizes `section`
            const info = data as {
              name?: string;
              code?: string;
              section?: string | null;
            };

            setHasActivity(true);
            setClassroomInfo({
              name: info.name,
              code: info.code,
              section: info.section ?? null,
            });
          }
        })
        .catch(() =>
          showMsgRef.current?.(
            "Server error while checking classroom",
            "error",
          ),
        )
        .finally(() => setCheckingEnrollment(false));
    }
  }, [user, navigate]);

  const saveMySection = async (): Promise<void> => {
    const value = mySectionDraft.trim().toUpperCase();
    if (!value) return;

    if (!validateSectionFormat(value)) {
      showMsgRef.current?.(
        "Section must follow format: STRAND-LETTER+NUMBER (e.g., ICT-A2, STEM-B1)",
        "error",
      );
      return;
    }

    setSavingMySection(true);
    try {
      const { data } = await apiFetch("/auth/me/section", {
        method: "PATCH",
        body: JSON.stringify({ section: value }),
      });
      if (data?.success) {
        setMySection(value);
        const stored = localStorage.getItem("user");
        try {
          const parsed = stored ? JSON.parse(stored) : {};
          const merged = { ...parsed, section: value };
          localStorage.setItem("user", JSON.stringify(merged));
          setUser((u) => (u ? { ...u, section: value } : null));
        } catch {
          //* Ignore
        }
        showMsgRef.current?.("Section saved", "success");
      } else {
        showMsgRef.current?.(data?.message || "Could not set section", "error");
      }
    } catch {
      showMsgRef.current?.("Server error", "error");
    } finally {
      setSavingMySection(false);
    }
  };

  const saveClassroomSection = async (): Promise<void> => {
    const value = classroomSectionDraft.trim().toUpperCase();
    const code = classroomInfo?.code || null;

    if (!value) return;

    if (!validateSectionFormat(value)) {
      showMsgRef.current?.(
        "Section must follow format: STRAND-LETTER+NUMBER (e.g., ICT-A2, STEM-B1)",
        "error",
      );
      return;
    }

    try {
      const { data } = await apiFetch("/classrooms/teacher/section", {
        method: "PATCH",
        body: JSON.stringify({ section: value, code }),
      });
      if (!data?.success) throw new Error();
      setClassroomInfo((c) => ({ ...(c || {}), section: value }));
      setClassroomSectionDraft("");
      showMsgRef.current?.("Classroom section set", "success");
    } catch (e) {
      console.log("Failed to set classroom section:", e);
      showMsgRef.current?.("Failed to set classroom section", "error");
    }
  };

  const clearClassroomSection = async (): Promise<void> => {
    const ok = await confirm({
      title: "Clear Section",
      message: "This will clear the section of the classroom",
      confirmText: "Clear",
      cancelText: "Cancel",
    });
    if (!ok) return;

    try {
      const code = classroomInfo?.code || null;
      const { data } = await apiFetch<{
        success?: boolean;
        message?: string | null;
        error?: unknown | null;
        section?: string | null;
      }>("/classrooms/teacher/section", {
        method: "PATCH",
        body: JSON.stringify({ section: null, code }),
      });
      if (!data?.success) throw new Error();
      setClassroomInfo((c) => ({
        ...(c || {}),
        section: data.section ?? null,
      }));
      showMsgRef.current?.("Classroom section cleared", "success");
    } catch (err: unknown) {
      console.error("Failed to clear classroom:", err);
      // derive a safe error message from unknown
      let errMsg = "Failed to clear classroom section";
      if (err instanceof Error && err.message) {
        errMsg = err.message;
      } else if (err && typeof err === "object") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const maybe = err as any;
        if (typeof maybe.error === "string" && maybe.error.trim()) {
          errMsg = maybe.error;
        } else if (typeof maybe.message === "string" && maybe.message.trim()) {
          errMsg = maybe.message;
        }
      }
      showMsgRef.current?.(errMsg, "error");
    }
  };

  const onExpire = useCallback(() => {
    showMsgRef.current?.("Session expired. Please sign in again.", "error");
  }, []);

  if (!user || checkingEnrollment) {
    return (
      <LoadingOverlay
        loading={true}
        text="Loading dashboard..."
        fullPage={true}
      />
    );
  }

  // Auto-uppercase section inputs
  const handleSectionInputChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    studentId?: string,
  ): void => {
    const value = e.target.value.toUpperCase();
    if (studentId) {
      setEditSections((prev) => ({ ...prev, [studentId]: value }));
    }
  };

  const roleClass = user.role === "teacher" ? "teacher-role" : "student-role";

  const content = (
    <>
      {inviteOpen && (
        <StudentInvite
          classroomCode={classroomInfo?.code ?? ""}
          onClose={() => setInviteOpen(false)}
          onInvite={(studentId) =>
            showMsgRef.current?.(`Invited student ID ${studentId}`, "info")
          }
        />
      )}

      {messageComponent}

      <BurgerMenu
        openMenu={menuOpen}
        toggleMenu={setMenuOpen}
        classroomInfo={classroomInfo}
        showMessage={showMessage}
      />

      <ConfirmModal />

      <div className="dashboard">
        <Header
          variant="authed"
          user={user}
          section={
            user.role === "teacher"
              ? classroomInfo?.section
              : user.section || mySection
          }
          headerClass={`dashboard-header ${roleClass}`}
          welcomeClass={`dashboard-welcome ${roleClass}`}
          rightActions={
            <>
              <NotificationBell
                unreadCount={unreadCount}
                setUnreadCount={setUnreadCount}
              />

              {user.role === "teacher" && (
                <button
                  className={`pill-btn ${showSections ? "active" : ""}`}
                  aria-pressed={showSections}
                  onClick={() => setShowSections((s) => !s)}
                  title="Manage student sections"
                >
                  {showSections ? "Hide Student Sections" : "Manage Sections"}
                </button>
              )}
            </>
          }
        />
        <main className="dashboard-main">
          {/* Student self-serve section (only when null/empty) */}
          {user.role === "student" && !user.section && !mySection && (
            <section className="dashboard-card">
              <h2>Set Your Section</h2>
              <p>
                Please enter your section once. You cannot change it later here.
              </p>
              <div style={{ maxWidth: 520 }}>
                <InputField
                  size="auto"
                  label="Section"
                  name="my-section"
                  placeholder="e.g., ICT-A2, STEM-B1, ABM-C3"
                  value={mySectionDraft}
                  onChange={(e) =>
                    setMySectionDraft(e.target.value.toUpperCase())
                  }
                  onEnter={() => !savingMySection && saveMySection()}
                />
              </div>
              <button
                className="dashboard-button"
                onClick={saveMySection}
                disabled={savingMySection || !mySectionDraft.trim()}
                style={{ marginTop: 8 }}
              >
                {savingMySection ? "Saving…" : "Save Section"}
              </button>
            </section>
          )}
          {user.role === "teacher" && showSections && (
            <section className="dashboard-card section-manager">
              <h2>Student Sections</h2>
              <p>
                Only students without a section are editable. Others are grayed
                out.
              </p>

              <div className="classroom-section-row">
                <strong>Advisory Classroom Section:</strong>
                {classroomInfo?.section ? (
                  <>
                    <span className="fixed-value">{classroomInfo.section}</span>
                    <button
                      className="dashboard-button btn-small btn-danger"
                      onClick={clearClassroomSection}
                    >
                      Clear
                    </button>
                  </>
                ) : (
                  <>
                    <input
                      className="section-input"
                      placeholder="Set classroom section"
                      value={classroomSectionDraft}
                      onChange={(e) => setClassroomSectionDraft(e.target.value)}
                    />
                    <button
                      className="dashboard-button btn-small"
                      disabled={!classroomSectionDraft.trim()}
                      onClick={saveClassroomSection}
                    >
                      Save
                    </button>
                  </>
                )}
              </div>

              {loadingStudents ? (
                <p>Loading students…</p>
              ) : students.length === 0 ? (
                <p>No students found.</p>
              ) : (
                <div className="section-list">
                  {students.map((s) => {
                    const hasSection = !!s.section;
                    return (
                      <div
                        key={s.id}
                        className={`section-row ${hasSection ? "muted" : ""}`}
                      >
                        <div className="identity">
                          <div>
                            <strong>{s.username}</strong>
                          </div>
                          <div style={{ fontSize: 12, color: "#64748b" }}>
                            {s.email}
                          </div>
                        </div>
                        <input
                          className="section-input"
                          placeholder={
                            hasSection
                              ? (s.section ?? "")
                              : "Enter section (e.g. ICT-A2)"
                          }
                          value={
                            hasSection
                              ? (s.section ?? "")
                              : (editSections[s.id] ?? "")
                          }
                          onChange={(e) => handleSectionInputChange(e, s.id)}
                          disabled={hasSection}
                        />
                        <button
                          className="dashboard-button btn-small"
                          onClick={() => saveSection(s.id)}
                          disabled={
                            hasSection || !(editSections[s.id] || "").trim()
                          }
                        >
                          Save
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}
          <section className="dashboard-card">
            <h2>Recent Activity</h2>
            <p>No Submission yet. Start by uploading your work!</p>

            {(user.role === "teacher" ||
              (user.role === "student" && hasActivity)) && (
              <button
                className="dashboard-button"
                onClick={() => navigate("/home")}
                style={{ marginTop: "1rem" }}
              >
                Go to Upload Page
              </button>
            )}
          </section>

          <section className="dashboard-card">
            <h2>Showcase</h2>
            {loadingShowcase ? (
              <div className="showcase-loading">
                <LoadingOverlay
                  loading={true}
                  text="Loading showcase…"
                  fullPage={false}
                />
              </div>
            ) : showcaseItems.length === 0 ? (
              <div>
                <p>No showcased submissions yet.</p>
                <p className="muted" style={{ fontSize: 13 }}>
                  Both students and teachers can mark submissions as showcased.
                </p>
              </div>
            ) : (
              <div className="showcase-grid">
                {showcaseItems.map((s) => (
                  <div key={s.id} className="showcase-item-card">
                    <div className="showcase-meta-row">
                      <strong>{s.studentName}</strong>
                      <span className="showcase-meta-time">
                        {s.showcasedAt
                          ? new Date(s.showcasedAt).toLocaleString()
                          : ""}
                      </span>
                    </div>

                    <div className="showcase-info">
                      <div className="showcase-info-meta">
                        Score: {s.score ?? "—"} ·{" "}
                        {s.activityName ?? "Submission"}
                      </div>
                      <a
                        className="showcase-view-link"
                        href={s.fileUrl ?? ""}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View submission
                      </a>
                    </div>

                    <div className="showcase-comments">
                      {(s.comments || []).map((c) => (
                        <div key={c.id} className="showcase-comment">
                          <div className="showcase-comment-meta">
                            <strong>{c.username ?? "User"}</strong>
                            <span className="showcase-comment-time">
                              {c.created_at
                                ? new Date(c.created_at).toLocaleString()
                                : ""}
                            </span>
                          </div>
                          <div className="showcase-comment-body">
                            {c.comment}
                          </div>

                          {(c.replies || []).length > 0 && (
                            <div className="showcase-replies">
                              {(c.replies || []).map((r) => (
                                <div key={r.id} className="showcase-reply">
                                  <strong>{r.username ?? "User"}</strong>:{" "}
                                  {r.reply}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}

                      {/* disabled for now */}

                      {/* <div className="showcase-comment-input-row">
                        <input
                          className="showcase-comment-input"
                          placeholder="Add a public comment..."
                          onKeyDown={async (e) => {
                            if (e.key !== "Enter") return;
                            const v = e.currentTarget.value.trim();
                            if (!v) return;
                            await postShowcaseComment(s.id, v);
                            e.currentTarget.value = "";
                          }}
                        />
                        <button
                          className="dashboard-button"
                          onClick={async (
                            e: React.MouseEvent<HTMLButtonElement>
                          ): Promise<void> => {
                            // Find the associated input in the same row and read its value
                            const inputEl =
                              e.currentTarget.parentElement?.querySelector(
                                ".showcase-comment-input"
                              ) as HTMLInputElement | null;
                            const v = inputEl?.value.trim() ?? "";
                            if (!v) return;
                            await postShowcaseComment(s.id, v);
                            if (inputEl) inputEl.value = "";
                          }}
                        >
                          Post
                        </button>
                      </div> */}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>

        <footer className="dashboard-footer">
          <div className="footer-button-container">
            {user.role === "teacher" && classroomInfo && (
              <button
                className="dashboard-button"
                onClick={() => setInviteOpen(true)}
                style={{ marginBottom: "1rem" }}
              >
                Invite Students
              </button>
            )}

            <LogoutModal />
            <button className="dashboard-button" onClick={() => logout()}>
              Logout
            </button>
          </div>
          <div>@ 2025 Digital Portfolio System</div>
        </footer>
      </div>
    </>
  );

  return (
    <TokenGuard
      redirectInfo="/login"
      onExpire={onExpire}
      loadingFallback={
        <LoadingOverlay
          loading={true}
          text="Validating session..."
          fullPage={true}
        />
      }
    >
      {content}
    </TokenGuard>
  );
};

export default Dashboard;
