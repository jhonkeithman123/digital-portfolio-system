import { useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import useMessage from "../../hooks/useMessage";
import Submissions from "./sections/Submissions";
import Quizzes from "./sections/Quizzes";
import FileUpload from "./sections/Upload";
import Header from "../../components/Component-elements/Header";
import useLogout from "../../hooks/useLogout";
import TokenGuard from "../../components/auth/tokenGuard";
import { apiFetch } from "../../utils/apiClient.js";
import "./Home.css";

const Home = () => {
  const { messageComponent, showMessage } = useMessage();
  const navigate = useNavigate();
  const [logout, LogoutModal] = useLogout();

  const didInit = useRef(false);
  const showMsgRef = useRef(showMessage);

  const [role, setRole] = useState("");
  const [user, setUser] = useState(null);
  const [classroomInfo, setClassroomInfo] = useState(null);
  const [loadingClassroom, setLoadingClassroom] = useState(false);
  const [assessmentDraft, setAssessmentDraft] = useState("");
  const [isSavingAssessment, setIsSavingAssessment] = useState(false);
  const [submissionsList, setSubmissionsList] = useState([]);
  const [activeSubmission, setActiveSubmission] = useState(null);

  const dbg = (...a) => console.debug("[Home]", ...a);

  useEffect(() => {
    showMsgRef.current = showMessage;
  }, [showMessage]);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    try {
      const cached = JSON.parse(localStorage.getItem("user") || "null");
      if (cached) {
        setUser(cached);
        setRole(cached.role || "");
      }
    } catch {}
    // validate session via cookie
    (async () => {
      const { unauthorized, data } = await apiFetch("/auth/session");
      if (unauthorized || !data?.success) {
        showMsgRef.current(
          "Missing or expired session. Please log in.",
          "error"
        );
        navigate("/login", { replace: true });
        return;
      }
      if (data.user) {
        setUser(data.user);
        setRole(data.user.role || "");
        dbg("Session user:", data.user);
        try {
          localStorage.setItem("user", JSON.stringify(data.user));
        } catch {}
      }
    })();
  }, [navigate]);

  // Fetch teacher classroom code after user loaded
  useEffect(() => {
    if (!user || user.role !== "teacher") return;

    let ignore = false;
    const loadClassroom = async () => {
      setLoadingClassroom(true);

      try {
        const { data } = await apiFetch("/classrooms/teacher");
        if (!ignore) {
          if (data?.success && data.created) {
            setClassroomInfo({
              id: data.classroomId,
              code: data.code,
              name: data.name,
              section: data.section ?? null,
            });
          } else {
            showMsgRef.current("No classroom created yet.", "info");
          }
        }
      } catch (e) {
        console.error("Error loading classroom:", e);
        if (!ignore) showMsgRef.current("Failed to load classroom", "error");
      } finally {
        if (!ignore) setLoadingClassroom(false);
      }
    };
    loadClassroom();
    return () => {
      ignore = true;
    };
  }, [user]);

  // Student classroom (uses enrolled flag)
  useEffect(() => {
    if (!user || user.role !== "student") return;
    let ignore = false;
    setLoadingClassroom(true);
    (async () => {
      try {
        const { data } = await apiFetch("/classrooms/student");
        dbg("[Home] student classroom resp:", data);
        if (!ignore) {
          // accept multiple possible response shapes: enrolled | joined | direct code
          const hasCode = !!(data?.code || data?.classroomCode);
          const allowed =
            data?.success && (data.enrolled || data.joined || hasCode);
          if (allowed) {
            setClassroomInfo({
              id: data.classroomId ?? data.id ?? null,
              code: data.code ?? data.classroomCode ?? null,
              name: data.name ?? null,
            });
            dbg("[Home] set classroomInfo for student:", {
              code: data.code ?? data.classroomCode,
            });
          } else {
            dbg("[Home] student classroom missing enrollment/code:", data);
          }
        }
      } catch (e) {
        dbg("[Home] student classroom fetch error:", e);
      } finally {
        if (!ignore) setLoadingClassroom(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [user]);

  //* Will be enabled later

  if (!user) {
    return (
      <LoadingOverlay loading={true} text="Loading profile…" fullPage={true} />
    );
  }

  const roleClass = user?.role === "teacher" ? "teacher-role" : "student-role";

  return (
    <TokenGuard
      redirectInfo="/login"
      onExpire={() =>
        showMsgRef.current("Session expired. Please sign in again.", "error")
      }
    >
      {messageComponent}

      <div className="auth-layout">
        <div className="home-container">
          <Header
            variant="authed"
            user={user}
            section={user.role === "student" ? user.section : null}
            headerClass={`home-header ${roleClass}`}
            welcomeClass={`home-welcome ${roleClass}`}
          />

          <main className="home-main">
            <FileUpload
              role={role}
              showMessage={showMessage}
              classroomCode={classroomInfo?.code}
              loadingOuter={loadingClassroom}
            />

            <Quizzes role={role} />

            <Submissions
              role={role}
              submissionsList={submissionsList}
              activeSubmission={activeSubmission}
              assessmentDraft={assessmentDraft}
              isSavingAssessment={isSavingAssessment}
              onSelectSubmission={(e) => {
                // e.target.value is usually a string; coerce for comparison
                const selected = submissionsList.find(
                  (s) => String(s.id) === String(e.target.value)
                );
                setActiveSubmission(selected);
                setAssessmentDraft(selected?.feedback || "");
              }}
              onAssessmentChange={(e) => setAssessmentDraft(e.target.value)}
              onSaveAssessment={() => {
                if (!activeSubmission) return;
                setIsSavingAssessment(true);
                // backend currently expects `feedback` field; keep shape
                apiFetch(`/submission/${activeSubmission.id}/feedback`, {
                  method: "POST",
                  body: JSON.stringify({ feedback: assessmentDraft }),
                })
                  .then(({ data }) => {
                    if (data.success) {
                      showMsgRef.current(
                        "Assessment saved successfully!",
                        "success"
                      );
                    } else {
                      showMsgRef.current("Failed to save assessment", "error");
                    }
                  })
                  .catch(() => showMsgRef.current("Server error", "error"))
                  .finally(() => setIsSavingAssessment(false));
              }}
            />

            <section className="home-card">
              <button
                className="dashboard-button"
                onClick={() => navigate("/dash")}
              >
                Back to Dashboard
              </button>
            </section>
          </main>

          <footer className="home-footer">
            <LogoutModal />
            <button className="dashboard-button" onClick={logout}>
              Logout
            </button>
            <div>@ 2025 Digital Portfolio System</div>
          </footer>
        </div>
      </div>
    </TokenGuard>
  );
};

export default Home;
