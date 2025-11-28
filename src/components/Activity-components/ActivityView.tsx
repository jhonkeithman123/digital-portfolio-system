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

const ActivityView: React.FC = (): React.ReactElement => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { messageComponent, showMessage } = useMessage();
  const { loading, wrap } = useLoadingState();

  const [activity, setActivity] = useState<any | null>(null);

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
        // eslint-disable-next-line no-console
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
              <h1 className="activity-title">{activity.title}</h1>
              <p className="activity-meta">
                In classroom{" "}
                <span className="activity-code">
                  {activity.classroom_code || "-"}
                </span>
                {" · "}
                <span>Created {new Date(createdAt).toLocaleString()}</span>
              </p>

              {activity.instructions && (
                <p className="activity-body">{activity.instructions}</p>
              )}

              {user?.role === "teacher" ? (
                <TeacherInstructions activityId={activity.id} />
              ) : (
                <AnswerSubmission activityId={activity.id} />
              )}

              <ActivityComments activityId={activity.id} />
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default ActivityView;
