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
import LoadingOverlay from "components/Component-elements/loading_overlay";
import type { PortfolioActivity } from "types/activity";
import "./Portfolio.css";

export default function Portfolio(): React.ReactElement {
  const navigate = useNavigate();
  const { messageComponent, showMessage } = useMessage();
  const [activities, setActivities] = useState<PortfolioActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<
    PortfolioActivity["status"] | "all"
  >("all");

  const showMsgRef = useRef(showMessage);

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  }, []);

  const isTeacher = user?.role === "teacher";
  const isStudent = user?.role === "student";

  useEffect(() => {
    showMsgRef.current = showMessage;
  }, [showMessage]);

  const loadActivities = useCallback(async () => {
    setLoading(true);
    try {
      const { data, unauthorized } = await apiFetch("/portfolio/activities");

      if (unauthorized) {
        showMsgRef.current("Session expired. Please sign in again.", "error");
        navigate("/login");
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
  }, [navigate]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  const filteredActivities = useMemo(() => {
    let filtered = activities;

    if (statusFilter !== "all") {
      filtered = filtered.filter((a) => a.status === statusFilter);
    }

    return filtered;
  }, [activities, statusFilter]);

  const stats = useMemo(() => {
    if (isTeacher) {
      const totalCreated = activities.length;
      const totalSubmissions = activities.reduce(
        (sum, a) => sum + (a.totalSubmissions || 0),
        0,
      );
      const totalGraded = activities.reduce(
        (sum, a) => sum + (a.gradedCount || 0),
        0,
      );

      return {
        total: totalCreated,
        submissions: totalSubmissions,
        graded: totalGraded,
      };
    } else {
      const completed = activities.filter(
        (a) => a.status === "completed" || a.status === "graded",
      ).length;
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
    }
  }, [activities, isTeacher]);

  const handleActivityClick = (activityId: string | number) => {
    navigate(`/activity/${activityId}/view`);
  };

  const getStatusBadgeClass = (status: PortfolioActivity["status"]): string => {
    switch (status) {
      case "completed":
        return "status-completed";
      case "graded":
        return "status-graded";
      case "pending":
        return "status-pending";
      case "overdue":
        return "status-overdue";
      case "created":
        return "status-created";
      default:
        return "";
    }
  };

  const getStatusText = (status: PortfolioActivity["status"]): string => {
    switch (status) {
      case "completed":
        return "Completed";
      case "graded":
        return "Graded";
      case "pending":
        return "Pending";
      case "overdue":
        return "Overdue";
      case "created":
        return "Created";
      default:
        return status;
    }
  };

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

        {loading && (
          <LoadingOverlay
            loading={true}
            text="Loading portfolio..."
            fullPage={false}
          />
        )}

        <div className="portfolio-container">
          <header className="portfolio-hero">
            <button
              className="portfolio-back-btn"
              onClick={() => navigate("/dash")}
            >
              ← Back to Dashboard
            </button>
            <h1 className="portfolio-title">
              {isTeacher ? "My Activities" : "My Portfolio"}
            </h1>
            <p className="portfolio-subtitle">
              {isTeacher
                ? "Manage and track all activities you've created"
                : "Track all your activities and achievements"}
            </p>
          </header>

          <section className="portfolio-stats-section">
            {isTeacher ? (
              <>
                <div className="stat-card">
                  <div className="stat-icon">📊</div>
                  <div className="stat-content">
                    <div className="stat-value">{stats.total}</div>
                    <div className="stat-label">Activities Created</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">📤</div>
                  <div className="stat-content">
                    <div className="stat-value">{stats.submissions}</div>
                    <div className="stat-label">Total Submissions</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">✅</div>
                  <div className="stat-content">
                    <div className="stat-value">{stats.graded}</div>
                    <div className="stat-label">Graded</div>
                  </div>
                </div>
              </>
            ) : (
              <>
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
                      {stats.avgScore! > 0
                        ? `${stats.avgScore!.toFixed(1)}%`
                        : "N/A"}
                    </div>
                    <div className="stat-label">Average Score</div>
                  </div>
                </div>
              </>
            )}
          </section>

          {isStudent && (
            <div className="portfolio-filters">
              <button
                className={`filter-btn ${statusFilter === "all" ? "active" : ""}`}
                onClick={() => setStatusFilter("all")}
              >
                All Status
              </button>
              <button
                className={`filter-btn ${statusFilter === "pending" ? "active" : ""}`}
                onClick={() => setStatusFilter("pending")}
              >
                Pending
              </button>
              <button
                className={`filter-btn ${statusFilter === "completed" ? "active" : ""}`}
                onClick={() => setStatusFilter("completed")}
              >
                Completed
              </button>
              <button
                className={`filter-btn ${statusFilter === "graded" ? "active" : ""}`}
                onClick={() => setStatusFilter("graded")}
              >
                Graded
              </button>
              <button
                className={`filter-btn ${statusFilter === "overdue" ? "active" : ""}`}
                onClick={() => setStatusFilter("overdue")}
              >
                Overdue
              </button>
            </div>
          )}

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
                {statusFilter === "all"
                  ? isTeacher
                    ? "Create your first activity to see it here!"
                    : "Complete your first activity to see it here!"
                  : `No activities with status: ${statusFilter} found.`}
              </p>
              <button
                className="dashboard-button"
                onClick={() => navigate("/home")}
                style={{ marginTop: "1rem" }}
              >
                Go to {isTeacher ? "Create Activity" : "Activities"}
              </button>
            </div>
          ) : (
            <div className="activities-grid">
              {filteredActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="activity-card"
                  onClick={() => handleActivityClick(activity.id)}
                  style={{ cursor: "pointer" }}
                >
                  <div className="activity-card-header">
                    <div className="activity-icon">📋</div>
                    <span className="activity-badge badge-activity">
                      activity
                    </span>
                  </div>
                  <h3 className="activity-title">{activity.title}</h3>
                  {activity.className && (
                    <div className="activity-class">
                      <span className="class-label">Class:</span>{" "}
                      {activity.className}
                      {activity.classSection && ` - ${activity.classSection}`}
                    </div>
                  )}
                  <div className="activity-card-footer">
                    <div className="activity-meta">
                      {isStudent && activity.score !== null && (
                        <div className="activity-score">
                          <span className="score-label">Score:</span>
                          <strong className="score-value">
                            {activity.score}%
                          </strong>
                        </div>
                      )}
                      {isTeacher && (
                        <>
                          <div className="activity-score">
                            <span className="score-label">Submissions:</span>
                            <strong className="score-value">
                              {activity.totalSubmissions || 0}
                            </strong>
                          </div>
                          {activity.averageScore && (
                            <div className="activity-score">
                              <span className="score-label">Avg Score:</span>
                              <strong className="score-value">
                                {activity.averageScore}%
                              </strong>
                            </div>
                          )}
                        </>
                      )}
                      {activity.dueDate &&
                        isStudent &&
                        !activity.completedAt && (
                          <div
                            className="activity-date"
                            style={{
                              color:
                                new Date(activity.dueDate) < new Date()
                                  ? "#ef4444"
                                  : "#94a3b8",
                            }}
                          >
                            Due:{" "}
                            {new Date(activity.dueDate).toLocaleDateString(
                              "en-US",
                              {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </div>
                        )}
                    </div>
                    <div
                      className={`activity-status ${getStatusBadgeClass(activity.status)}`}
                    >
                      {getStatusText(activity.status)}
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
