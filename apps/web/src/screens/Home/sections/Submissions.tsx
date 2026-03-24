import React, { useCallback, useMemo, useState } from "react";
import "home/Home.css";

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
    text: string,
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
    [],
  );

  const handlePostComment = useCallback(
    // Submission & Assessment and Showcase section removed
    return null;
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
                                  c.created_at ?? c.createdAt ?? "",
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
