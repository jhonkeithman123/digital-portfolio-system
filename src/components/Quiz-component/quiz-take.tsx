import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiFetch } from "../../utils/apiClient.js";
import TokenGuard from "../auth/tokenGuard.js";
import Header from "../Component-elements/Header.js";
import useMessage from "../../hooks/useMessage.js";
import useConfirm from "../../hooks/useConfirm.js";
import "./css/quiz-take.css";

type Question = {
  id: string | number;
  text?: string;
  type?: string;
  options?: string[];
  sentenceLimit?: number | null;
  [k: string]: any;
};

type Page = {
  id: string;
  title?: string;
  questions: Question[];
  [k: string]: any;
};

type ServerQuiz = {
  id?: string | number;
  title?: string;
  description?: string;
  time_limit_seconds?: number | null;
  attempts_allowed?: number | null;
  attempts_remaining?: number | null;
  questions?: any;
  [k: string]: any;
};

function millisLeft(until: string | number | Date | null): number {
  if (!until) return 0;
  const t = new Date(until).getTime() - Date.now();
  return t > 0 ? t : 0;
}

function formatMs(ms: number | null): string {
  if (ms == null) return "—";
  const s = Math.ceil(ms / 1000);
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

export default function QuizTakePage(): React.ReactElement {
  const { classCode, quizId } = useParams<{
    classCode?: string;
    quizId?: string;
  }>();
  const navigate = useNavigate();
  const { messageComponent, showMessage } = useMessage();
  const [confirm, ConfirmModal] = useConfirm();

  const [loading, setLoading] = useState<boolean>(true);
  const [quiz, setQuiz] = useState<ServerQuiz | null>(null); // server quiz object
  const [pages, setPages] = useState<Page[]>([]);
  const [questionsCount, setQuestionsCount] = useState<number>(0);
  const [, setLastChecked] = useState<number | null>(null);

  // show/hide extra details about the quiz (items, pages, attempts, time)
  const [showDetails, setShowDetails] = useState<boolean>(false);
  const [showWarning, setShowWarning] = useState<boolean>(true);
  const [starting, setStarting] = useState<boolean>(false);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [attemptNo, setAttemptNo] = useState<number | null>(null);
  const [, setExpiresAt] = useState<Date | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({}); // { questionId: value | [values] }
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [result, setResult] = useState<{ score?: number } | null>(null);
  const [timeLeftMs, setTimeLeftMs] = useState<number | null>(null);

  const timerRef = useRef<number | null>(null);
  const mountedRef = useRef<boolean>(true);
  const showMsgRef = useRef(showMessage);

  useEffect(() => {
    showMsgRef.current = showMessage;
  }, [showMessage]);

  const user = React.useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  }, []);

  // parse pages helper
  const parsePages = (raw: any): Page[] => {
    if (!raw) return [{ id: "page-1", title: "Page 1", questions: [] }];
    try {
      const q = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (q && Array.isArray(q.pages))
        return q.pages.map((p: any, i: number) => ({
          id: String(p.id ?? `page-${i + 1}`),
          title: p.title,
          questions: Array.isArray(p.questions) ? p.questions : [],
        }));
      if (Array.isArray(q))
        return [{ id: "page-1", title: "Page 1", questions: q }];
    } catch {
      // fallthrough
    }
    return [{ id: "page-1", title: "Page 1", questions: [] }];
  };

  // load quiz metadata once
  useEffect(() => {
    if (!classCode || !quizId) return;
    mountedRef.current = true;
    const ac = new AbortController();
    setLoading(true);

    (async () => {
      try {
        const { unauthorized, data } = await apiFetch<{
          success?: boolean;
          quiz?: ServerQuiz;
          message?: string;
        }>(`/quizzes/${classCode}/quizzes/${quizId}`, { signal: ac.signal });
        if (!mountedRef.current) return;
        if (unauthorized || !data?.success) {
          showMsgRef.current(data?.message || "Failed to load quiz", "error");
          setLoading(false);
          return;
        }
        const q = data.quiz ?? null;
        setQuiz(q);
        const raw = q?.questions;
        const ps = parsePages(raw);
        setPages(ps);
        setQuestionsCount(
          ps.reduce((a, p) => a + ((p.questions && p.questions.length) || 0), 0)
        );
        setLastChecked(Date.now());
      } catch (err: any) {
        if (err?.name !== "AbortError") {
           
          console.error("Load quiz error", err);
          showMsgRef.current("Server error while loading quiz", "error");
        }
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();

    return () => {
      mountedRef.current = false;
      ac.abort();
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [classCode, quizId]);

  // re-fetch helper used elsewhere
  async function fetchQuiz(): Promise<void> {
    if (!classCode || !quizId) return;
    setLoading(true);
    try {
      const { unauthorized, data } = await apiFetch<{
        success?: boolean;
        quiz?: ServerQuiz;
        message?: string;
      }>(`/quizzes/${classCode}/quizzes/${quizId}`);
      if (unauthorized || !data?.success) {
        showMsgRef.current(data?.message || "Failed to load quiz", "error");
        return;
      }
      const q = data.quiz ?? null;
      setQuiz(q);
      const ps = parsePages(q?.questions);
      setPages(ps);
      setQuestionsCount(
        ps.reduce((a, p) => a + ((p.questions && p.questions.length) || 0), 0)
      );
      setLastChecked(Date.now());
    } catch (err) {
       
      console.error("Load quiz error", err);
      showMsgRef.current("Server error while loading quiz", "error");
    } finally {
      setLoading(false);
    }
  }

  // periodic refetch on focus/visibility
  useEffect(() => {
    const onFocus = () => void fetchQuiz();
    const onVisibility = () => {
      if (!document.hidden) fetchQuiz();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [classCode, quizId]);

  // start attempt
  async function startAttempt(): Promise<void> {
    if (!quiz || !classCode || !quizId) return;
    setStarting(true);
    try {
      const { unauthorized, data } = await apiFetch(
        `/quizzes/${classCode}/quizzes/${quizId}/attempt`,
        { method: "POST" }
      );
      if (unauthorized || !data?.success) {
        showMsgRef.current(data?.message || "Failed to start attempt", "error");
        await fetchQuiz();
        setStarting(false);
        return;
      }
      setAttemptId(String(data.attemptId ?? ""));
      setAttemptNo(data.attemptNo ?? null);
      await fetchQuiz();
      const exp = data.expiresAt
        ? new Date(data.expiresAt)
        : quiz.time_limit_seconds
        ? new Date(Date.now() + quiz.time_limit_seconds * 1000)
        : null;
      setExpiresAt(exp);
      if (exp) {
        setTimeLeftMs(millisLeft(exp));
        if (timerRef.current) window.clearInterval(timerRef.current);
        timerRef.current = window.setInterval(() => {
          const left = millisLeft(exp);
          setTimeLeftMs(left);
          if (left <= 0) {
            if (timerRef.current) window.clearInterval(timerRef.current);
            showMsgRef.current("Time expired. Submitting attempt.", "info");
            void submitAttempt();
          }
        }, 500) as unknown as number;
      }
      setShowWarning(false);
      setCurrentPage(0);
    } catch (err) {
       
      console.error("Start attempt error", err);
      showMsgRef.current("Server error while starting attempt", "error");
    } finally {
      setStarting(false);
    }
  }

  function updateAnswer(q: Question, value: any) {
    setAnswers((prev) => ({ ...prev, [String(q.id)]: value }));
  }

  function toggleCheckbox(q: Question, optionIndex: number) {
    setAnswers((prev) => {
      const cur = Array.isArray(prev[String(q.id)])
        ? [...prev[String(q.id)]]
        : [];
      const idx = cur.indexOf(optionIndex);
      if (idx >= 0) cur.splice(idx, 1);
      else cur.push(optionIndex);
      return { ...prev, [String(q.id)]: cur };
    });
  }

  async function submitAttempt(): Promise<void> {
    if (!attemptId) {
      showMsgRef.current("No active attempt", "error");
      return;
    }
    setSubmitting(true);
    try {
      const payload = { attemptId, answers };
      const { unauthorized, data } = await apiFetch(
        `/quizzes/${classCode}/quizzes/${quizId}/submit`,
        { method: "POST", body: JSON.stringify(payload) }
      );
      if (unauthorized || !data?.success) {
        showMsgRef.current(
          data?.message || "Failed to submit attempt",
          "error"
        );
      } else {
        setResult({ score: data.score });
        showMsgRef.current("Attempt submitted", "success");
        if (timerRef.current) window.clearInterval(timerRef.current);
      }
    } catch (err) {
       
      console.error("Submit attempt error", err);
      showMsgRef.current("Server error while submitting attempt", "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading)
    return (
      <div className="quiz-take-shell">
        <section className="quiz-card">
          <div className="quiz-card-content">
            <div style={{ padding: 16 }}>Loading quiz…</div>
            {messageComponent}
          </div>
        </section>
      </div>
    );
  if (!quiz)
    return (
      <div className="quiz-take-shell">
        <section className="quiz-card">
          <div className="quiz-card-content">
            <div style={{ padding: 16 }}>Quiz not found</div>
            {messageComponent}
          </div>
        </section>
      </div>
    );

  const pg = pages[currentPage] || { title: "Page", questions: [] };
  const roleClass = user?.role === "teacher" ? "teacher" : "student";

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
        section={user?.role === "teacher" ? user?.section : null}
        headerClass={`qt-header ${roleClass}`}
        welcomeClass={`qt-header ${roleClass}`}
      />

      {messageComponent}
      <ConfirmModal />

      <div className="quiz-take-shell">
        <section className="quiz-card">
          <div className="quiz-card-content">
            <div className="quiz-header">
              <div>
                <h2>{quiz.title}</h2>
                <div className="quiz-meta">
                  {questionsCount} item{questionsCount !== 1 ? "s" : ""} •
                  Attempts:{" "}
                  {quiz.attempts_remaining != null
                    ? `${quiz.attempts_remaining} remaining of ${quiz.attempts_allowed}`
                    : quiz.attempts_allowed ?? "—"}{" "}
                  • Time:{" "}
                  {quiz.time_limit_seconds
                    ? `${Math.ceil(quiz.time_limit_seconds / 60)} min`
                    : "—"}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  marginLeft: "1rem",
                }}
              >
                <button
                  className="quiz-action-btn"
                  onClick={() => setShowDetails((s) => !s)}
                >
                  {showDetails ? "Hide details" : "Show details"}
                </button>
              </div>
            </div>

            {showDetails && (
              <div
                style={{
                  padding: 12,
                  border: "1px solid #eee",
                  borderRadius: 6,
                  marginBottom: 12,
                }}
              >
                <div>
                  <strong>Pages:</strong> {pages.length}
                </div>
                <div>
                  <strong>Items:</strong> {questionsCount}
                </div>
                <div>
                  <strong>Attempts allowed:</strong>{" "}
                  {quiz.attempts_allowed ?? "—"}
                </div>
                <div>
                  <strong>Time limit:</strong>{" "}
                  {quiz.time_limit_seconds
                    ? `${Math.ceil(quiz.time_limit_seconds / 60)} min`
                    : "—"}
                </div>
                <div style={{ marginTop: 8, color: "#666" }}>
                  {quiz.description}
                </div>
              </div>
            )}
            <div className="quiz-header">
              <div className="right">
                {attemptId ? (
                  <div>
                    <div>Attempt #{attemptNo}</div>
                    <div className="timer">
                      Time left: {formatMs(timeLeftMs)}
                    </div>
                  </div>
                ) : (
                  <div className="right" style={{ color: "#b33" }}>
                    Attempts allowed: {quiz.attempts_allowed ?? "—"}
                  </div>
                )}
              </div>
            </div>

            {/* Warning before starting */}
            {showWarning && (
              <div className="quiz-warning">
                <strong>Warning</strong>
                <p>
                  You have a limited number of attempts (
                  {quiz.attempts_allowed ?? "—"}). When you start, your attempt
                  timer will begin. You will see one page at a time. Make sure
                  you are ready before starting.
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    className="quiz-button"
                    onClick={() => navigate("/home")}
                  >
                    Cancel
                  </button>
                  <button
                    className="quiz-button"
                    onClick={async () => {
                      if (starting) return;
                      const ok = await confirm({
                        title: "Start attempt",
                        message:
                          "Starting will consume one of your allowed attempts and begin the timer. Continue?",
                        confirmText: "Start",
                        cancelText: "Cancel",
                      });
                      if (!ok) return;
                      await startAttempt();
                    }}
                    disabled={starting || quiz.attempts_remaining === 0}
                  >
                    {starting ? "Starting…" : "Start Attempt"}
                  </button>
                </div>
              </div>
            )}

            {/* If result after submit */}
            {result && (
              <div className="quiz-result">
                <h3>Result</h3>
                <p>
                  Your score: <strong>{result.score}%</strong>
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    className="quiz-button"
                    onClick={() => navigate("/home")}
                  >
                    Back
                  </button>
                </div>
              </div>
            )}

            {/* Quiz pages (only visible when an attempt started and not submitted) */}
            {!showWarning && !result && (
              <div className="quiz-page">
                <div className="page-title">{pg.title}</div>
                <div>
                  {pg.questions.map((q, qi) => (
                    <div key={String(q.id)} className="quiz-question">
                      <div className="q-text">
                        <strong>{qi + 1}. </strong>
                        {q.text}
                      </div>

                      {/* Multiple choice */}
                      {q.type === "multiple_choice" &&
                        Array.isArray(q.options) && (
                          <div className="q-options">
                            {q.options.map((opt: any, oi: number) => (
                              <label key={oi}>
                                <input
                                  type="radio"
                                  name={String(q.id)}
                                  checked={String(answers[q.id]) === String(oi)}
                                  onChange={() => updateAnswer(q, String(oi))}
                                />{" "}
                                {opt}
                              </label>
                            ))}
                          </div>
                        )}

                      {/* Checkboxes */}
                      {q.type === "checkboxes" && Array.isArray(q.options) && (
                        <div className="q-options">
                          {q.options.map((opt, oi) => {
                            const cur = Array.isArray(answers[q.id])
                              ? answers[q.id]
                              : [];
                            return (
                              <label key={oi}>
                                <input
                                  type="checkbox"
                                  checked={cur.includes(oi)}
                                  onChange={() => toggleCheckbox(q, oi)}
                                />{" "}
                                {opt}
                              </label>
                            );
                          })}
                        </div>
                      )}

                      {/* Short answer */}
                      {q.type === "short_answer" && (
                        <div>
                          <input
                            className="q-input"
                            type="text"
                            value={answers[q.id] ?? ""}
                            onChange={(e) => updateAnswer(q, e.target.value)}
                            placeholder="Type your answer"
                          />
                          <div className="small-muted">
                            Sentences allowed: {q.sentenceLimit ?? 1}
                          </div>
                        </div>
                      )}

                      {/* Paragraph */}
                      {q.type === "paragraph" && (
                        <div>
                          <textarea
                            className="q-textarea"
                            rows={4}
                            value={answers[q.id] ?? ""}
                            onChange={(e) => updateAnswer(q, e.target.value)}
                            placeholder="Write your answer..."
                          />
                          <div className="small-muted">
                            Sentences required: {q.sentenceLimit ?? 3}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="quiz-controls">
                  <div>
                    <button
                      className="quiz-action-btn"
                      onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                      disabled={currentPage === 0}
                    >
                      ← Prev
                    </button>
                  </div>

                  <div
                    style={{ display: "flex", gap: 8, alignItems: "center" }}
                  >
                    <div className="small-muted">
                      Page {currentPage + 1} / {pages.length}
                    </div>

                    {currentPage < pages.length - 1 ? (
                      <button
                        className="quiz-action-btn"
                        onClick={() =>
                          setCurrentPage((p) =>
                            Math.min(p + 1, pages.length - 1)
                          )
                        }
                      >
                        Next →
                      </button>
                    ) : (
                      <button
                        className="quiz-action-btn view"
                        onClick={async () => {
                          const ok = await confirm({
                            title: "Submit attempt",
                            message:
                              "Submit attempt now? This will end your attempt.",
                            confirmText: "Submit",
                            cancelText: "Cancel",
                          });
                          if (ok) submitAttempt();
                        }}
                        disabled={submitting}
                      >
                        {submitting ? "Submitting…" : "Submit Attempt"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </TokenGuard>
  );
}
