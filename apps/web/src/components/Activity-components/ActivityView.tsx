import React, {
  useEffect,
  useRef,
  useCallback,
  useState,
  useMemo,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiFetch } from "utils/apiClient";
import useMessage from "hooks/useMessage";
import useRealTimeData from "hooks/useRealTimeData";
import Header from "components/Component-elements/Header";
import useLoadingState from "hooks/useLoading";
import LoadingOverlay from "components/Component-elements/loading_overlay";
import ActivityComments from "./ActivityComments";
import AnswerSubmission from "./AnswerSubmission";
import TeacherInstructions from "./TeacherInstructions";
import ActivitySubmissions from "./Activities";
import type {
  ActivityApiResponse,
  ActivityDetail,
  Instruction,
  Submission,
  SubmissionApiResponse,
} from "types/activity";
import type { SessionUser } from "types/api";
import { readJsonStorage } from "utils/storage";
import {
  getLocalStorage,
  safeStorageGet,
  safeStorageRemove,
  safeStorageSet,
} from "utils/safeStorage";
import "./css/Activity.css";

type ActiveTab = "activity" | "submissions" | "comments";

const VALID_TABS: ActiveTab[] = ["activity", "submissions", "comments"];

const ActivityView: React.FC = (): React.ReactElement => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { messageComponent, showMessage } = useMessage();
  const { loading, wrap } = useLoadingState();

  const [activity, setActivity] = useState<ActivityDetail | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    if (typeof window === "undefined") {
      return "activity";
    }

    try {
      const saved = safeStorageGet(getLocalStorage(), `activity-${id}-tab`);
      if (saved && VALID_TABS.includes(saved as ActiveTab)) {
        return saved as ActiveTab;
      }
    } catch (e) {
      console.error("Failed to load saved tab:", e);
    }

    return "activity";
  });
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState<boolean>(false);
  const [maxScore, setMaxScore] = useState<number>(100);
  const [loadError, setLoadError] = useState<string>("");

  const showMsgRef = useRef(showMessage);
  const mountedRef = useRef<boolean>(true);

  useEffect(() => {
    showMsgRef.current = showMessage;
  }, [showMessage]);

  const user = useMemo<SessionUser | null>(
    () => readJsonStorage<SessionUser>("user"),
    [],
  );

  // Save tab to localStorage whenever it changes
  useEffect(() => {
    if (id) {
      try {
        safeStorageSet(getLocalStorage(), `activity-${id}-tab`, activeTab);
      } catch (e) {
        console.error("Failed to save tab:", e);
      }
    }
  }, [activeTab, id]);

  const loadActivity = useCallback(async () => {
    if (!id) return;

    await wrap(async () => {
      setLoadError("");
      try {
        const { data, unauthorized } = await apiFetch<ActivityApiResponse>(
          `/activity/${encodeURIComponent(String(id))}`,
        );

        if (unauthorized) {
          showMsgRef.current("Session expired. Please sign in", "error");
          navigate("/login");
          return;
        }

        if (!mountedRef.current) return;

        if (data?.success) {
          setActivity(data.activity ?? null);
        } else {
          const msg = data?.error || "Failed to load activity";
          setLoadError(msg);
          showMsgRef.current(msg, "error");
        }
      } catch (err) {
        console.error("Activity load error", err);
        if (mountedRef.current) {
          const msg = "Server error loading activity";
          setLoadError(msg);
          showMsgRef.current(msg, "error");
        }
      }
    });
  }, [id, navigate, wrap]);

  useEffect(() => {
    mountedRef.current = true;
    void loadActivity();

    return () => {
      mountedRef.current = false;
    };
  }, [loadActivity]);

  // Real-time polling for submissions (teacher only)
  const { refresh: refreshSubmissions, isPolling: pollingSubmissions } =
    useRealTimeData({
      fetchFn: async () => {
        if (user?.role !== "teacher" || !id) return [];
        const { data } = await apiFetch<{
          success?: boolean;
          submissions?: Submission[];
          maxScore?: number;
        }>(`/activity/${encodeURIComponent(String(id))}/submissions`);

        if (data?.success && Array.isArray(data.submissions)) {
          if (data.maxScore) setMaxScore(data.maxScore);
          return data.submissions;
        }
        return [];
      },
      interval: 10000, // Poll every 10 seconds
      enabled: user?.role === "teacher" && !!id && activeTab === "submissions",
      onChange: (submissions) => {
        setSubmissions(submissions);
        setSubmissionsLoading(false);
      },
    });

  const loadSubmissions = useCallback(async () => {
    if (user?.role !== "teacher" || !id) return;
    setSubmissionsLoading(true);
    try {
      const { data, unauthorized } = await apiFetch<SubmissionApiResponse>(
        `/activity/${encodeURIComponent(String(id))}/submissions`,
      );
      if (unauthorized) {
        showMsgRef.current("Session expired. Please sign in", "error");
        navigate("/login");
        return;
      }

      if (data?.success && Array.isArray(data.submissions)) {
        setSubmissions(data.submissions);
        setMaxScore(data.maxScore ?? 100);
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
      safeStorageRemove(getLocalStorage(), `activity-${id}-tab`);
    };
  }, [id]);

  if (loading) return <div className="activity-view-page">Loading...</div>;
  if (!activity)
    return (
      <div className="activity-view-page">
        <div className="activity-card" style={{ marginTop: "1rem" }}>
          <h3>
            {loadError ? "Unable to load activity" : "Activity not found"}
          </h3>
          {loadError && <p>{loadError}</p>}
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
            <button
              className="activity-back"
              onClick={() => void loadActivity()}
            >
              Retry
            </button>
            <button className="activity-back" onClick={() => navigate(-1)}>
              Back
            </button>
          </div>
        </div>
      </div>
    );

  const createdAt = activity.created_at || activity.createdAt;
  const instructionList = Array.isArray(activity.instructions)
    ? activity.instructions
    : [];
  return (
    <>
      {messageComponent}

      <Header
        variant="authed"
        user={user}
        section={user?.role === "student" ? user.section : null}
        headerClass="app-header"
        welcomeClass="app-welcome"
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
                    <span>
                      Created{" "}
                      {createdAt
                        ? new Date(createdAt).toLocaleString()
                        : "Unknown"}
                    </span>
                    {activity.due_date && (
                      <>
                        {" · "}
                        <span
                          style={{
                            color:
                              new Date(activity.due_date) < new Date()
                                ? "#ef4444"
                                : "#94a3b8",
                          }}
                        >
                          Due {new Date(activity.due_date).toLocaleString()}
                        </span>
                      </>
                    )}
                  </p>

                  {activity.original_name && activity.file_path && (
                    <div className="activity-attachment">
                      <h3>
                        Attachment
                        <a
                          href={`${
                            process.env.NEXT_PUBLIC_API_BASE_LOCAL ||
                            "http://localhost:5000"
                          }/uploads/activities/${activity.file_path}`}
                          target="_blank"
                          rel="noopener noreference"
                          className="activity-file-link"
                        >
                          📎 {activity.original_name}
                        </a>
                      </h3>
                    </div>
                  )}

                  <h3>Instructions</h3>
                  {Array.isArray(activity.instructions) ? (
                    activity.instructions.map(
                      (instr: Instruction, idx: number) => (
                        <p key={instr.id ?? idx}>{instr.instruction_text}</p>
                      ),
                    )
                  ) : (
                    <p>No instructions</p>
                  )}

                  {user?.role === "teacher" ? (
                    <TeacherInstructions
                      activityId={activity.id}
                      currentInstructions={instructionList}
                      onSaved={(newInstructions) => {
                        setActivity((prev) =>
                          prev
                            ? {
                                ...prev,
                                instructions: newInstructions,
                              }
                            : prev,
                        );
                      }}
                    />
                  ) : (
                    <AnswerSubmission activityId={activity.id} />
                  )}
                </>
              )}

              {activeTab === "submissions" &&
                (user?.role === "teacher" ? (
                  <>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "1rem",
                      }}
                    >
                      <h3 style={{ margin: 0 }}>Student Submissions</h3>
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          alignItems: "center",
                        }}
                      >
                        {pollingSubmissions && (
                          <span
                            className="polling-indicator"
                            title="Checking for updates..."
                          >
                            🔄
                          </span>
                        )}
                        <button
                          className="refresh-btn"
                          onClick={refreshSubmissions}
                          disabled={submissionsLoading}
                          title="Refresh submissions"
                          style={{
                            padding: "6px 12px",
                            fontSize: "13px",
                            background: "var(--accent-color)",
                            color: "white",
                            border: "none",
                            borderRadius: "6px",
                            cursor: "pointer",
                          }}
                        >
                          Refresh
                        </button>
                      </div>
                    </div>
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
                              : s,
                          ),
                        );
                      }}
                    />
                  </>
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
