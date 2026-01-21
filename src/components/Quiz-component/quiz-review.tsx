import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiFetch } from "../../utils/apiClient.js";
import TokenGuard from "../auth/tokenGuard.js";
import useMessage from "../../hooks/useMessage.js";
import Header from "../Component-elements/Header.js";
import "./css/quiz-review.css";

import type {
  Question,
  QuizAttempt as Attempt,
  GradingState,
} from "../../types/quiz";

const GRADING_STORAGE_KEY = "quiz_grading_state";

function saveGradingState(
  classCode: string,
  quizId: string,
  attemptId: string | number,
  state: {
    questionScores: Record<string, number>;
    gradingScore: string;
    gradingComment: string;
    gradingPayload: Record<string, any>;
  },
) {
  try {
    const key = `${GRADING_STORAGE_KEY}_${classCode}_${quizId}`;
    const stored = JSON.parse(localStorage.getItem(key) || "{}");
    stored[attemptId] = {
      ...state,
      timestamp: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(stored));
  } catch (err) {
    console.error("Failed to load grading state:", err);
    return null;
  }
}

function loadGradingState(
  classCode: string,
  quizId: string,
  attemptId: string | number,
) {
  try {
    const key = `${GRADING_STORAGE_KEY}_${classCode}_${quizId}`;
    const stored = JSON.parse(localStorage.getItem(key) || "{}");
    return stored[attemptId] || null;
  } catch (err) {
    console.error("Failed to load grading state:", err);
    return null;
  }
}

function clearGradingState(classCode: string, quizId: string) {
  try {
    const key = `${GRADING_STORAGE_KEY}_${classCode}_${quizId}`;
    localStorage.removeItem(key);
  } catch (err) {
    console.error("Failed to clear grading state:", err);
  }
}

