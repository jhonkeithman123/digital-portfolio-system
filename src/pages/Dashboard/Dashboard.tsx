import { useNavigate } from "react-router-dom";
import { useEffect, useState, useRef, useCallback } from "react";
import { apiFetch } from "../../utils/apiClient";
import useTamperGuard from "../../security/useTamperGuard";
import useMessage from "../../hooks/useMessage";
import useLogout from "../../hooks/useLogout";
import useConfirm from "../../hooks/useConfirm";
import BurgerMenu from "../../components/Component-elements/burger_menu";
import StudentInvite from "../../components/StudentInvite";
import Header from "../../components/Component-elements/Header";
import TokenGuard from "../../components/auth/tokenGuard";
import InputField from "../../components/Component-elements/InputField";
import NotificationBell from "../../components/Component-elements/NotificationBell";
import LoadingOverlay from "../../components/Component-elements/loading_overlay";
import useLoadingState from "../../hooks/useLoading";
import "./Dashboard.css";

const roleColors = {
  student: "#007bff",
  teacher: "#dc3545",
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [logout, LogoutModal] = useLogout();
  const [confirm, ConfirmModal] = useConfirm();
  const { messageComponent, showMessage } = useMessage();

  // For safegurading the useEffects to prevent infinite loops
  const didInit = useRef(false);
  const enrollmentChecked = useRef(false);
  const quizzesLoadChecked = useRef(false);
  const teacherChecked = useRef(false);
  const studentsLoadedRef = useRef(false);

  const [user, setUser] = useState(null);
  const [hasActivity, setHasActivity] = useState(false);
  const [checkingEnrollment, setCheckingEnrollment] = useState(true);
  const [classroomInfo, setClassroomInfo] = useState(null);
  const [studentQuizzes, setStudentQuizzes] = useState([]);
  const [loadingQuizzes, setLoadingQuizzes] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [classroomSectionDraft, setClassroomSectionDraft] = useState("");

  const [showSections, setShowSections] = useState(false);
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [editSections, setEditSections] = useState({}); // id -> string
  const [mySection, setMySection] = useState(null); // for students
  const [mySectionDraft, setMySectionDraft] = useState(""); // for students
  const [savingMySection, setSavingMySection] = useState(false); // for students

  const [showcaseItems, setShowcaseItems] = useState([]);
  const { loading: loadingShowcase, wrap: wrapShowcase } =
    useLoadingState(false);

  // Make showMessage stable for effects
  const showMsgRef = useRef(showMessage);
  useEffect(() => {
    showMsgRef.current = showMessage;
  }, [showMessage]);

  const loadShowcase = useCallback(
    () =>
      wrapShowcase(async () => {
        try {
          const { data } = await apiFetch("/showcase");
          if (data?.success && Array.isArray(data.items)) {
            setShowcaseItems(data.items);
          } else {
            setShowcaseItems(data.items ?? []);
          }
        } catch (e) {
          // use the direct showMessage (stable ref handled elsewhere)
          showMessage.current?.("Failed to load showcase", "error");
        }
      }),
    [wrapShowcase]
  );

  // post a public comment on a showcased item
  const postShowcaseComment = async (showcaseId, comment) => {
    if (!comment?.trim()) return;
    try {
      const { data } = await apiFetch(`/showcase/${showcaseId}/comments`, {
        method: "POST",
        body: JSON.stringify({ comment }),
      });
      if (data?.success && data.comment) {
        setShowcaseItems((prev) =>
          prev.map((it) =>
            it.id === showcaseId
              ? { ...it, comments: [data.comment, ...(it.comments || [])] }
              : it
          )
        );
      } else {
        showMsgRef.current("Failed to post comment", "error");
      }
    } catch {
      showMsgRef.current("Server error", "error");
    }
  };

  // post a reply to a comment on a showcased item
  const postShowcaseReply = async (showcaseId, commentId, reply) => {
    if (!reply?.trim()) return;
    try {
      const { data } = await apiFetch(
        `/showcase/${showcaseId}/comments/${commentId}/replies`,
        {
          method: "POST",
          body: JSON.stringify({ reply }),
        }
      );
      if (data?.success && data.reply) {
        setShowcaseItems((prev) =>
          prev.map((it) =>
            it.id === showcaseId
              ? {
                  ...it,
                  comments: (it.comments || []).map((c) =>
                    c.id === commentId
                      ? { ...c, replies: [...(c.replies || []), data.reply] }
                      : c
                  ),
                }
              : it
          )
        );
      } else {
        showMsgRef.current("Failed to post reply", "error");
      }
    } catch {
      showMsgRef.current("Server error", "error");
    }
  };

  useTamperGuard(user?.role, showMsgRef.current);

  //* Init effect
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    (async () => {
      const cachedUser = localStorage.getItem("user");
      if (cachedUser) {
        try {
          const parsed = JSON.parse(cachedUser);
          setUser(parsed);
          if (parsed.section) setMySection(parsed.section);
          document.documentElement.style.setProperty(
            "--accent-color",
            roleColors[parsed.role] || "#6c757d"
          );
        } catch {
          localStorage.removeItem("user");
        }
      }

      const { unauthorized, data } = await apiFetch("/auth/session");
      if (unauthorized || !data?.success) {
        showMsgRef.current("Session invalid", "error");
        localStorage.removeItem("user");
        navigate("/login", { replace: true });
        setCheckingEnrollment(false);
        return;
      }

      // If server returns canonical user, override cache
      if (data.user) {
        setUser(data.user);
        localStorage.setItem("user", JSON.stringify(data.user));
        if (data.user.section) setMySection(data.user.section);
      }

      // Allow enrollment effect to proceed
    })();
  }, [navigate]);

  //* Keep mySection synced if user updates later
  useEffect(() => {
    if (user?.role === "student" && user.section && !mySection) {
      setMySection(user.section);
    }
  }, [user, mySection]);

  // load showcase when user is available
  useEffect(() => {
    if (!user) return;
    loadShowcase();
  }, [user, loadShowcase]);

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
          setStudents(data.students);
          const draft = {};
          data.students.forEach((s) => {
            if (!s.section) draft[s.id] = "";
          });
          setEditSections(draft);
        } else {
          showMsgRef.current("Failed to load students", "error");
        }
      })
      .catch((e) => {
        if (e.name !== "AbortError")
          showMsgRef.current("Server error while loading students", "error");
      })
      .finally(() => setLoadingStudents(false));

    return () => abort.abort();
  }, [user?.role, showSections]);

  const saveSection = async (id) => {
    const value = (editSections[id] ?? "").trim();
    if (!value) return;
    try {
      const { data } = await apiFetch(`/users/${id}/section`, {
        method: "PATCH",
        body: JSON.stringify({ section: value }),
      });
      if (!data?.success) throw new Error();
      setStudents((prev) =>
        prev.map((s) => (s.id === id ? { ...s, section: value } : s))
      );
      setEditSections((prev) => ({ ...prev, [id]: "" }));
      showMsgRef.current("Section saved", "success");
    } catch {
      showMsgRef.current("Failed to save section", "error");
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
            showMsgRef.current("Failed to check enrollment", "error");
          } else if (!data.enrolled || !data.classroomId) {
            showMsgRef.current("Not enrolled. Join a classroom.", "info");
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
          showMsgRef.current("Server error while checking classroom", "error")
        )
        .finally(() => setCheckingEnrollment(false));
    } else if (user.role === "teacher") {
      if (teacherChecked.current) return;
      teacherChecked.current = true;

      apiFetch("/classrooms/teacher")
        .then(({ data }) => {
          if (!data?.success) {
            showMsgRef.current("Failed to check classroom", "error");
          } else if (!data.created) {
            navigate("/create");
          } else {
            setHasActivity(true);
            setClassroomInfo({
              name: data.name,
              code: data.code,
              section: data.section ?? null,
            });
          }
        })
        .catch(() =>
          showMsgRef.current("Server error while checking classroom", "error")
        )
        .finally(() => setCheckingEnrollment(false));
    }
  }, [user, navigate]);

  const saveMySection = async () => {
    const value = mySectionDraft.trim();
    if (!value) return;
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
          setUser((u) => ({ ...(u || {}), section: value }));
        } catch {}
        showMsgRef.current("Section saved", "success");
      } else {
        showMsgRef.current(data?.message || "Could not set section", "error");
      }
    } catch {
      showMsgRef.current("Server error", "error");
    } finally {
      setSavingMySection(false);
    }
  };

  const saveClassroomSection = async () => {
    const value = classroomSectionDraft.trim();
    const code = classroomInfo?.code || null;

    if (!value) return;
    try {
      const { data } = await apiFetch("/classrooms/teacher/section", {
        method: "PATCH",
        body: JSON.stringify({ section: value, code }),
      });
      if (!data?.success) throw new Error();
      setClassroomInfo((c) => ({ ...(c || {}), section: value }));
      setClassroomSectionDraft("");
      showMsgRef.current("Classroom section set", "success");
    } catch (e) {
      console.log("Failed to set classroom section:", e);
      showMsgRef.current("Failed to set classroom section", "error");
    }
  };

  const clearClassroomSection = async () => {
    const ok = await confirm({
      title: "Clear Section",
      message: "This will clear the section of the classroom",
      confirmText: "Clear",
      cancelText: "Cancel",
    });
    if (!ok) return;

    try {
      const code = classroomInfo?.code || null;
      const { data } = await apiFetch("/classrooms/teacher/section", {
        method: "PATCH",
        body: JSON.stringify({ section: null, code }),
      });
      if (!data?.success) throw new Error();
      setClassroomInfo((c) => ({
        ...(c || {}),
        section: data.section ?? null,
      }));
      showMsgRef.current("Classroom section cleared", "success");
    } catch (err) {
      console.error("Failed to clear classroom:", err);
      showMsgRef.current(
        err?.error || "Failed to clear classroom section",
        "error"
      );
    }
  };

  //* Quizzes effect
  useEffect(() => {
    if (user?.role !== "student" || !classroomInfo?.code) return;
    if (quizzesLoadChecked.current) return;
    quizzesLoadChecked.current = true;

    setLoadingQuizzes(true);
    apiFetch(`/quizzes/${classroomInfo.code}/quizzes`)
      .then(({ data }) => {
        if (Array.isArray(data?.quizzes)) setStudentQuizzes(data.quizzes);
      })
      .catch((err) => console.error("Error loading quizzes:", err))
      .finally(() => setLoadingQuizzes(false));
  }, [user?.role, classroomInfo?.code]);

  function openQuiz(q) {
    if (!classroomInfo?.code) return;
    navigate(`/quizzes/${classroomInfo.code}/quizzes/${q.id}`);
  }

  //* History pop state check (revalidate session)
  useEffect(() => {
    const handlePopState = async () => {
      const { unauthorized, data } = await apiFetch("/auth/session");
      if (unauthorized || !data?.success) {
        showMsgRef.current("Unauthorized access", "error");
        setTimeout(() => navigate("/login"), 1200);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [navigate]);

  useEffect(() => {
    if (user?.role === "student") setHasActivity(true);
  }, [user]);

  const onExpire = useCallback(() => {
    showMsgRef.current("Session expired. Please sign in again.", "error");
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

  const roleClass = user.role === "teacher" ? "teacher-role" : "student-role";

  const content = (
    <>
      {inviteOpen && (
        <StudentInvite
          classroomCode={classroomInfo.code}
          onClose={() => setInviteOpen(false)}
          onInvite={(studentId) =>
            showMsgRef.current(`Invited student ID ${studentId}`, "info")
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
                  placeholder="e.g., 7-A, STEM-2"
                  value={mySectionDraft}
                  onChange={(e) => setMySectionDraft(e.target.value)}
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
                          placeholder={hasSection ? s.section : "Enter section"}
                          value={
                            hasSection ? s.section : editSections[s.id] ?? ""
                          }
                          onChange={(e) =>
                            setEditSections((prev) => ({
                              ...prev,
                              [s.id]: e.target.value,
                            }))
                          }
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

          {user?.role === "student" && (
            <section className="dashboard-card">
              <h2>Available Quizzes</h2>
              {loadingQuizzes ? (
                <p>Loading quizzes…</p>
              ) : studentQuizzes.length ? (
                <ul>
                  {studentQuizzes.map((q) => (
                    <li key={q.id} style={{ marginBottom: 8 }}>
                      <strong>{q.title}</strong>{" "}
                      <button
                        className="dashboard-button"
                        style={{ marginLeft: 8 }}
                        onClick={() => openQuiz(q)}
                      >
                        Start
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No quizzes available yet.</p>
              )}
            </section>
          )}

          <section className="dashboard-card">
            <h2>Showcase</h2>
            {loadingShowcase ? (
              <div className="showcase-loading">
                <LoadingOverlay loading={true} text="Loading showcase…" />
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
                        href={s.fileUrl}
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

                      <div className="showcase-comment-input-row">
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
                          onClick={async (ev) => {
                            const input = ev.currentTarget.previousSibling;
                            const v = input?.value?.trim();
                            if (!v) return;
                            await postShowcaseComment(s.id, v);
                            input.value = "";
                          }}
                        >
                          Post
                        </button>
                      </div>
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
