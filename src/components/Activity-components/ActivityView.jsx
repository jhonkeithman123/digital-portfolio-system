import { useEffect, useRef, useState } from "react";
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

const ActivityView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { messageComponent, showMessage } = useMessage();
  const { loading, wrap } = useLoadingState();

  const [activity, setActivity] = useState(null);

  const showMsgRef = useRef(showMessage);

  useEffect(() => {
    showMsgRef.current = showMessage;
  }, [showMessage]);

  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  })();

  const loadActivity = async () => {
    try {
      const { data } = await apiFetch(`/activity/${encodeURIComponent(id)}`);

      if (data?.success) setActivity(data.activity);
      else {
        showMsgRef.current(data?.error || "Failed to load activity");
        navigate(-1);
      }
    } catch (e) {
      console.error("Activity load error", e);
      showMsgRef.current("Server error loading activity");
      navigate(-1);
    } finally {
    }
  };

  useEffect(() => {
    loadActivity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          <LoadingOverlay loading={loading} text="Loading activity..." />

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
