import React, { useEffect, useRef, useState } from "react";
import { apiFetch } from "../../utils/apiClient";
import useMessage from "../../hooks/useMessage";
import type {
  Submission,
  ActivitySubmissionsProps as Props,
} from "../../types/activity";
import "./css/Activity.css";

const ActivitySubmissions: React.FC<Props> = ({
  submissions,
  loading,
  maxScore,
  activityId,
  onScoreUpdate,
}) => {
  const { messageComponent, showMessage } = useMessage();
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [scoreInput, setScoreInput] = useState<string>("");
  const [grading, setGrading] = useState<boolean>(false);

  const showMsgRef = useRef(showMessage);

  useEffect(() => {
    showMsgRef.current = showMessage;
  }, [showMessage]);

  const startGrading = (sub: Submission) => {
    setEditingId(sub.id);
    setScoreInput(sub.score !== null ? String(sub.score) : "");
  };

  const cancelGrading = () => {
    setEditingId(null);
    setScoreInput("");
  };

  const submitScore = async (submissionId: string | number) => {
    const parsed = parseFloat(scoreInput);
    if (isNaN(parsed) || parsed < 0 || parsed > maxScore) {
      showMsgRef.current(`Score must be between - and ${maxScore}`, "error");
      return;
    }

    setGrading(true);
    try {
      const { data, unauthorized } = await apiFetch(
        `/activity/${encodeURIComponent(
          String(activityId)
        )}/submissions/${encodeURIComponent(String(submissionId))}/score`,
        {
          method: "PATCH",
          body: JSON.stringify({ score: parsed }),
          headers: { "Content-Type": "application/json" },
        }
      );

      if (unauthorized) {
        showMsgRef.current("Session expired. Please sign in.", "error");
        return;
      }

      if (data?.success) {
        showMsgRef.current("Score updated", "success");
        setEditingId(null);
        setScoreInput("");
        if (onScoreUpdate) onScoreUpdate(submissionId, parsed);
      } else {
        showMsgRef.current(data?.error || "Failed to updated score", "error");
      }
    } catch (e) {
      console.error("Score updated error:", e);
      showMsgRef.current("Server error", "error");
    } finally {
      setGrading(false);
    }
  };

  if (loading)
    return <p className="submission-empty">Loading Submissions...</p>;
  if (!submissions.length) {
    return <p className="submission-empty">No submissions yet.</p>;
  }

  return (
    <>
      {messageComponent}
      <div className="submission-header">
        <h3>Student Submissions</h3>
        <span className="max-score-badge">Max Score: {maxScore}</span>
      </div>

      <ul className="submission-list">
        {submissions.map((s) => (
          <li key={s.id} className="submission-card">
            <div className="submission-header">
              <div>
                <strong>{s.username}</strong>
                {s.section && (
                  <span className="submission-chip">{s.section}</span>
                )}
              </div>
              <time>
                {s.created_at ? new Date(s.created_at).toLocaleString() : "-"}
              </time>

              <div className="submission-body">
                {s.original_name ? (
                  <a
                    href={`${
                      import.meta.env.VITE_API_BASE_URL ||
                      "http://localhost:5000"
                    }/uploads/activities/${s.file_path}`}
                    target="_blank"
                    rel="noopener noreference"
                    className="submission-link"
                  >
                    📎 {s.original_name}
                  </a>
                ) : (
                  <span className="submission-empty">No attachment</span>
                )}
              </div>

              <div className="submission-score-section">
                {editingId === s.id ? (
                  <div className="score-input-group">
                    <input
                      type="number"
                      className="score-input"
                      value={scoreInput}
                      onChange={(e) => setScoreInput(e.target.value)}
                      min={0}
                      max={maxScore}
                      step={0.5}
                      placeholder={`0-${maxScore}`}
                      disabled={grading}
                      autoFocus
                    />
                    <button
                      className="score-save-btn"
                      onClick={() => submitScore(s.id)}
                      disabled={grading || !scoreInput.trim()}
                    >
                      Save
                    </button>
                    <button
                      className="score-cancel-btn"
                      onClick={cancelGrading}
                      disabled={grading}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="score-display-group">
                    {s.score !== null && s.score !== undefined ? (
                      <>
                        <span className="score-badge">
                          {s.score} / {maxScore}
                        </span>
                        {s.graded_at && (
                          <span className="graded-time">
                            Graded {new Date(s.graded_at).toLocaleDateString()}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="ungraded-badge">Not graded</span>
                    )}
                    <button
                      className="grade-btn"
                      onClick={() => startGrading(s)}
                      disabled={grading}
                    >
                      {s.score !== null ? "Edit Score" : "Grade"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
};

export default ActivitySubmissions;
