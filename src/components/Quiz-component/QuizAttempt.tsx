import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "utils/apiClient";
import QuizTimer from "./QuizTimer";
import Header from "components/Component-elements/Header";
import useMessage from "hooks/useMessage";
import useConfirm from "hooks/useConfirm";
import TokenGuard from "components/auth/tokenGuard";
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

type ActiveAttempt = {
  attemptId: string;
  expiresAt: string | Date;
  answers?: Record<string, any>;
  pageIndex?: number;
};

export default function QuizAttempt(): React.ReactElement {
  const { classCode, quizId } = useParams<{
    classCode?: string;
    quizId?: string;
  }>();
  const navigate = useNavigate();
  const { messageComponent, showMessage } = useMessage();
  const [confirm, ConfirmModal] = useConfirm();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [pageIndex, setPageIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [starting, setStarting] = useState<boolean>(false);
  const [showDetails, setShowDetails] = useState<boolean>(false);
  const [hasActiveAttempt, setHasActiveAttempt] = useState<boolean>(false);

  const showMsgRef = useRef(showMessage);
  const autoSaveTimerRef = useRef<number | null>(null);

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

  const attemptStorageKey = `quiz_attempt_${classCode}_${quizId}`;

  const saveAttemptToStorage = useCallback(
    (data: ActiveAttempt) => {
      try {
        localStorage.setItem(attemptStorageKey, JSON.stringify(data));
      } catch (err) {
        console.error("[QuizAttempt] Failed to save to storage:", err);
      }
    },
    [attemptStorageKey],
  );

  const loadAttemptFromStorage = useCallback((): ActiveAttempt | null => {
    try {
      const stored = localStorage.getItem(attemptStorageKey);
      if (!stored) return null;
      return JSON.parse(stored) as ActiveAttempt;
    } catch {
      return null;
    }
  }, [attemptStorageKey]);

  const clearAttemptStorage = useCallback(() => {
    try {
      localStorage.removeItem(attemptStorageKey);
    } catch (err) {
      console.error("[QuizAttempt] Failed to clear storage:", err);
    }
  }, [attemptStorageKey]);

  useEffect(() => {
    if (!attemptId) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = window.setTimeout(() => {
      saveAttemptToStorage({
        attemptId,
        expiresAt: expiresAt?.toISOString() || new Date().toISOString(),
        answers,
        pageIndex,
      });
    }, 1000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [attemptId, expiresAt, answers, pageIndex, saveAttemptToStorage]);

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

  const checkActiveAttempt =
    useCallback(async (): Promise<ActiveAttempt | null> => {
      try {
        const { unauthorized, data } = await apiFetch(
          `/quizzes/${classCode}/quizzes/${quizId}/active-attempt`,
        );

        if (unauthorized || !data?.success || !data?.attempt) {
          return null;
        }

        return {
          attemptId: data.attempt.id,
          expiresAt: data.attempt.expires_at,
          answers: data.attempt.answers || {},
          pageIndex: data.attempt.page_index || 0,
        };
      } catch (err) {
        console.error("[QuizAttempt] Failed to check active attempt:", err);
        return null;
      }
    }, [classCode, quizId]);

  const loadQuiz = useCallback(
    async (signal?: AbortSignal) => {
      setStatus("loading");

      try {
        const { unauthorized, data } = await apiFetch(
          `/quizzes/${classCode}/quizzes/${quizId}`,
          { signal },
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
          data.quiz?.questions?.pages ?? data.quiz?.questions,
        );

        setQuiz({
          id: data.quiz.id,
          title: data.quiz.title || "Untitled Quiz",
          description: data.quiz.description || "",
          timeLimitSeconds: data.quiz.time_limit_seconds ?? null,
          attemptsAllowed: data.quiz.attempts_allowed ?? null,
          attemptsRemaining: data.quiz.attempts_remaining ?? null,
          attemptsUsed: data.quiz.attempts_used ?? null,
          pages,
        });
        setStatus("ready");

        // Check if there's an active attempt
        const serverAttempt = await checkActiveAttempt();
        setHasActiveAttempt(!!serverAttempt);
      } catch (err: unknown) {
        if ((err as any)?.name !== "AbortError") {
          showMsgRef.current("Network error loading quiz", "error");
          setStatus("error");
        }
      }
    },
    [classCode, quizId, checkActiveAttempt],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    loadQuiz(ctrl.signal);
    return () => ctrl.abort();
  }, [loadQuiz]);

  const startAttempt = useCallback(async () => {
    if (!quiz) return;

    // Show confirmation if starting fresh
    const serverAttempt = await checkActiveAttempt();
    const storedAttempt = loadAttemptFromStorage();

    if (!serverAttempt && !storedAttempt) {
      if (quiz.attemptsRemaining === 0) {
        showMsgRef.current("Cannot start: attempts exhausted.", "error");
        return;
      }

      const ok = await confirm({
        title: "Start Quiz Attempt",
        message: `This will use 1 of your ${quiz.attemptsRemaining} remaining attempts. Are you ready?`,
        confirmText: "Start Attempt",
        cancelText: "Cancel",
      });

      if (!ok) return;
    }

    setStarting(true);
    try {
      if (serverAttempt) {
        console.log("[QuizAttempt] Resuming attempt from server");
        setAttemptId(serverAttempt.attemptId);
        setExpiresAt(new Date(serverAttempt.expiresAt));
        setAnswers(serverAttempt.answers || {});
        setPageIndex(serverAttempt.pageIndex || 0);
        saveAttemptToStorage(serverAttempt);
        showMsgRef.current("Resuming your active attempt", "info");
        return;
      }

      if (storedAttempt) {
        const expiryDate = new Date(storedAttempt.expiresAt);
        if (expiryDate > new Date()) {
          console.log("[QuizAttempt] Resuming attempt from storage");
          setAttemptId(storedAttempt.attemptId);
          setExpiresAt(expiryDate);
          setAnswers(storedAttempt.answers || {});
          setPageIndex(storedAttempt.pageIndex || 0);
          showMsgRef.current("Resuming your saved attempt", "info");
          return;
        } else {
          console.log("[QuizAttempt] Stored attempt expired, clearing");
          clearAttemptStorage();
        }
      }

      const { unauthorized, data } = await apiFetch(
        `/quizzes/${classCode}/quizzes/${quizId}/attempt`,
        { method: "POST" },
      );

      if (unauthorized) {
        showMsgRef.current("Session expired. Please sign in again.", "error");
        return;
      }

      if (data?.success) {
        const newAttemptId = data.attemptId ?? "";
        const newExpiresAt = data.expiresAt ? new Date(data.expiresAt) : null;

        setAttemptId(newAttemptId);
        setExpiresAt(newExpiresAt);
        setAnswers({});
        setPageIndex(0);

        if (newExpiresAt) {
          saveAttemptToStorage({
            attemptId: newAttemptId,
            expiresAt: newExpiresAt.toISOString(),
            answers: {},
            pageIndex: 0,
          });
        }

        showMsgRef.current("Attempt started.", "success");
      } else {
        showMsgRef.current(data?.message || "Could not start attempt", "error");
      }
    } finally {
      setStarting(false);
    }
  }, [
    quiz,
    classCode,
    quizId,
    checkActiveAttempt,
    loadAttemptFromStorage,
    saveAttemptToStorage,
    clearAttemptStorage,
    confirm,
  ]);

  const setAnswer = useCallback((qId: string | null, value: any) => {
    setAnswers((prev) => ({ ...prev, [String(qId)]: value }));
  }, []);

  const submitAttempt = useCallback(async () => {
    if (!attemptId) return;

    const ok = await confirm({
      title: "Submit Quiz",
      message:
        "Are you sure you want to submit? You cannot change your answers after submission.",
      confirmText: "Submit",
      cancelText: "Cancel",
    });

    if (!ok) return;

    const { unauthorized, data } = await apiFetch(
      `/quizzes/${classCode}/quizzes/${quizId}/submit`,
      { method: "POST", body: JSON.stringify({ attemptId, answers }) },
    );

    if (unauthorized) {
      showMsgRef.current("Session expired. Please sign in again.", "error");
      return;
    }

    if (data?.success) {
      clearAttemptStorage();

      const score = data.score;
      const needsGrading = data.needsGrading || score === null;

      if (needsGrading) {
        showMsgRef.current(
          "Submitted! Your answers are being graded.",
          "success",
        );
      } else {
        showMsgRef.current(`Submitted! Score: ${score}%`, "success");
      }

      // Reset to quiz info view
      setAttemptId(null);
      setExpiresAt(null);
      setAnswers({});
      setPageIndex(0);
      await loadQuiz();
    } else {
      showMsgRef.current(
        "Submit failed: " + (data?.message || "Unknown error"),
        "error",
      );
    }
  }, [
    attemptId,
    answers,
    classCode,
    quizId,
    clearAttemptStorage,
    loadQuiz,
    confirm,
  ]);

  const handleTimeExpire = useCallback(async () => {
    showMsgRef.current("Time's up! Submitting your answers...", "info");
    await submitAttempt();
  }, [submitAttempt]);

  useEffect(() => {
    if (!attemptId) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
      return "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [attemptId]);

  const roleClass = user?.role === "teacher" ? "teacher-role" : "student-role";

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
          headerClass={`qa-header ${roleClass}`}
          welcomeClass={`qa-welcome ${roleClass}`}
        />
        {messageComponent}
        <ConfirmModal />
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
          headerClass={`qa-header ${roleClass}`}
          welcomeClass={`qa-welcome ${roleClass}`}
        />
        {messageComponent}
        <ConfirmModal />
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
  const totalCount = quiz!.pages.reduce(
    (acc, pg) => acc + (pg.questions?.length || 0),
    0,
  );

  const isAnswered = (q: any) => {
    const val = answers[q.id];
    switch (q.type) {
      case "multiple_choice":
        return val !== undefined && val !== "" && val !== null;
      case "checkboxes":
        return Array.isArray(val) && val.length > 0;
      case "short_answer":
      case "paragraph":
        return typeof val === "string" && val.trim().length > 0;
      default:
        return val != null;
    }
  };

  const answeredCount = quiz!.pages.reduce(
    (acc, pg) => acc + (pg.questions || []).filter((q) => isAnswered(q)).length,
    0,
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
      <div className="quiz-attempt-page">
        {messageComponent}

        <Header
          variant="authed"
          user={user}
          section={user?.role === "student" ? user?.section : null}
          headerClass={`header-normal ${roleClass}`}
          welcomeClass={`welcome-normal ${roleClass}`}
        />
        <ConfirmModal />

        <div className="quiz-shell">
          <section className="quiz-attempt-card ready">
            <header className="qa-top-bar">
              <div className="qa-left">
                <h2 className="qa-title">{quiz!.title}</h2>
                {quiz!.description && (
                  <div className="qa-desc">{quiz!.description}</div>
                )}
                <div className="qa-attempt-info">
                  <span>{totalCount} items</span>
                  {quiz!.attemptsAllowed != null && (
                    <span>
                      Attempts: {quiz!.attemptsUsed}/{quiz!.attemptsAllowed}{" "}
                      {quiz!.attemptsRemaining === 0 && (
                        <strong className="qa-none-left">(None left)</strong>
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
                {!attemptId && (
                  <button
                    className="quiz-btn subtle small"
                    onClick={() => setShowDetails((s) => !s)}
                  >
                    {showDetails ? "Hide Details" : "Show Details"}
                  </button>
                )}
                {expiresAt && attemptId && (
                  <div className="quiz-timer-container">
                    <QuizTimer
                      expiresAt={new Date(expiresAt)}
                      onExpire={handleTimeExpire}
                    />
                  </div>
                )}
                {attemptId && (
                  <div className="qa-page-indicator">
                    Page {pageIndex + 1} / {quiz!.pages.length}
                  </div>
                )}
              </div>
            </header>

            {showDetails && !attemptId && (
              <div className="qa-details-box">
                <div>
                  <strong>Pages:</strong> {quiz!.pages.length}
                </div>
                <div>
                  <strong>Total Items:</strong> {totalCount}
                </div>
                {quiz!.description && (
                  <div className="qa-desc-detail">{quiz!.description}</div>
                )}
              </div>
            )}

            {hasActiveAttempt && !attemptId && (
              <div className="qa-resume-notice">
                <div className="qa-notice-icon">⚠️</div>
                <div className="qa-notice-content">
                  <strong>You have an active attempt in progress!</strong>
                  <p>
                    Click "Continue Attempt" below to resume where you left off.
                  </p>
                </div>
              </div>
            )}

            <main className="quiz-attempt-body">
              {!attemptId ? (
                <div className="qa-start-wrap">
                  <button
                    className="quiz-btn primary"
                    onClick={startAttempt}
                    disabled={starting || quiz!.attemptsRemaining === 0}
                  >
                    {starting
                      ? "Starting…"
                      : hasActiveAttempt
                        ? "Continue Attempt"
                        : "Start Attempt"}
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
                  <div className="qa-progress-bar-container">
                    <div className="qa-progress-bar-wrapper">
                      <div
                        className="qa-progress-bar-fill"
                        style={{
                          width: `${totalCount > 0 ? (answeredCount / totalCount) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <span className="qa-progress-text">
                      {answeredCount} / {totalCount} answered
                    </span>
                  </div>

                  <div className="quiz-page-title">
                    {page.title || `Page ${pageIndex + 1}`}
                  </div>
                  <div className="qa-questions-grid">
                    {page.questions.map((q: any) => (
                      <article key={q.id} className="quiz-question-card">
                        <div className="quiz-question-text">
                          {q.text}
                          {!isAnswered(q) && (
                            <span className="question-required">*</span>
                          )}
                        </div>

                        {q.type === "multiple_choice" &&
                          (q.options || []).map((opt: any, oi: number) => (
                            <label key={oi} className="q-option">
                              <input
                                type="radio"
                                name={q.id}
                                value={oi}
                                checked={String(answers[q.id]) === String(oi)}
                                onChange={() => setAnswer(q.id, String(oi))}
                              />
                              <span className="q-option-text">{opt}</span>
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
                                      Array.isArray(arr) ? arr : [],
                                    );
                                    if (e.target.checked) set.add(String(oi));
                                    else set.delete(String(oi));
                                    setAnswer(q.id, Array.from(set));
                                  }}
                                />
                                <span className="q-option-text">{opt}</span>
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
                            placeholder="Type your answer here..."
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
                        ← Prev
                      </button>
                      <button
                        className="quiz-btn subtle"
                        onClick={() =>
                          setPageIndex((i) =>
                            Math.min(quiz!.pages.length - 1, i + 1),
                          )
                        }
                        disabled={pageIndex >= quiz!.pages.length - 1}
                      >
                        Next →
                      </button>
                    </div>
                    <div className="qa-submit-section">
                      <button
                        className="quiz-btn primary"
                        onClick={submitAttempt}
                        disabled={!attemptId || !allAnswered}
                        title={
                          !attemptId
                            ? "Start attempt first"
                            : allAnswered
                              ? "Submit answers"
                              : `Answer all ${totalCount - answeredCount} remaining questions to submit`
                        }
                      >
                        {allAnswered
                          ? "Submit Quiz"
                          : `${totalCount - answeredCount} left`}
                      </button>
                    </div>
                  </footer>
                </>
              )}
            </main>
          </section>
        </div>
      </div>
    </TokenGuard>
  );
}
