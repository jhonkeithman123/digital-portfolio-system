import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "utils/apiClient";
import Header from "components/Component-elements/Header";
import useMessage from "hooks/useMessage";
import TokenGuard from "components/auth/tokenGuard";
import "./Portfolio.css";

type ActivityType = "quiz" | "assignment" | "project";
type ActivityStatus = "completed" | "pending" | "graded";

type Activity = {
  id: string | number;
  title: string;
  description?: string;
  type: ActivityType;
  score?: number | null;
  completedAt?: string;
  status: ActivityStatus;
  className?: string;
};

export default function Portfolio(): React.ReactElement {
  const navigate = useNavigate();
  const { messageComponent, showMessage } = useMessage();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ActivityType | "all">("all");

  const showMsgRef = useRef(showMessage);

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    showMsgRef.current = showMessage;
  }, [showMessage]);

  const loadActivities = useCallback(async () => {
    setLoading(true);
    try {
      const { data, unauthorized } = await apiFetch("/portfolio/activities");

      if (unauthorized) {
        showMsgRef.current("Session expired. Please sign in again.", "error");
        return;
      }

      if (data?.success) {
        setActivities(data.activities || []);
      } else {
        showMsgRef.current("Failed to load portfolio", "error");
      }
    } catch (err) {
      showMsgRef.current("Network error loading portfolio", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  const filteredActivities =
    filter === "all" ? activities : activities.filter((a) => a.type === filter);

  const stats = useMemo(() => {
    const completed = activities.filter((a) => a.status === "completed").length;
    const scored = activities.filter((a) => a.score !== null);
    const avgScore =
      scored.length > 0
        ? scored.reduce((acc, a) => acc + (a.score || 0), 0) / scored.length
        : 0;

    return {
      total: activities.length,
      completed,
      avgScore,
    };
  }, [activities]);

  const roleClass = user?.role === "teacher" ? "teacher-role" : "student-role";

  return (
    <TokenGuard
      redirectInfo="/login"
      onExpire={() =>
        showMsgRef.current("Session expired. Please sign in again.", "error")
      }
    >
      <div className="portfolio-page">
        <Header
          variant="authed"
          user={user}
          section={user?.role === "student" ? user?.section : null}
          headerClass={`portfolio-header-main ${roleClass}`}
          welcomeClass={`portfolio-welcome ${roleClass}`}
        />
        {messageComponent}

        <div className="portfolio-container">
          <header className="portfolio-hero">
            <button
              className="portfolio-back-btn"
              onClick={() => navigate("/home")}
            >
              ← Back to Home
            </button>
            <h1 className="portfolio-title">My Portfolio</h1>
            <p className="portfolio-subtitle">
              Track all your completed activities and achievements
            </p>
          </header>

          <section className="portfolio-stats-section">
            <div className="stat-card">
              <div className="stat-icon">📊</div>
              <div className="stat-content">
                <div className="stat-value">{stats.total}</div>
                <div className="stat-label">Total Activities</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">✅</div>
              <div className="stat-content">
                <div className="stat-value">{stats.completed}</div>
                <div className="stat-label">Completed</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">🎯</div>
              <div className="stat-content">
                <div className="stat-value">
                  {stats.avgScore > 0 ? `${stats.avgScore.toFixed(1)}%` : "N/A"}
                </div>
                <div className="stat-label">Average Score</div>
              </div>
            </div>
          </section>

          <div className="portfolio-filters">
            <button
              className={`filter-btn ${filter === "all" ? "active" : ""}`}
              onClick={() => setFilter("all")}
            >
              All Activities
            </button>
            <button
              className={`filter-btn ${filter === "quiz" ? "active" : ""}`}
              onClick={() => setFilter("quiz")}
            >
              📝 Quizzes
            </button>
            <button
              className={`filter-btn ${filter === "assignment" ? "active" : ""}`}
              onClick={() => setFilter("assignment")}
            >
              📄 Assignments
            </button>
            <button
              className={`filter-btn ${filter === "project" ? "active" : ""}`}
              onClick={() => setFilter("project")}
            >
              🎨 Projects
            </button>
          </div>

          {loading ? (
            <div className="portfolio-loading">
              <div className="loading-spinner"></div>
              <p>Loading your portfolio...</p>
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="portfolio-empty">
              <div className="empty-icon">📚</div>
              <h3>No activities found</h3>
              <p>
                {filter === "all"
                  ? "Complete your first activity to see it here!"
                  : `No ${filter}s completed yet.`}
              </p>
            </div>
          ) : (
            <div className="activities-grid">
              {filteredActivities.map((activity) => (
                <div
                  key={activity.id}
                  className={`activity-card type-${activity.type}`}
                >
                  <div className="activity-card-header">
                    <div className="activity-icon">
                      {activity.type === "quiz" && "📝"}
                      {activity.type === "assignment" && "📄"}
                      {activity.type === "project" && "🎨"}
                    </div>
                    <span className={`activity-badge badge-${activity.type}`}>
                      {activity.type}
                    </span>
                  </div>
                  <h3 className="activity-title">{activity.title}</h3>
                  {activity.description && (
                    <p className="activity-desc">{activity.description}</p>
                  )}
                  {activity.className && (
                    <div className="activity-class">
                      <span className="class-label">Class:</span>{" "}
                      {activity.className}
                    </div>
                  )}
                  <div className="activity-card-footer">
                    <div className="activity-meta">
                      {activity.score !== null && (
                        <div className="activity-score">
                          <span className="score-label">Score:</span>
                          <strong className="score-value">
                            {activity.score}%
                          </strong>
                        </div>
                      )}
                      {activity.completedAt && (
                        <div className="activity-date">
                          {new Date(activity.completedAt).toLocaleDateString(
                            "en-US",
                            {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            },
                          )}
                        </div>
                      )}
                    </div>
                    <div
                      className={`activity-status status-${activity.status}`}
                    >
                      {activity.status === "completed" && "Completed"}
                      {activity.status === "pending" && "Pending"}
                      {activity.status === "graded" && "Graded"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </TokenGuard>
  );
}
