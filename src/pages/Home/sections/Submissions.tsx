import React, { useCallback, useMemo, useState } from "react";
import "../Home.css";

type Role = "teacher" | "student" | string;

type Reply = {
  id: string | number;
  username?: string | null;
  reply?: string;
  created_at?: string | null;
  createdAt?: string | null;
  [k: string]: any;
};

type Comment = {
  id: string | number;
  username?: string | null;
  comment?: string;
  text?: string;
  created_at?: string | null;
  createdAt?: string | null;
  replies?: Reply[];
  [k: string]: any;
};

type Submission = {
  id: string | number;
  studentName?: string;
  activityName?: string;
  submittedAt?: string;
  fileUrl?: string;
  showcased?: boolean;
  feedback?: string | null;
  [k: string]: any;
};

type ShowcaseItem = {
  id: string | number;
  studentName?: string;
  score?: number | null;
  fileUrl?: string;
  showcasedAt?: string | null;
  comments?: Comment[];
  [k: string]: any;
};

interface SubmissionsProps {
  role: Role;
  submissionsList?: Submission[];
  activeSubmission?: Submission | null;
  assessmentDraft?: string;
  isSavingAssessment?: boolean;
  onSelectSubmission?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onAssessmentChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSaveAssessment?: () => void;
  showcaseItems?: ShowcaseItem[];
  onToggleShowcase?: (submissionId: string | number) => void;
  onPostShowcaseComment?: (submissionId: string | number, text: string) => void;
  onPostShowcaseReply?: (
    submissionId: string | number,
    commentId: string | number,
    text: string
  ) => void;
}

const Submissions: React.FC<SubmissionsProps> = ({
  role,
  submissionsList = [],
  activeSubmission = null,
  assessmentDraft = "",
  isSavingAssessment = false,
  onSelectSubmission,
  onAssessmentChange,
  onSaveAssessment,
  showcaseItems = [],
  onToggleShowcase,
  onPostShowcaseComment,
  onPostShowcaseReply,
}) => {
  const [showcaseCommentDrafts, setShowcaseCommentDrafts] = useState<
    Record<string | number, string>
  >({});
  const [showcaseReplyDrafts, setShowcaseReplyDrafts] = useState<
    Record<string | number, string>
  >({});

  const goals = useMemo(
    () => [
      "Separate public discussion (comments) from official assessments",
      "Allow both students and teachers to mark submissions as showcased",
      "Allow commenting & replying on showcased items",
      "Provide structured assessment (score / rubric) in future iteration",
      "Persist showcase and assessment via backend endpoints",
    ],
    []
  );

  const handlePostComment = useCallback(
    (sId: string | number) => {
      const text = (showcaseCommentDrafts[sId] ?? "").trim();
      if (!text) return;
      onPostShowcaseComment?.(sId, text);
      setShowcaseCommentDrafts((p) => ({ ...p, [sId]: "" }));
    },
    [onPostShowcaseComment, showcaseCommentDrafts]
  );

  const handlePostReply = useCallback(
    (sId: string | number, cId: string | number) => {
      const text = (showcaseReplyDrafts[cId] ?? "").trim();
      if (!text) return;
      onPostShowcaseReply?.(sId, cId, text);
      setShowcaseReplyDrafts((p) => ({ ...p, [cId]: "" }));
    },
    [onPostShowcaseReply, showcaseReplyDrafts]
  );

  return (
    <>
      <section className="home-card">
        <h2>Submission & Assessment</h2>

        <div className="page-goals">
          <h4>Goals</h4>
          <ul>
            {goals.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </div>

        {role === "teacher" ? (
          <>
            <div className="submissions-list">
              {submissionsList.length > 0 ? (
                <>
                  <select
                    className="submission-select"
                    value={activeSubmission ? String(activeSubmission.id) : ""}
                    onChange={onSelectSubmission}
                  >
                    <option value="">Select a submission...</option>
                    {submissionsList.map((submission) => (
                      <option
                        key={String(submission.id)}
                        value={String(submission.id)}
                      >
                        {submission.studentName} - {submission.activityName} (
                        {submission.submittedAt
                          ? new Date(
                              submission.submittedAt
                            ).toLocaleDateString()
                          : "—"}
                        )
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
                        <strong>Submitted:</strong>{" "}
                        {activeSubmission.submittedAt
                          ? new Date(
                              activeSubmission.submittedAt
                            ).toLocaleString()
                          : "—"}
                      </p>
                      {activeSubmission.fileUrl && (
                        <a
                          href={activeSubmission.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="view-submission-btn"
                        >
                          View Submission
                        </a>
                      )}

                      {typeof onToggleShowcase === "function" && (
                        <div className="showcase-toggle">
                          <button
                            onClick={() =>
                              onToggleShowcase(activeSubmission.id)
                            }
                            className="toggle-showcase-btn"
                            type="button"
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
                placeholder="Select a submission and provide your assessment here..."
                rows={8}
                disabled={!activeSubmission}
              />
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
                type="button"
              >
                {isSavingAssessment ? "Saving..." : "Save Assessment"}
              </button>
            </div>
          </>
        ) : (
          <div className="student-submissions">
            {submissionsList.length > 0 ? (
              submissionsList.map((submission) => (
                <div key={String(submission.id)} className="submission-item">
                  <h3>{submission.activityName}</h3>
                  <p>
                    <strong>Submitted:</strong>{" "}
                    {submission.submittedAt
                      ? new Date(submission.submittedAt).toLocaleString()
                      : "—"}
                  </p>

                  {typeof onToggleShowcase === "function" && (
                    <div className="showcase-toggle-inline">
                      <button
                        onClick={() => onToggleShowcase(submission.id)}
                        className="toggle-showcase-btn"
                        type="button"
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

        <hr />

        <div className="showcase-section">
          <h3>Showcase</h3>
          {showcaseItems.length === 0 ? (
            <p className="empty-state">No showcased submissions yet.</p>
          ) : (
            <ul className="showcase-list">
              {showcaseItems.map((s) => (
                <li key={String(s.id)} className="showcase-item">
                  <div className="showcase-meta">
                    <strong>{s.studentName}</strong>
                    <span className="score">Score: {s.score ?? "—"}</span>
                    {s.fileUrl && (
                      <a
                        href={s.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View
                      </a>
                    )}
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
                      onClick={() => handlePostComment(s.id)}
                      type="button"
                    >
                      Post
                    </button>

                    {(s.comments?.length ?? 0) > 0 && (
                      <ul className="showcase-comment-list">
                        {s.comments?.map((c) => (
                          <li key={String(c.id)} className="showcase-comment">
                            <div className="meta">
                              <strong>{c.username ?? "User"}</strong>
                              <time
                                dateTime={
                                  c.created_at ?? c.createdAt ?? undefined
                                }
                              >
                                {new Date(
                                  c.created_at ?? c.createdAt ?? ""
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
                                onClick={() => handlePostReply(s.id, c.id)}
                                type="button"
                              >
                                Reply
                              </button>

                              {(c.replies?.length ?? 0) > 0 && (
                                <ul className="replies-list">
                                  {c.replies?.map((r) => (
                                    <li key={String(r.id)} className="reply">
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
