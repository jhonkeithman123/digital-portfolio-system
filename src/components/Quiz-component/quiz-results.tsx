import React, { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiFetch } from "../../utils/apiClient";
import TokenGuard from "../auth/tokenGuard";
import useMessage from "../../hooks/useMessage";
import Header from "../Component-elements/Header";
import "./css/quiz-results.css";

interface Question {
  id: string;
  type: string;
  text: string;
  options?: string[];
  correctAnswer?: any;
  requiresManualGrading?: boolean;
}

interface Attempt {
  id: number;
  quiz_id: number;
  attempt_no: number;
  status: string;
  score: number | null;
  answers: Record<string, any>;
  grading: Record<string, any>;
  started_at: string;
  submitted_at: string | null;
  comment?: string;
}

interface Quiz {
  id: number;
  title: string;
  attempts_allowed: number | null;
}

export default function QuizResults(): React.ReactElement {
  const { classCode, quizId } = useParams<{
    classCode: string;
    quizId: string;
  }>();
  const navigate = useNavigate();
  const { messageComponent, showMessage } = useMessage();

  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);

  const showMsgRef = useRef(showMessage);
  const mountedRef = useRef(true);

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

  useEffect(() => {
    mountedRef.current = true;

    const loadResults = async () => {
      try {
        setLoading(true);

        // Load quiz info
        const { unauthorized: quizUnauth, data: quizData } = await apiFetch(
          `/quizzes/${classCode}/quizzes/${quizId}`
        );

        if (quizUnauth) {
          showMsgRef.current("Session expired. Please sign in again.", "error");
          navigate("/login");
          return;
        }

        if (!quizData?.success || !quizData.quiz) {
          showMsgRef.current("Quiz not found", "error");
          navigate("/dash");
          return;
        }

        setQuiz(quizData.quiz);

        // Load questions
        if (quizData.quiz.questions?.pages) {
          const pages = quizData.quiz.questions.pages;
          const flatQuestions = pages.flatMap((p: any) => p.questions || []);
          setQuestions(flatQuestions);
        }

        // Load student's latest attempt
        const { unauthorized: attemptUnauth, data: attemptData } =
          await apiFetch(`/quizzes/${classCode}/quizzes/${quizId}/my-attempts`);

        if (attemptUnauth) {
          showMsgRef.current("Session expired. Please sign in again.", "error");
          navigate("/login");
          return;
        }

        if (
          !attemptData?.success ||
          !attemptData.attempts ||
          attemptData.attempts.length === 0
        ) {
          showMsgRef.current("No attempts found", "info");
          navigate(`/quizzes/${classCode}/quizzes/${quizId}`);
          return;
        }

        // Get the latest completed/graded attempt
        const completedAttempts = attemptData.attempts.filter(
          (a: Attempt) => a.status === "completed"
        );

        if (completedAttempts.length === 0) {
          showMsgRef.current("No graded attempts yet", "info");
          navigate(`/quizzes/${classCode}/quizzes/${quizId}`);
          return;
        }

        // Sort by attempt_no descending to get latest
        const latestAttempt = completedAttempts.sort(
          (a: Attempt, b: Attempt) => b.attempt_no - a.attempt_no
        )[0];

        setAttempt(latestAttempt);
      } catch (err) {
        console.error("Error loading results:", err);
        showMsgRef.current("Failed to load results", "error");
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    };

    loadResults();

    return () => {
      mountedRef.current = false;
    };
  }, [classCode, quizId, navigate]);

  if (loading) {
    return (
      <TokenGuard
        redirectInfo="/login"
        onExpire={() =>
          showMsgRef.current("Session expired. Please sign in again.", "error")
        }
      >
        <Header variant="authed" user={user} />
        {messageComponent}
        <div className="quiz-results-shell">
          <div className="quiz-results-loading">Loading your results...</div>
        </div>
      </TokenGuard>
    );
  }

  if (!quiz || !attempt) {
    return (
      <TokenGuard
        redirectInfo="/login"
        onExpire={() =>
          showMsgRef.current("Session expired. Please sign in again.", "error")
        }
      >
        <Header variant="authed" user={user} />
        {messageComponent}
        <div className="quiz-results-shell">
          <div className="quiz-results-empty">No results available</div>
        </div>
      </TokenGuard>
    );
  }

  const roleClass = user?.role === "teacher" ? "teacher-role" : "student-role";
  const totalQuestions = questions.length;
  const correctCount = questions.filter((q) => {
    const grading = attempt.grading[q.id];
    return grading?.correct === true || grading?.questionScore === 1;
  }).length;

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

      <div className="quiz-results-shell">
        <section className="quiz-results-card">
          {/* Header Section */}
          <div className="results-header">
            <div className="results-header-content">
              <h1 className="results-title">{quiz.title}</h1>
              <p className="results-subtitle">Attempt #{attempt.attempt_no}</p>
            </div>

            <div className="results-score-card">
              <div className="results-score-main">
                <span className="results-score-value">
                  {attempt.score ?? "—"}
                </span>
                <span className="results-score-suffix">%</span>
              </div>
              <div className="results-score-meta">
                {correctCount} / {totalQuestions} correct
              </div>
              {attempt.status === "needs_grading" && (
                <div className="results-pending-badge">Pending Review</div>
              )}
            </div>
          </div>

          {/* Teacher Comment */}
          {attempt.comment && (
            <div className="results-comment-section">
              <h3 className="results-comment-title">Teacher Feedback</h3>
              <p className="results-comment-text">{attempt.comment}</p>
            </div>
          )}

          {/* Questions & Answers */}
          <div className="results-questions">
            <h3 className="results-section-title">Question Review</h3>

            {questions.map((q, idx) => {
              const studentAnswer = attempt.answers[q.id];
              const grading = attempt.grading[q.id];
              const isCorrect =
                grading?.correct === true || grading?.questionScore === 1;
              const isWrong =
                grading?.correct === false && grading?.questionScore !== 1;
              const isPartial =
                grading?.questionScore > 0 && grading?.questionScore < 1;

              return (
                <div
                  key={q.id}
                  className={`results-question ${
                    isCorrect
                      ? "correct"
                      : isWrong
                      ? "wrong"
                      : isPartial
                      ? "partial"
                      : "pending"
                  }`}
                >
                  {/* Question Header */}
                  <div className="results-question-header">
                    <span className="results-question-number">
                      Question {idx + 1}
                    </span>
                    <div className="results-question-status">
                      {isCorrect && (
                        <span className="results-badge correct-badge">
                          ✓ Correct
                        </span>
                      )}
                      {isWrong && (
                        <span className="results-badge wrong-badge">
                          ✗ Incorrect
                        </span>
                      )}
                      {isPartial && (
                        <span className="results-badge partial-badge">
                          Partial Credit ({grading.questionScore}/1)
                        </span>
                      )}
                      {!isCorrect && !isWrong && !isPartial && (
                        <span className="results-badge pending-badge">
                          Pending Review
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Question Text */}
                  <div className="results-question-text">{q.text}</div>

                  {/* Student Answer */}
                  <div className="results-answer-box student-answer-box">
                    <strong className="results-answer-label">
                      Your Answer:
                    </strong>
                    {q.type === "multiple_choice" && q.options ? (
                      <p className="results-answer-content">
                        {q.options[parseInt(studentAnswer)] || "No answer"}
                      </p>
                    ) : q.type === "checkboxes" && q.options ? (
                      <ul className="results-answer-list">
                        {(Array.isArray(studentAnswer) ? studentAnswer : [])
                          .length > 0 ? (
                          (Array.isArray(studentAnswer)
                            ? studentAnswer
                            : []
                          ).map((idx: number) => (
                            <li key={idx}>{q.options![idx]}</li>
                          ))
                        ) : (
                          <li className="results-no-answer">No answer</li>
                        )}
                      </ul>
                    ) : (
                      <p className="results-answer-content text-answer">
                        {studentAnswer || "No answer"}
                      </p>
                    )}
                  </div>

                  {/* Correct Answer (if not manual grading) */}
                  {!q.requiresManualGrading && q.correctAnswer && (
                    <div className="results-answer-box correct-answer-box">
                      <strong className="results-answer-label">
                        Correct Answer:
                      </strong>
                      {q.type === "multiple_choice" && q.options ? (
                        <p className="results-answer-content">
                          {q.options[parseInt(q.correctAnswer)] || "—"}
                        </p>
                      ) : q.type === "checkboxes" && q.options ? (
                        <ul className="results-answer-list">
                          {(Array.isArray(q.correctAnswer)
                            ? q.correctAnswer
                            : []
                          ).map((idx: number) => (
                            <li key={idx}>{q.options![idx]}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="results-answer-content text-answer">
                          {q.correctAnswer || "—"}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Question Feedback */}
                  {grading?.feedback && (
                    <div className="results-question-feedback">
                      <strong>Feedback:</strong> {grading.feedback}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer Actions */}
          <div className="results-footer">
            <button
              className="results-btn secondary"
              onClick={() => navigate("/dash")}
            >
              Back to Dashboard
            </button>
            {quiz.attempts_allowed === null ||
              (attempt.attempt_no < quiz.attempts_allowed && (
                <button
                  className="results-btn primary"
                  onClick={() =>
                    navigate(`/quizzes/${classCode}/quizzes/${quizId}`)
                  }
                >
                  Take Quiz Again
                </button>
              ))}
          </div>
        </section>
      </div>
    </TokenGuard>
  );
}
