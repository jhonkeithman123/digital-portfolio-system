import React, {
  useEffect,
  useRef,
  useCallback,
  useState,
  useMemo,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiFetch } from "../../utils/apiClient";
import useMessage from "../../hooks/useMessage";
import Header from "../Component-elements/Header";
import useLoadingState from "../../hooks/useLoading";
import LoadingOverlay from "../Component-elements/loading_overlay";
import ActivityComments from "./ActivityComments";
import AnswerSubmission from "./AnswerSubmission";
import TeacherInstructions from "./TeacherInstructions";
import "./css/Activity.css";
import type { Instruction } from "./TeacherInstructions";
import ActivitySubmissions, { type Submission } from "./Activities";

const ActivityView: React.FC = (): React.ReactElement => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { messageComponent, showMessage } = useMessage();
  const { loading, wrap } = useLoadingState();

  const [activity, setActivity] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<
    "activity" | "submissions" | "comments"
  >(() => {
    try {
      const saved = localStorage.getItem(`activity-${id}-tab`);
      if (saved && ["activity", "submissions", "comments"].includes(saved)) {
        return saved as "activity" | "submissions" | "comments";
      }
    } catch (e) {
      console.error("Failed to load saved tab:", e);
    }

    return "activity";
  });
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState<boolean>(false);
  const [maxScore, setMaxScore] = useState<number>(100);

  const showMsgRef = useRef(showMessage);
  const mountedRef = useRef<boolean>(true);

  useEffect(() => {
    showMsgRef.current = showMessage;
  }, [showMessage]);

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  }, []);

  // Save tab to localStorage whenever it changes
  useEffect(() => {
    if (id) {
      try {
        localStorage.setItem(`activity-${id}-tab`, activeTab);
      } catch (e) {
        console.error("Failed to save tab:", e);
      }
    }
  }, [activeTab, id]);

  const loadActivity = useCallback(() => {
    return wrap(async (signal?: AbortSignal) => {
      if (!id) return;
      try {
        const { data, unauthorized } = await apiFetch<{
          success?: boolean;
          activity?: any;
          error?: string;
        }>(`/activity/${encodeURIComponent(String(id))}`, { signal });

        if (unauthorized) {
          showMsgRef.current("Session expired. Please sign in", "error");
          navigate("/login");
          return;
        }

        if (!mountedRef.current) return;

        if (data?.success) {
          setActivity(data.activity ?? null);
        } else {
          showMsgRef.current(data?.error || "Failed to load activity", "error");
          navigate(-1);
        }
      } catch (err) {
         
        console.error("Activity load error", err);
        if (mountedRef.current) {
          showMsgRef.current("Server error loading activity", "error");
          navigate(-1);
        }
      }
    });
  }, [id, navigate, wrap]);

  useEffect(() => {
    mountedRef.current = true;
    const ac = new AbortController();
    const runner = loadActivity();
    // runner is the function returned by wrap; pass signal if it accepts one
    try {
      // some wrap implementations return a function expecting the signal
      // pass the signal if the returned value is callable
      if (typeof runner === "function") {
        // @ts-expect-error: some wrap helpers accept a signal param
        runner(ac.signal);
      } else {
        // otherwise it's a promise already started
        void runner;
      }
    } catch {
      // ignore
    }

    return () => {
      mountedRef.current = false;
      ac.abort();
    };
  }, [loadActivity]);

  const loadSubmissions = useCallback(async () => {
    if (user?.role !== "teacher" || !id) return;
    setSubmissionsLoading(true);
    try {
      const { data, unauthorized } = await apiFetch<{
        success?: boolean;
        submissions?: Submission[];
        error?: string;
        maxScore: number;
      }>(`/activity/${encodeURIComponent(String(id))}/submissions`);
      if (unauthorized) {
        showMsgRef.current("Session expired. Please sign in", "error");
        navigate("/login");
        return;
      }

      if (data?.success && Array.isArray(data.submissions)) {
        setSubmissions(data.submissions);
        setMaxScore(data.maxScore || 100);
      } else {
        showMsgRef.current(data?.error || "Failed to load submission", "error");
      }
    } catch (e) {
      console.error("Submission load error", e);
      showMsgRef.current("Server error loading submissions", "error");
    } finally {
      setSubmissionsLoading(false);
    }
  }, [id, navigate, user?.role]);

  // effect to trigger on tab change
  useEffect(() => {
    if (activeTab === "submissions") {
      void loadSubmissions();
    }
  }, [activeTab, loadSubmissions]);

  // Cleanup the saved tab when leaving the activity page
  useEffect(() => {
    return () => {
      localStorage.removeItem(`activity-${id}-tab`);
    };
  }, [id]);

  if (loading) return <div className="activity-view-page">Loading...</div>;
  if (!activity)
    return <div className="activity-view-page">Activity not found</div>;

  const createdAt = activity.created_at || activity.createdAt;
  const roleClass = user?.role === "teacher" ? "teacher-role" : "student-role";

  if (!activity && !loading)
    return <div className="activity-view-page">Activity not found</div>;

  return (
    <>
      {messageComponent}

      <Header
        variant="authed"
        user={user}
        section={user.role === "student" ? user.section : null}
        headerClass={`home-header ${roleClass}`}
        welcomeClass={`home-welcome ${roleClass}`}
      />

      <div className="activity-view-page">
        <button className="activity-back" onClick={() => navigate(-1)}>
          ← Back
        </button>

        <div className="activity-card" style={{ position: "relative" }}>
          <LoadingOverlay
            loading={!!loading}
            text="Loading activity..."
            fullPage={false}
          />

          {activity && (
            <>
              <div className="activity-tabs">
                <button
                  className={activeTab === "activity" ? "tab active" : "tab"}
                  onClick={() => setActiveTab("activity")}
                >
                  Activity
                </button>
                {user?.role === "teacher" && (
                  <button
                    className={
                      activeTab === "submissions" ? "tab active" : "tab"
                    }
                    onClick={() => setActiveTab("submissions")}
                  >
                    Submissions
                    {user?.role === "teacher" && submissions.length > 0 && (
                      <span className="tab-pill">{submissions.length}</span>
                    )}
                  </button>
                )}
                <button
                  className={activeTab === "comments" ? "tab active" : "tab"}
                  onClick={() => setActiveTab("comments")}
                >
                  Comments
                </button>
              </div>

              {activeTab === "activity" && (
                <>
                  <h1 className="activity-title">{activity.title}</h1>
                  <p className="activity-meta">
                    In classroom{" "}
                    <span className="activity-code">
                      {activity.classroom_code || "-"}
                    </span>
                    {" · "}
                    <span>Created {new Date(createdAt).toLocaleString()}</span>
                  </p>

                  {Array.isArray(activity.instructions) ? (
                    activity.instructions.map(
                      (instr: Instruction, idx: number) => (
                        <p key={instr.id ?? idx}>{instr.instruction_text}</p>
                      )
                    )
                  ) : (
                    <p>No instructions</p>
                  )}

                  {user?.role === "teacher" ? (
                    <TeacherInstructions
                      activityId={activity.id}
                      currentInstructions={activity.instructions}
                      onSaved={(newInstructions) => {
                        setActivity((prev: any) => ({
                          ...prev,
                          instructions: newInstructions,
                        }));
                      }}
                    />
                  ) : (
                    <AnswerSubmission activityId={activity.id} />
                  )}
                </>
              )}

              {activeTab === "submissions" &&
                (user?.role === "teacher" ? (
                  <ActivitySubmissions
                    submissions={submissions}
                    loading={submissionsLoading}
                    maxScore={maxScore}
                    activityId={id!}
                    onScoreUpdate={(submissionId, newScore) => {
                      setSubmissions((prev) =>
                        prev.map((s) =>
                          String(s.id) === String(submissionId)
                            ? {
                                ...s,
                                score: newScore,
                                graded_at: new Date().toISOString(),
                              }
                            : s
                        )
                      );
                    }}
                  />
                ) : (
                  <p className="submission-empty">
                    Submissions are visible to teachers only
                  </p>
                ))}

              {activeTab === "comments" && (
                <ActivityComments activityId={activity.id} />
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default ActivityView;
