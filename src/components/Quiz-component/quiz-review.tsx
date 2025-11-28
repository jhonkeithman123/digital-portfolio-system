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

type Attempt = {
  id: number | string;
  student_name?: string | null;
  student_username?: string | null;
  attempt_no?: number;
  status?: string;
  score?: number;
  answers?: Record<string, any>;
  grading?: Record<string, any>;
  [k: string]: any;
};

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
  const [filter, setFilter] = useState<string>("needs_grading");

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
      const url = `/quizzes/${classCode}/quizzes/${quizId}/attempts?status=${encodeURIComponent(
        filter
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

  useEffect(() => {
    mountedRef.current = true;
    loadAttempts();
    const onFocus = () => void loadAttempts();
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
  }, [loadAttempts]);

  function openAttempt(a: Attempt) {
    setSelected(a);
    setGradingScore(a.score != null ? String(a.score) : "");
    setGradingComment("");
    setGradingPayload(a.grading || {});
  }

  const submitGrade = useCallback(async (): Promise<void> => {
    if (!selected) return;

    const scoreNum = Number(gradingScore);
    if (!Number.isFinite(scoreNum) || scoreNum < 0 || scoreNum > 100) {
      showMsgRef.current("Score must be 0-100", "error");
      return;
    }

    // optimistic update
    setAttempts((prev) =>
      prev.map((x) => (x.id === selected.id ? { ...x, score: scoreNum } : x))
    );
    try {
      const url = `/quizzes/${classCode}/quizzes/${quizId}/attempts/${selected.id}/grade`;
      const { unauthorized, data } = await apiFetch(url, {
        method: "PATCH",
        body: JSON.stringify({
          score: scoreNum,
          grading: gradingPayload,
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
    [attempts, selected]
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
            <div className="qr-inner-bar">
              <div className="qr-title">
                <span className="qr-eyebrow">Teacher</span>
                <h2>Review Attempts</h2>
              </div>
              <div className="qr-controls">
                <label className="qr-filter">
                  <span
                    style={{
                      fontSize: ".62rem",
                      color: "var(--qr-text-muted-dark)",
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
                      <h4>Answers</h4>
                      {Object.entries(selected.answers || {}).length === 0 && (
                        <div className="qr-empty-sm">No answers</div>
                      )}
                      {Object.entries(selected.answers || {}).map(
                        ([qid, ans]) => (
                          <div key={qid} className="attempt-answer">
                            <div className="qid">Question {qid}</div>
                            <div className="ans">
                              {Array.isArray(ans)
                                ? ans.join(", ")
                                : String(ans)}
                            </div>
                            <div className="qr-row">
                              <input
                                className="input"
                                placeholder="points"
                                value={gradingPayload[qid]?.points ?? ""}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setGradingPayload((p) => ({
                                    ...p,
                                    [qid]: { ...(p[qid] || {}), points: v },
                                  }));
                                }}
                              />
                              <input
                                className="input grow"
                                placeholder="feedback"
                                value={gradingPayload[qid]?.feedback ?? ""}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setGradingPayload((p) => ({
                                    ...p,
                                    [qid]: { ...(p[qid] || {}), feedback: v },
                                  }));
                                }}
                              />
                            </div>
                          </div>
                        )
                      )}
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
