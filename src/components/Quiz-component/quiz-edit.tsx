import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../../utils/apiClient";
import useMessage from "../../hooks/useMessage";
import QuizEditor from "./quiz";
import TokenGuard from "../auth/tokenGuard";

type Page = {
  id: string;
  title: string;
  questions: any[];
};

type QuizInitialData = {
  quizId?: string | null;
  title: string;
  attemptsAllowed: number;
  timeLimitSeconds: number | null;
  pages: Page[];
  mode: "edit" | "create";
};

type ServerQuiz = {
  title?: string | null;
  attempts_allowed?: number | null;
  time_limit_seconds?: number | null;
  questions?: any;
  [k: string]: any;
};

function toPagesFromServerQuestions(raw: any) {
  try {
    const q = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (q && Array.isArray(q.pages)) return q.pages; // already paged
    if (Array.isArray(q)) {
      // legacy flat array
      return [{ id: "page-1", title: "Page 1", questions: q }]; // single page fallback
    }
  } catch {}
  return [{ id: "page-1", title: "Page 1", questions: [] }];
}

export default function QuizEditPage(): React.ReactElement {
  const { classCode, quizId } = useParams<{
    classCode?: string;
    quizId?: string;
  }>();
  const navigate = useNavigate();
  const { messageComponent, showMessage } = useMessage();

  const showMsgRef = useRef(showMessage);

  const [loading, setLoading] = useState<boolean>(true);
  const [initialData, setInitialData] = useState<QuizInitialData | null>(null);

  useEffect(() => {
    showMsgRef.current = showMessage;
  }, [showMessage]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { unauthorized, data } = await apiFetch<{
          success?: boolean;
          quiz?: ServerQuiz | null;
          message?: string;
        }>(`/quizzes/${classCode}/quizzes/${quizId}`);

        if (unauthorized) {
          showMsgRef.current("Session expired. Please sign in again.", "error");
          navigate("/login");
          return;
        }
        if (!mounted) return;

        if (!data?.success) {
          showMsgRef.current(data?.message || "Failed to load quiz", "error");
          navigate(`/quizzes/${classCode}/quizzes`);
          return;
        }
        const qz = (data.quiz ?? {}) as ServerQuiz;
        setInitialData({
          quizId,
          title: qz.title || "Untitled Quiz",
          attemptsAllowed: qz.attempts_allowed ?? 1,
          timeLimitSeconds: qz.time_limit_seconds ?? null,
          pages: toPagesFromServerQuestions(qz.questions),
          mode: "edit",
        });
      } catch (e) {
        console.error("Failed to load quiz", e);
        showMsgRef.current("Server error loading quiz", "error");
        navigate(`/quizzes/${classCode}/quizzes`);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [classCode, quizId, navigate]);

  if (loading)
    return (
      <section className="quiz-card">
        <div style={{ padding: 16 }}>Loading…</div>
        {messageComponent}
      </section>
    );

  if (!initialData)
    return (
      <section className="quiz-card">
        <div style={{ padding: 16 }}>Quiz not found</div>
        {messageComponent}
      </section>
    );

  return (
    <TokenGuard
      redirectInfo="/login"
      onExpire={() =>
        showMsgRef.current("Session expired. Please sign in again.", "error")
      }
    >
      {messageComponent}
      <QuizEditor classroomCode={classCode} initialData={initialData} />
    </TokenGuard>
  );
}
