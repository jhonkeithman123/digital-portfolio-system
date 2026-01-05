import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../../utils/apiClient";
import QuizTimer from "./QuizTimer";
import Header from "../Component-elements/Header";
import useMessage from "../../hooks/useMessage";
import TokenGuard from "../auth/tokenGuard";
import "./css/quiz-attempt.css";

type Status = "idle" | "loading" | "ready" | "error";

type Page = {
  id: string;
  title: string;
  questions: unknown[];
};

type Quiz = {
  id?: string | number;
  title: string;
  description?: string;
  timeLimitSeconds?: number | null;
  attemptsAllowed?: number | null;
  attemptsRemaining?: number | null;
  attemptsUsed?: number | null;
  pages: Page[];
};

export default function QuizAttempt(): React.ReactElement {
  const { classCode, quizId } = useParams<{
    classCode?: string;
    quizId?: string;
  }>();
  const navigate = useNavigate();
  const { messageComponent, showMessage } = useMessage();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [status, setStatus] = useState<Status>("idle"); //* idle | loading | ready | error
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [pageIndex, setPageIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, any>>({}); // {questionId: value}
  const [starting, setStarting] = useState<boolean>(false);

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

  const normalizePages = (rawPages: any): Page[] => {
    if (!Array.isArray(rawPages) || !rawPages.length) {
      return [{ id: "page-1", title: "Page 1", questions: [] }];
    }
    return rawPages.map((p: any, i: number) => ({
      id: p.id || `page-${i + 1}`,
      title: p.title || `Page ${i + 1}`,
      questions: Array.isArray(p.questions) ? p.questions : [],
    }));
  };

  const loadQuiz = useCallback(
    async (signal?: AbortSignal) => {
      setStatus("loading");
      try {
        const { unauthorized, data } = await apiFetch(
          `/quizzes/${classCode}/quizzes/${quizId}`,
          { signal }
        );

        if (unauthorized) {
          showMsgRef.current("Session expired. Please sign in again.", "error");
          setStatus("error");
          return;
        }

        if (!data?.success) {
          showMsgRef.current(data?.message || "Cannot load quiz", "error");
          setStatus("error");
          return;
        }

        const pages = normalizePages(
          data.quiz?.questions?.pages ?? data.quiz?.questions
        );
        const attemptsRemaining = data.quiz?.attempts_remaining ?? null;
        const attemptsUsed = data.quiz?.attempts_used ?? null;

        setQuiz({
          id: data.quiz.id,
          title: data.quiz.title || "Untitled Quiz",
          description: data.quiz.description || "",
          timeLimitSeconds: data.quiz.time_limit_seconds ?? null,
          attemptsAllowed: data.quiz.attempts_allowed ?? null,
          attemptsRemaining,
          attemptsUsed,
          pages,
        });
        setStatus("ready");

        if (attemptsRemaining === 0) {
          showMsgRef.current("No attempts remaining for this quiz.", "error");
        }
      } catch (err: unknown) {
        if ((err as any)?.name !== "AbortError") {
          showMsgRef.current("Network error loading quiz", "error");
          setStatus("error");
        }
      }
    },
    [classCode, quizId]
  );

  useEffect(() => {
    const ctrl = new AbortController();
    loadQuiz(ctrl.signal);
    return () => ctrl.abort();
  }, [loadQuiz]);

  const startAttempt = useCallback(async () => {
    if (!quiz) return;
    if (quiz.attemptsRemaining === 0) {
      showMsgRef.current("Cannot start: attempts exhausted.", "error");
      return;
    }

    setStarting(true);
    try {
      const { unauthorized, data } = await apiFetch(
        `/quizzes/${classCode}/quizzes/${quizId}/attempt`,
        { method: "POST" }
      );

      if (unauthorized) {
        showMsgRef.current("Session expired. Please sign in again.", "error");
        return;
      }

      if (data?.success) {
        setAttemptId(data.attemptId ?? "");
        setExpiresAt(data.expiresAt ? new Date(data.expiresAt) : null);
        showMsgRef.current("Attempt started.", "success");
      } else {
        showMsgRef.current(data?.message || "Could not start attempt", "error");
      }
    } finally {
      setStarting(false);
    }
  }, [quiz, classCode, quizId]);

  const setAnswer = useCallback((qId: string | null, value: any) => {
    setAnswers((prev) => ({ ...prev, [String(qId)]: value }));
  }, []);

  const submitAttempt = useCallback(async () => {
    if (!attemptId) return;

    const { unauthorized, data } = await apiFetch(
      `/quizzes/${classCode}/quizzes/${quizId}/submit`,
      { method: "POST", body: JSON.stringify({ attemptId, answers }) }
    );
    if (unauthorized) {
      showMsgRef.current("Session expired. Please sign in again.", "error");
      return;
    }
    if (data?.success) {
      showMsgRef.current(`Submitted. Score: ${data.score}%`, "success");

      setTimeout(() => {
        navigate(`/quizzes/${classCode}/quizzes/${quizId}/attempts`);
      }, 600);
    } else {
      showMsgRef.current(
        "Submit failed: " + (data?.message || "Unknown error"),
        "error"
      );
    }
  }, [attemptId, answers, classCode, quizId, navigate]);

  if (status === "loading" || status === "idle") {
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
          section={user?.role === "student" ? user?.section : null}
          headerClass="qa-header minimal"
          welcomeClass="qa-welcome"
        />
        {messageComponent}
        <div className="quiz-shell">
          <section className="quiz-attempt-card loading">
            <div className="qa-loading-row">
              <div className="qa-skeleton title" />
              <div className="qa-skeleton line" />
              <div className="qa-skeleton line short" />
            </div>
          </section>
        </div>
      </TokenGuard>
    );
  }

  if (status === "error") {
    return (
      <TokenGuard redirectInfo="/login">
        <Header
          variant="authed"
          user={user}
          section={user?.role === "student" ? user?.section : null}
          headerClass="qa-header minimal"
          welcomeClass="qa-welcome"
        />
        {messageComponent}
        <div className="quiz-shell">
          <section className="quiz-attempt-card error">
            <div className="qa-error">
              Failed to load quiz.
              <button
                className="quiz-btn retry"
                onClick={() => void loadQuiz()}
              >
                Retry
              </button>
            </div>
          </section>
        </div>
      </TokenGuard>
    );
  }

  const page = quiz!.pages[pageIndex] || { questions: [] };
  const roleClass = user?.role === "teacher" ? "teacher-role" : "student-role";

  const isAnswered = (q: any) => {
    const val = answers[q.id];

    switch (q.type) {
      case "multiple_choice":
        return val !== undefined && val !== "" && val !== null;
      case "checkboxes":
        return Array.isArray(val) && val.length > 0;
      case "short_answer":
        return typeof val === "string" && val.trim().length > 0;
      default:
        return val != null;
    }
  };

  const totalCount = quiz!.pages.reduce(
    (acc, pg) => acc + (pg.questions?.length || 0),
    0
  );

  const answeredCount = quiz!.pages.reduce(
    (acc, pg) => acc + (pg.questions || []).filter((q) => isAnswered(q)).length,
    0
  );

  const allAnswered =
    attemptId && answeredCount === totalCount && totalCount > 0;

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
        section={user?.role === "student" ? user?.section : null}
        headerClass={`qa-header ${roleClass}`}
        welcomeClass={`qa-welcome ${roleClass}`}
      />

      {messageComponent}
      <div className="quiz-shell">
        <section className="quiz-attempt-card ready">
          <header className="qa-top-bar">
            <div className="qa-left">
              <h2 className="qa-title">{quiz!.title}</h2>
              {quiz!.description && (
                <div className="qa-desc">{quiz!.description}</div>
              )}
              <div className="qa-attempt-info">
                {quiz!.attemptsAllowed != null && (
                  <span>
                    Attempts: {quiz!.attemptsUsed}/{quiz!.attemptsAllowed}{" "}
                    {quiz!.attemptsRemaining === 0 && (
                      <strong className="qa-none-left">None left</strong>
                    )}
                  </span>
                )}
                {quiz!.timeLimitSeconds && (
                  <span>
                    Time limit: {Math.ceil(quiz!.timeLimitSeconds / 60)} min
                  </span>
                )}
              </div>
            </div>
            <div className="qa-right">
              {expiresAt && attemptId && (
                <span className="quiz-timer-pill">
                  <QuizTimer
                    expiresAt={new Date(expiresAt)}
                    onExpire={() =>
                      showMsgRef.current(
                        "Time's up — submitting automatically",
                        "info"
                      )
                    }
                  />
                </span>
              )}
              <div className="qa-page-indicator">
                Page {pageIndex + 1} / {quiz!.pages.length}
              </div>
            </div>
          </header>

          <main className="quiz-attempt-body">
            {!attemptId ? (
              <div className="qa-start-wrap">
                <button
                  className="quiz-btn primary"
                  onClick={startAttempt}
                  disabled={starting || quiz!.attemptsRemaining === 0}
                >
                  {starting ? "Starting…" : "Start attempt"}
                </button>
                <button
                  className="qa-action-btn back"
                  onClick={() => navigate("/home")}
                >
                  ← Back to Home
                </button>
              </div>
            ) : (
              <>
                <div className="quiz-page-title">
                  {page.title || `Page ${pageIndex + 1}`}
                </div>
                <div className="qa-questions-grid">
                  {page.questions.map((q: any) => (
                    <article key={q.id} className="quiz-question-card">
                      <div className="quiz-question-text">{q.text}</div>

                      {q.type === "multiple_choice" &&
                        (q.options || []).map((opt: any, oi: number) => (
                          <label key={oi} className="q-option">
                            <input
                              type="radio"
                              name={q.id}
                              value={oi}
                              checked={String(answers[q.id]) === String(oi)}
                              onChange={() => setAnswer(q.id, String(oi))}
                            />{" "}
                            {opt}
                          </label>
                        ))}

                      {q.type === "checkboxes" &&
                        (q.options || []).map((opt: any, oi: number) => {
                          const arr = answers[q.id] || [];
                          const checked =
                            Array.isArray(arr) && arr.includes(String(oi));
                          return (
                            <label key={oi} className="q-option">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  const set = new Set(
                                    Array.isArray(arr) ? arr : []
                                  );
                                  if (e.target.checked) set.add(String(oi));
                                  else set.delete(String(oi));
                                  setAnswer(q.id, Array.from(set));
                                }}
                              />{" "}
                              {opt}
                            </label>
                          );
                        })}

                      {(q.type === "short_answer" ||
                        q.type === "paragraph") && (
                        <textarea
                          className="quiz-textarea quiz-free-input"
                          value={answers[q.id] || ""}
                          onChange={(e) => setAnswer(q.id, e.target.value)}
                          rows={q.type === "paragraph" ? 5 : 2}
                        />
                      )}
                    </article>
                  ))}
                </div>

                <footer className="quiz-footer">
                  <div className="qa-nav">
                    <button
                      className="quiz-btn subtle"
                      onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
                      disabled={pageIndex === 0}
                    >
                      Prev
                    </button>
                    <button
                      className="quiz-btn subtle"
                      onClick={() =>
                        setPageIndex((i) =>
                          Math.min(quiz!.pages.length - 1, i + 1)
                        )
                      }
                      disabled={pageIndex >= quiz!.pages.length - 1}
                    >
                      Next
                    </button>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: "10px",
                      alignItems: "center",
                    }}
                  >
                    <span
                      className="qa-progress"
                      style={{ fontSize: ".65rem", letterSpacing: ".5px" }}
                    >
                      Answered {answeredCount}/{totalCount}
                    </span>
                    <button
                      className="quiz-btn primary"
                      onClick={submitAttempt}
                      disabled={!attemptId || !allAnswered}
                      title={
                        !attemptId
                          ? "Start attempt first"
                          : allAnswered
                          ? "Submit answers"
                          : "Answer all questions to submit"
                      }
                    >
                      Submit
                    </button>
                  </div>
                </footer>
              </>
            )}
          </main>
        </section>
      </div>
    </TokenGuard>
  );
}
