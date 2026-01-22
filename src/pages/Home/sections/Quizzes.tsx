import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "utils/apiClient.js";
import useMessage from "hooks/useMessage.js";
import useConfirm from "hooks/useConfirm.js";
import type { Quiz } from "types/quiz";
import "home/Home.css";

type Role = "teacher" | "student" | string;

interface QuizzesProps {
  role: Role;
  classroomCode?: string | null;
}

const Quizzes: React.FC<QuizzesProps> = ({ role, classroomCode }) => {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const { messageComponent, showMessage } = useMessage();
  const [confirm, ConfirmModal] = useConfirm();

  const navigate = useNavigate();
  const showMsgRef = useRef(showMessage);

  useEffect(() => {
    showMsgRef.current = showMessage;
  }, [showMessage]);

  let storedUser: any = null;
  try {
    storedUser = JSON.parse(localStorage.getItem("user") || "null");
  } catch (e) {
    storedUser = null;
  }

  const [classCode, setClassCode] = useState<string | null>(
    classroomCode ??
      storedUser?.classroomCode ??
      storedUser?.currentClassroom ??
      localStorage.getItem("currentClassroom") ??
      null,
  );

  useEffect(() => {
    if (classCode) return;
    let mounted = true;
    (async () => {
      try {
        const endpoint =
          role === "teacher" ? "/classrooms/teacher" : "/classrooms/student";
        const { data } = await apiFetch(endpoint);
        if (!mounted) return;
        if (data?.success) {
          const serverCode =
            data.code ||
            data.classroom?.code ||
            data.classroomCode ||
            data.classroomId ||
            null;
          if (serverCode) {
            setClassCode(serverCode);
            try {
              localStorage.setItem("currentClassroom", serverCode);
            } catch {}
          }
        } else {
          showMsgRef.current(
            "Failed to determine classroom. Please select a classroom first.",
            "error",
          );
        }
      } catch (err) {
        showMsgRef.current("[QUIZZES] Server Error", "error");
      }
    })();
    return () => {
      mounted = false;
    };
  }, [classCode, role]);

  useEffect(() => {
    if (!classCode) {
      setLoading(false);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const { data } = await apiFetch(`/quizzes/${classCode}/quizzes`);
        if (mounted && data?.success) setQuizzes(data.quizzes || []);
      } catch (e) {
        showMsgRef.current("Failed to load quizzes", "error");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [classCode]);

  function onCreate(): void {
    navigate(`/quizzes/${classCode}/create`);
  }

  function openQuiz(q: Quiz): void {
    if (!classCode) return;
    navigate(`/quizzes/${classCode}/quizzes/${q.id}`);
  }

  function reviewQuiz(q: Quiz): void {
    if (!classCode) return;
    navigate(`/quizzes/${classCode}/quizzes/${q.id}/review`);
  }

  function editQuiz(q: Quiz): void {
    if (!classCode) return;
    navigate(`/quizzes/${classCode}/quizzes/${q.id}/edit`);
  }

  async function deleteQuiz(q: Quiz): Promise<void> {
    const ok = await confirm({
      title: "Delete quiz",
      message: `Delete "${q.title}"? This cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
    });
    if (!ok) return;

    try {
      const { data } = await apiFetch(`/quizzes/${classCode}/quizzes/${q.id}`, {
        method: "DELETE",
      });
      if (data?.success) {
        setQuizzes((list) => list.filter((x) => x.id !== q.id));
        showMsgRef.current("Quiz deleted", "success");
      } else {
        showMsgRef.current(data?.message || "Failed to delete quiz", "error");
      }
    } catch (e) {
      showMsgRef.current("Server error", "error");
    }
  }

  const visibleClass = `home-card zone-section quizzes-section role-${
    role === "teacher" ? "teacher" : "student"
  }`;

  return (
    <>
      {messageComponent}
      <ConfirmModal />
      <section className={visibleClass}>
        <div className="quiz-header">
          <h2>Quizzes</h2>
          {role === "teacher" && (
            <button className="quiz-create-btn" onClick={onCreate}>
              <span className="quiz-btn-icon">+</span>
              Create Quiz
            </button>
          )}
        </div>

        {loading ? (
          <div className="quiz-empty-state">
            <p>Loading quizzes…</p>
          </div>
        ) : !quizzes.length ? (
          <div className="quiz-empty-state">
            <span className="quiz-icon">📝</span>
            <p>
              {role === "student" ? "No quizzes available" : "No quizzes yet"}
            </p>
            <span className="quiz-subtitle">
              {role === "student"
                ? "Check back later."
                : "Click Create Quiz to begin."}
            </span>
          </div>
        ) : (
          <div className="quiz-list">
            {quizzes.map((q) => {
              const published = !!q.start_time;
              const itemCount = q.questions_count ?? q.question_count ?? "—";
              const attempts = q.attempts_allowed ?? q.attemptsAllowed ?? "—";
              const time = q.time_limit_seconds
                ? `${Math.ceil(q.time_limit_seconds / 60)} min`
                : "—";

              return (
                <div
                  key={String(q.id)}
                  className={`quiz-item ${
                    published ? "is-published" : "is-draft"
                  }`}
                  onClick={() => openQuiz(q)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") openQuiz(q);
                  }}
                >
                  <div className="quiz-item-header">
                    <h3>{q.title || "Untitled"}</h3>
                    <span
                      className={`quiz-status ${
                        published ? "published" : "draft"
                      }`}
                    >
                      {published ? "Published" : "Draft"}
                    </span>
                  </div>
                  <p className="quiz-description">
                    {q.description || "No description."}
                  </p>
                  <div className="quiz-meta">
                    <span>Items: {itemCount}</span>
                    <span>Time: {time}</span>
                    <span>Attempts: {attempts}</span>
                    <span>
                      Start:{" "}
                      {q.start_time
                        ? new Date(q.start_time).toLocaleString()
                        : "—"}
                    </span>
                  </div>
                  <div className="quiz-actions">
                    {role === "teacher" ? (
                      <>
                        <button
                          className="quiz-action-btn edit"
                          onClick={(e) => {
                            e.stopPropagation();
                            editQuiz(q);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="quiz-action-btn view"
                          onClick={(e) => {
                            e.stopPropagation();
                            openQuiz(q);
                          }}
                        >
                          Attempts
                        </button>
                        <button
                          className="quiz-action-btn danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            void deleteQuiz(q);
                          }}
                        >
                          Delete
                        </button>
                        <button
                          className="quiz-action-btn review"
                          onClick={(e) => {
                            e.stopPropagation();
                            reviewQuiz(q);
                          }}
                        >
                          Review
                        </button>
                      </>
                    ) : (
                      <button
                        className="quiz-action-btn start"
                        onClick={(e) => {
                          e.stopPropagation();
                          openQuiz(q);
                        }}
                      >
                        Start
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
};

export default Quizzes;
