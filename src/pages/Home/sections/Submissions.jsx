import { useState } from "react";
import "../Home.css";

const Submissions = ({
  role,
  submissionsList = [],
  activeSubmission,
  assessmentDraft,
  isSavingAssessment,
  onSelectSubmission,
  onAssessmentChange,
  onSaveAssessment,
  showcaseItems = [],
  onToggleShowcase,
  onPostShowcaseComment,
  onPostShowcaseReply,
}) => {
  const [showcaseCommentDrafts, setShowcaseCommentDrafts] = useState({});
  const [showcaseReplyDrafts, setShowcaseReplyDrafts] = useState({});

  // Goals checklist for this page (rendered to help track what's needed)
  const goals = [
    "Separate public discussion (comments) from official assessments",
    "Allow both students and teachers to mark submissions as showcased",
    "Allow commenting & replying on showcased items",
    "Provide structured assessment (score / rubric) in future iteration",
    "Persist showcase and assessment via backend endpoints",
  ];

  return (
    <>
      <section className="home-card">
        <h2>Submission & Assessment</h2>
        <div className="page-goals">
          <h4>Goals</h4>
          <ul>
            {goals.map((g, i) => {
              <li keys={i}>{g}</li>;
            })}
          </ul>
        </div>

        {role === "teacher" ? (
          <>
            <div className="submissions-list">
              {submissionsList.length > 0 ? (
                <>
                  <select
                    className="submission-select"
                    value={activeSubmission ? activeSubmission.id : ""}
                    onChange={onSelectSubmission}
                  >
                    <option value="">Select a submission...</option>
                    {submissionsList.map((submission) => (
                      <option key={submission.id} value={submission.id}>
                        {submission.studentName} - {submission.activityName} (
                        {new Date(submission.submittedAt).toLocaleDateString()})
                      </option>
                    ))}
                  </select>

                  {activeSubmission && (
                    <div className="submission-details">
                      <p>
                        <strong>Student:</strong> {activeSubmission.studentName}
                      </p>
                      <p>
                        <strong>Activity:</strong>{" "}
                        {activeSubmission.activityName}
                      </p>
                      <p>
                        <strong>Submitted:</strong> {""}{" "}
                        {new Date(
                          activeSubmission.submittedAt
                        ).toLocaleString()}
                      </p>
                      <a
                        href={activeSubmission.fileUrl}
                        target="_blank"
                        rel="noopener noreference"
                        className="view-submission-btn"
                      >
                        View Submission
                      </a>

                      {typeof onToggleShowcase === "function" && (
                        <div className="showcase-toggle">
                          <button
                            onClick={() =>
                              onToggleShowcase(activeSubmission.id)
                            }
                            className="toggle-showcase-btn"
                          >
                            {activeSubmission.showcased
                              ? "Unshowcase"
                              : "Showcase"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="empty-state">
                  <span className="empty-icon">📥</span>
                  <p>No submission to review yet</p>
                </div>
              )}
            </div>

            <div className="assessment-container">
              <textarea
                className="feedback-textarea"
                value={assessmentDraft}
                onChange={onAssessmentChange}
                placeholder="Select a submissionand provide your assessment here..."
                rows={8}
                disabled={!activeSubmission}
              ></textarea>
            </div>

            <div className="assessment-actions">
              <span className="status-indicator">
                {assessmentDraft
                  ? `${assessmentDraft.length} characters`
                  : "Empty assessment"}
              </span>
              <button
                className="upload-button"
                onClick={onSaveAssessment}
                disabled={
                  isSavingAssessment ||
                  !assessmentDraft?.trim() ||
                  !activeSubmission
                }
              >
                {isSavingAssessment ? "Saving..." : "Save Assessment"}
              </button>
            </div>
          </>
        ) : (
          <div className="student-submissions">
            {submissionsList.length > 0 ? (
              submissionsList.map((submission) => (
                <div key={submission.id} className="submission-item">
                  <h3>{submission.activityName}</h3>
                  <p>
                    <strong>Submitted:</strong>{" "}
                    {new Date(submission.submittedAt).toLocaleString()}
                  </p>

                  {/* Student can showcase their own submission */}
                  {typeof onToggleShowcase === "function" && (
                    <div className="showcase-toggle-inline">
                      <button
                        onClick={() => onToggleShowcase(submission.id)}
                        className="toggle-showcase-btn"
                      >
                        {submission.showcased ? "Unshowcase" : "Showcase"}
                      </button>
                      {submission.showcased && (
                        <span className="showcased-badge">Showcased</span>
                      )}
                    </div>
                  )}

                  {submission.feedback ? (
                    <div className="feedback-content">
                      <h4>Teacher's Assessment:</h4>
                      <p>{submission.feedback}</p>
                    </div>
                  ) : (
                    <p className="pending-feedback">
                      Waiting for teacher's assessment
                    </p>
                  )}
                </div>
              ))
            ) : (
              <div className="empty-state">
                <span className="empty-icon">📝</span>
                <p>Under construction, stay tuned</p>
              </div>
            )}
          </div>
        )}

        {/* Showcase section (visible to everyone) */}
        <hr />
        <div className="showcase-section">
          <h3>Showcase</h3>
          {showcaseItems.length === 0 ? (
            <p className="empty-state">No showcased submissions yet.</p>
          ) : (
            <ul className="showcase-list">
              {showcaseItems.map((s) => (
                <li key={s.id} className="showcase-item">
                  <div className="showcase-meta">
                    <strong>{s.studentName}</strong>
                    <span className="score">Score: {s.score ?? "—"}</span>
                    <a
                      href={s.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View
                    </a>
                    <span className="showcased-at">
                      {s.showcasedAt
                        ? new Date(s.showcasedAt).toLocaleString()
                        : ""}
                    </span>
                  </div>

                  <div className="showcase-comments">
                    <textarea
                      placeholder="Add a public comment..."
                      value={showcaseCommentDrafts[s.id] ?? ""}
                      onChange={(e) =>
                        setShowcaseCommentDrafts((p) => ({
                          ...p,
                          [s.id]: e.target.value,
                        }))
                      }
                    />
                    <button
                      disabled={
                        !showcaseCommentDrafts[s.id]?.trim() ||
                        typeof onPostShowcaseComment !== "function"
                      }
                      onClick={() => {
                        const text = (showcaseCommentDrafts[s.id] ?? "").trim();
                        if (!text) return;
                        onPostShowcaseComment?.(s.id, text);
                        setShowcaseCommentDrafts((p) => ({ ...p, [s.id]: "" }));
                      }}
                    >
                      Post
                    </button>

                    {s.comments?.length > 0 && (
                      <ul className="showcase-comment-list">
                        {s.comments.map((c) => (
                          <li key={c.id} className="showcase-comment">
                            <div className="meta">
                              <strong>{c.username ?? "User"}</strong>
                              <time dateTime={c.created_at || c.createdAt}>
                                {new Date(
                                  c.created_at || c.createdAt
                                ).toLocaleString()}
                              </time>
                            </div>
                            <div className="body">{c.comment ?? c.text}</div>

                            <div className="reply-block">
                              <textarea
                                placeholder="Write a reply..."
                                value={showcaseReplyDrafts[c.id] ?? ""}
                                onChange={(e) =>
                                  setShowcaseReplyDrafts((p) => ({
                                    ...p,
                                    [c.id]: e.target.value,
                                  }))
                                }
                              />
                              <button
                                disabled={
                                  !showcaseReplyDrafts[c.id]?.trim() ||
                                  typeof onPostShowcaseReply !== "function"
                                }
                                onClick={() => {
                                  const r = (
                                    showcaseReplyDrafts[c.id] ?? ""
                                  ).trim();
                                  if (!r) return;
                                  onPostShowcaseReply?.(s.id, c.id, r);
                                  setShowcaseReplyDrafts((p) => ({
                                    ...p,
                                    [c.id]: "",
                                  }));
                                }}
                              >
                                Reply
                              </button>

                              {c.replies?.length > 0 && (
                                <ul className="replies-list">
                                  {c.replies.map((r) => (
                                    <li key={r.id} className="reply">
                                      <strong>{r.username ?? "User"}</strong>
                                      <div>{r.reply}</div>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
};

export default Submissions;