export default function QuizReviewPage(): React.ReactElement {
  const params = useParams();
  const classCode = (params.classCode ||
    params.classroomCode ||
    params.code) as string | undefined;
  const quizId = params.quizId as string | undefined;
  const navigate = useNavigate();
  const { messageComponent, showMessage } = useMessage();

  const [loading, setLoading] = useState<boolean>(true);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [selected, setSelected] = useState<Attempt | null>(null); // attempt object
  const [gradingScore, setGradingScore] = useState<string>("");
  const [gradingComment, setGradingComment] = useState<string>("");
  const [gradingPayload, setGradingPayload] = useState<Record<string, any>>({}); // optional per-question grading data
  const [filter, setFilter] = useState<string>("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionScores, setQuestionScores] = useState<Record<string, number>>(
    {},
  );
  const [manualScores, setManualScores] = useState<Record<string, number>>({});
  const [initialFilterSet, setInitialFilterSet] = useState(false);

  // refs for abort + throttling
  const attemptsControllerRef = useRef<AbortController | null>(null);
  const lastFetchRef = useRef<number>(0);
  const mountedRef = useRef<boolean>(true);
  const showMsgRef = useRef(showMessage);
  const listRef = useRef<HTMLDivElement | null>(null);

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

  const loadAttempts = useCallback(async (): Promise<void> => {
    if (!filter) return;

    const now = Date.now();
    if (now - lastFetchRef.current < 500) return;
    lastFetchRef.current = now;

    if (attemptsControllerRef.current) {
      attemptsControllerRef.current.abort();
      attemptsControllerRef.current = null;
    }

    const ac = new AbortController();
    attemptsControllerRef.current = ac;
    setLoading(true);

    try {
      // Load attempts
      const url = `/quizzes/${classCode}/quizzes/${quizId}/attempt?status=${encodeURIComponent(
        filter,
      )}`;
      const { unauthorized, data } = await apiFetch<{
        success?: boolean;
        attempts?: Attempt[];
        message?: string;
      }>(url, { signal: ac.signal });

      if (unauthorized) {
        showMsgRef.current("Session expired. Please sign in again.", "error");
        setAttempts([]);
        return;
      }

      if (!mountedRef.current) return;

      if (!data?.success) {
        showMsgRef.current(data?.message || "Failed to load attempts", "error");
        setAttempts([]);
        return;
      }

      setAttempts(data.attempts || []);

      const { data: quizData } = await apiFetch(
        `/quizzes/${classCode}/quizzes/${quizId}`,
        { signal: ac.signal },
      );

      if (quizData?.quiz?.questions?.pages) {
        const pages = quizData.quiz.questions.pages;
        const flatQuestions = pages.flatMap((p: any) => p.questions || []);
        setQuestions(flatQuestions);
      }
    } catch (err: unknown) {
      if ((err as any).name !== "AbortError") {
        console.error("load attempts", err);
        showMsgRef.current("Server error", "error");
      }
    } finally {
      if (mountedRef.current) setLoading(false);
      attemptsControllerRef.current = null;
    }
  }, [classCode, quizId, filter]);

  // Effect to set initial filter
  useEffect(() => {
    if (initialFilterSet || !classCode || !quizId) return;

    const setDefaultFilter = async () => {
      const filterOptions = [
        "needs_grading",
        "in_progress",
        "completed",
        "all",
      ];

      for (const filterOption of filterOptions) {
        try {
          const url = `/quizzes/${classCode}/quizzes/${quizId}/attempt?status=${encodeURIComponent(
            filterOption,
          )}`;
          const { data } = await apiFetch<{
            success?: boolean;
            attempts?: Attempt[];
          }>(url);

          if (data?.success && data.attempts && data.attempts.length > 0) {
            setFilter(filterOption);
            setInitialFilterSet(true);
            return;
          }
        } catch (err) {
          console.error(`Error checking filter ${filterOption}:`, err);
        }
      }

      setFilter("needs_grading");
      setInitialFilterSet(true);
    };

    setDefaultFilter();
  }, [classCode, quizId, initialFilterSet]);

  // Main use effect
  useEffect(() => {
    mountedRef.current = true;

    if (initialFilterSet) {
      loadAttempts();
    }

    const onFocus = () => {
      if (initialFilterSet) {
        loadAttempts();
      }
    };

    const onVisibility = () => {
      if (!document.hidden) onFocus();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      mountedRef.current = false;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      if (attemptsControllerRef.current) attemptsControllerRef.current.abort();
    };
  }, [loadAttempts, initialFilterSet]);

  useEffect(() => {
    if (!selected || questions.length === 0) return;

    let totalPoints = 0;
    let maxPoints = questions.length;

    questions.forEach((q) => {
      totalPoints += questionScores[q.id] || 0;
    });

    const calculatedScore = maxPoints
      ? Math.round((totalPoints / maxPoints) * 100)
      : 0;

    setGradingScore(String(calculatedScore));
  }, [questionScores, questions, selected]);

  function openAttempt(a: Attempt) {
    const savedState = loadGradingState(classCode!, quizId!, a.id);

    // Saves the state of the previously oppened page in quiz-review.tsx
    if (savedState) {
      // Restore from localStorage
      setSelected(a);
      setGradingScore(a.score != null ? String(a.score) : "");
      setGradingComment("");
      setGradingPayload(a.grading || {});

      const scores: Record<string, number> = {};
      const manScores: Record<string, number> = {};

      questions.forEach((q) => {
        const g = a.grading?.[q.id];

        if (q.requiresManualGrading) {
          manScores[q.id] = g?.manualScore ?? 0;
          scores[q.id] = g?.manualScore ?? 0;
        } else if (g?.scored) {
          scores[q.id] = g.correct ? 1 : 0;
        } else {
          scores[q.id] = 0;
        }
        setManualScores(manScores);
      });
    } else {
      setSelected(a);
      setGradingScore(a.score != null ? String(a.score) : "");
      setGradingComment("");
      setGradingPayload(a.grading || {});

      const scores: Record<string, number> = {};
      const manScores: Record<string, number> = {};

      questions.forEach((q) => {
        const g = a.grading?.[q.id];

        if (q.requiresManualGrading) {
          // For manual grading questions
          manScores[q.id] = g?.manualScore ?? 0;
          scores[q.id] = g?.manualScore ?? 0;
        } else if (g?.scored) {
          // For auto-generated questions, use the auto-score
          scores[q.id] = g.correct ? 1 : 0;
        } else {
          scores[q.id] = 0;
        }
        setManualScores(manScores);
        setQuestionScores(scores);
      });
    }
  }

  // Save state whenever it changes
  useEffect(() => {
    if (selected && classCode && quizId) {
      saveGradingState(classCode, quizId, selected.id, {
        questionScores,
        gradingScore,
        gradingComment,
        gradingPayload,
      });
    }
  }, [
    selected,
    questionScores,
    gradingScore,
    gradingComment,
    gradingPayload,
    classCode,
    quizId,
  ]);

  // Clear localstorage on unmount (when leaving the page)
  useEffect(() => {
    return () => {
      if (classCode && quizId) {
        clearGradingState(classCode, quizId);
      }
    };
  }, [classCode, quizId]);

  const submitGrade = useCallback(async (): Promise<void> => {
    if (!selected) return;

    // Calculate final score including manual grades
    let totalPoints = 0;
    let maxPoints = questions.length;

    questions.forEach((q) => {
      totalPoints += questionScores[q.id] || 0;
    });

    const calculatedScore = maxPoints
      ? Math.round((totalPoints / maxPoints) * 100)
      : 0;

    const finalScore = gradingScore ? Number(gradingScore) : calculatedScore;

    if (!Number.isFinite(finalScore) || finalScore < 0 || finalScore > 100) {
      showMsgRef.current("Score must be 0-100", "error");
      return;
    }

    const updatedGrading = { ...gradingPayload };
    questions.forEach((q) => {
      updatedGrading[q.id] = {
        ...(updatedGrading[q.id] || {}),
        questionScore: questionScores[q.id] || 0,
        manualScore: questionScores[q.id] || 0,
        feedback: gradingPayload[q.id]?.feedback || "",
      };
    });

    // optimistic update
    setAttempts((prev) =>
      prev.map((x) => (x.id === selected.id ? { ...x, score: finalScore } : x)),
    );

    try {
      const url = `/quizzes/${classCode}/quizzes/${quizId}/attempts/${selected.id}/grade`;
      const { unauthorized, data } = await apiFetch(url, {
        method: "PATCH",
        body: JSON.stringify({
          score: finalScore,
          grading: updatedGrading,
          comment: gradingComment,
        }),
      });

      if (unauthorized) {
        showMsgRef.current("Session expired. Please sign in again.", "error");
        return;
      }

      if (!data?.success) {
        showMsgRef.current(data?.message || "Failed to save grade", "error");
        return;
      }

      showMsgRef.current("Attempt graded", "success");

      // Clear the saved state for this attempt after successful submission
      if (classCode && quizId) {
        try {
          const key = `${GRADING_STORAGE_KEY}_${classCode}_${quizId}`;
          const stored = JSON.parse(localStorage.getItem(key) || "{}");
          delete stored[selected.id];
          localStorage.setItem(key, JSON.stringify(stored));
        } catch (e) {
          console.error("Failed to clear attempt state:", e);
        }
      }

      loadAttempts();
      setSelected(null);
    } catch (err) {
      console.error("submit grade", err);
      showMsgRef.current("Server error", "error");
    }
  }, [
    selected,
    gradingScore,
    gradingPayload,
    gradingComment,
    classCode,
    quizId,
    loadAttempts,
    questions,
    questionScores,
  ]);

  const hasUnsavedChanges = useMemo(() => {
    if (!selected || !classCode || !quizId) return false;
    const savedState = loadGradingState(classCode, quizId, selected.id);
    return savedState !== null;
  }, [
    selected,
    classCode,
    quizId,
    questionScores,
    gradingScore,
    gradingComment,
  ]);

  // keyboard navigation in attempt list
  function onListKey(e: React.KeyboardEvent) {
    if (!attempts.length) return;
    const idx = selected ? attempts.findIndex((a) => a.id === selected.id) : -1;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = attempts[Math.min(idx + 1, attempts.length - 1)];
      if (next) openAttempt(next);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = attempts[Math.max(idx - 1, 0)];
      if (prev) openAttempt(prev);
    } else if (e.key === "Enter" && idx >= 0) {
      e.preventDefault();
      openAttempt(attempts[idx]);
    }
  }

  const attemptItems = useMemo(
    () =>
      attempts.map((a) => (
        <li
          key={a.id}
          role="option"
          aria-selected={selected?.id === a.id}
          tabIndex={0}
          className={`qr-item ${selected?.id === a.id ? "is-active" : ""}`}
          onClick={() => openAttempt(a)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openAttempt(a);
            }
          }}
        >
          <div className="qr-item-left">
            <div className="qr-avatar">
              {(a.student_name || a.student_username || "?").slice(0, 1)}
            </div>
            <div className="qr-item-meta">
              <div className="qr-item-name">
                {a.student_name || a.student_username}
              </div>
              <div className="attempt-meta">Attempt #{a.attempt_no}</div>
            </div>
          </div>
          <div className="qr-item-right">
            <span className={`chip status-${a.status ?? "unknown"}`}>
              {a.status ? a.status.replace("_", " ") : "—"}
            </span>
            <span className="qr-score">
              {a.score != null ? `${a.score}%` : "—"}
            </span>
            <button
              className="btn btn-small"
              onClick={(e) => {
                e.stopPropagation();
                openAttempt(a);
              }}
            >
              View
            </button>
          </div>
        </li>
      )),
    [attempts, selected],
  );

  const roleClass = user?.role === "teacher" ? "teacher-role" : "student-role";

  return (
    <TokenGuard
      redirectInfo="/login"
      onExpire={() =>
        showMsgRef.current("Session expired. Please sign in again.", "error")
      }
    >
      <Header
        variant="authed"
        user={user}
        headerClass={`qr-header ${roleClass}`}
        welcomeClass={`qr-welcome ${roleClass}`}
      />

      {messageComponent}
      <div className="quiz-review-shell">
        <section className="quiz-card">
          <div className="quiz-card-content">
            {hasUnsavedChanges && (
              <div className="unsaved-indicator">
                <span>⚠️ You have unsaved grading changes</span>
              </div>
            )}
            <div className="qr-inner-bar">
              <div className="qr-title">
                <span className="qr-eyebrow">Teacher</span>
                <h2>Review Attempts</h2>
              </div>
              <div className="qr-controls">
                <label className="qr-filter">
                  <span
                    style={{
                      fontSize: ".65rem",
                      color: "var(--qr-text-muted-dark)",
                      marginRight: "0.4rem",
                    }}
                  >
                    Show
                  </span>
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="needs_grading">Needs grading</option>
                    <option value="in_progress">In progress</option>
                    <option value="completed">Completed</option>
                    <option value="all">All</option>
                  </select>
                </label>
                <button className="btn btn-ghost" onClick={() => navigate(-1)}>
                  Back
                </button>
                <button className="btn btn-primary" onClick={loadAttempts}>
                  Reload
                </button>
              </div>
            </div>

            <div className="qr-body">
              <aside
                className="quiz-attempt-list"
                role="listbox"
                aria-label="Attempts"
                ref={listRef}
                tabIndex={0}
                onKeyDown={onListKey}
              >
                {loading ? (
                  <div className="qr-empty">Loading…</div>
                ) : attempts.length ? (
                  <ul>{attemptItems}</ul>
                ) : (
                  <div className="qr-empty">No attempts</div>
                )}
              </aside>

              <section className="attempt-detail">
                {!selected && (
                  <div className="qr-placeholder">
                    Select an attempt to review
                  </div>
                )}

                {selected && (
                  <div className="qr-detail">
                    <div className="attempt-detail-header-sticky">
                      <div className="qr-detail-head">
                        <div>
                          <div className="qr-detail-name">
                            {selected.student_name || selected.student_username}
                          </div>
                          <div className="attempt-meta">
                            Attempt #{selected.attempt_no} • {selected.status}
                          </div>
                        </div>
                        <div className="qr-detail-score">
                          {selected.score != null ? `${selected.score}%` : "—"}
                        </div>
                      </div>
                      <div className="qr-grade-bar">
                        <label className="qr-grade-field">
                          <span>Score %</span>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            className="input"
                            value={gradingScore}
                            onChange={(e) => setGradingScore(e.target.value)}
                          />
                        </label>
                        <input
                          className="input grow"
                          placeholder="Overall comment (optional)"
                          value={gradingComment}
                          onChange={(e) => setGradingComment(e.target.value)}
                        />
                        <button
                          className="btn btn-primary"
                          onClick={submitGrade}
                          disabled={!gradingScore}
                        >
                          Save grade
                        </button>
                      </div>
                    </div>

                    <div className="attempt-answers panel">
                      <h4>Answers & Grading</h4>

                      {/* Show calculated total */}
                      <div className="total-score-display">
                        <span>Calculated Total: </span>
                        <strong>
                          {questions.length > 0
                            ? `${questions.reduce(
                                (sum, q) => sum + (questionScores[q.id] || 0),
                                0,
                              )} / ${questions.length} 
           (${Math.round(
             (questions.reduce(
               (sum, q) => sum + (questionScores[q.id] || 0),
               0,
             ) /
               questions.length) *
               100,
           )}%)`
                            : "—"}
                        </strong>
                      </div>

                      {questions.length === 0 && (
                        <div className="qr-empty-sm">No questions loaded</div>
                      )}

                      {questions.map((q, idx) => {
                        const answer = selected.answers?.[q.id];
                        const grading = selected.grading?.[q.id];
                        const needsManual = q.requiresManualGrading;

                        return (
                          <div key={q.id} className="attempt-question">
                            <div className="question-header">
                              <span className="question-number">
                                Q{idx + 1}
                              </span>
                              <span className="question-text">{q.text}</span>
                              {needsManual && (
                                <span className="manual-badge">Manual</span>
                              )}
                              {!needsManual && grading?.scored && (
                                <span
                                  className={`auto-badge ${
                                    grading.correct ? "correct" : "incorrect"
                                  }`}
                                >
                                  {grading.correct ? "✓ Auto" : "✗ Auto"}
                                </span>
                              )}
                            </div>

                            <div className="answer-section">
                              <div className="student-answer">
                                <strong>Student Answer:</strong>
                                {q.type === "multiple_choice" && q.options ? (
                                  <p>{q.options[parseInt(answer)] || "—"}</p>
                                ) : q.type === "checkboxes" && q.options ? (
                                  <ul>
                                    {(Array.isArray(answer) ? answer : []).map(
                                      (idx: number) => (
                                        <li key={idx}>{q.options![idx]}</li>
                                      ),
                                    )}
                                  </ul>
                                ) : (
                                  <p className="text-answer">{answer || "—"}</p>
                                )}
                              </div>

                              {!needsManual && q.correctAnswer && (
                                <div className="expected-answer">
                                  <strong>Expected:</strong>
                                  {q.type === "multiple_choice" && q.options ? (
                                    <p>
                                      {q.options[parseInt(q.correctAnswer)] ||
                                        "—"}
                                    </p>
                                  ) : q.type === "checkboxes" && q.options ? (
                                    <ul>
                                      {(Array.isArray(q.correctAnswer)
                                        ? q.correctAnswer
                                        : []
                                      ).map((idx: number) => (
                                        <li key={idx}>{q.options![idx]}</li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <p className="text-answer">
                                      {q.correctAnswer || "—"}
                                    </p>
                                  )}
                                </div>
                              )}

                              {/* Score input for EVERY question */}
                              <div className="question-score-input">
                                <label>
                                  <span>Points for this question:</span>
                                  <div className="score-controls">
                                    <div className="score-quick-buttons">
                                      <button
                                        className={`score-btn wrong ${
                                          questionScores[q.id] === 0
                                            ? "active"
                                            : ""
                                        }`}
                                        type="button"
                                        onClick={() => {
                                          setQuestionScores({
                                            ...questionScores,
                                            [q.id]: 0,
                                          });
                                        }}
                                      >
                                        ✗ Wrong
                                      </button>
                                      <button
                                        className={`score-btn correct ${
                                          questionScores[q.id] === 1
                                            ? "active"
                                            : ""
                                        }`}
                                        onClick={() => {
                                          setQuestionScores({
                                            ...questionScores,
                                            [q.id]: 1,
                                          });
                                        }}
                                        type="button"
                                      >
                                        ✓ Correct
                                      </button>
                                    </div>
                                  </div>
                                  <div className="score-input-group">
                                    <span className="score-input-label">
                                      Or enter partial credit:
                                    </span>
                                    <input
                                      type="number"
                                      min={0}
                                      max={1}
                                      step={0.1}
                                      value={questionScores[q.id] ?? 0}
                                      onChange={(e) => {
                                        const value =
                                          parseFloat(e.target.value) || 0;
                                        const clamped = Math.max(
                                          0,
                                          Math.min(1, value),
                                        );
                                        setQuestionScores({
                                          ...questionScores,
                                          [q.id]: clamped,
                                        });
                                      }}
                                    />
                                    <span className="score-max">/ 1</span>
                                  </div>
                                </label>
                              </div>
                            </div>

                            <div className="qr-row feedback-row">
                              <input
                                className="input grow"
                                placeholder="Question feedback (optional)"
                                value={gradingPayload[q.id]?.feedback ?? ""}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setGradingPayload((p) => ({
                                    ...p,
                                    [q.id]: { ...(p[q.id] || {}), feedback: v },
                                  }));
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>
            </div>
          </div>
        </section>
      </div>
    </TokenGuard>
  );
}
