import React, { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "../../utils/apiClient";
import useMessage from "../../hooks/useMessage";
import "./css/AnswerSubmission.css";
import useConfirm from "../../hooks/useConfirm";

interface AnswerSubmissionProps {
  activityId: string | number;
  onSubmitted?: () => void;
}

interface ExistingSubmission {
  id: number | string;
  file_path?: string | null;
  original_name?: string | null;
  score?: number | null;
  graded_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export default function AnswerSubmission({
  activityId,
  onSubmitted,
}: AnswerSubmissionProps): React.ReactElement {
  const [text, setText] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [existingSubmission, setExistingSubmission] =
    useState<ExistingSubmission | null>(null);

  const { messageComponent, showMessage } = useMessage();
  const [confirm, ConfirmModal] = useConfirm();
  const showMsgRef = useRef(showMessage);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    showMsgRef.current = showMessage;
  }, [showMessage]);

  const loadSubmission = useCallback(async () => {
    setLoading(true);
    try {
      const url = `/activity/${encodeURIComponent(
        String(activityId)
      )}/my-submission`;
      console.log("[FRONTEND] Fetching:", url);

      const { data, unauthorized } = await apiFetch<{
        success?: boolean;
        submission?: ExistingSubmission;
        error?: string;
      }>(url);

      console.log("[FRONTEND] Response:", { data, unauthorized });

      if (unauthorized) {
        showMsgRef.current("Session expired. Please sign in", "error");
        return;
      }

      if (data?.success && data.submission) {
        setExistingSubmission(data.submission);
      } else {
        setExistingSubmission(null);
      }
    } catch (e) {
      console.error("Load submission error:", e);
    } finally {
      setLoading(false);
    }
  }, [activityId]);

  useEffect(() => {
    void loadSubmission();
  }, [loadSubmission]);

  const submit = useCallback(async (): Promise<void> => {
    if (!text.trim() && !file) {
      showMsgRef.current("Add an answer or attach a file.", "error");
      return;
    }
    if (sending) return;

    // If already submitted and graded, confirm resubmission
    if (existingSubmission?.graded_at) {
      const confirmed = await confirm({
        title: "Resubmit Warning",
        message:
          "This submission has beed graded. Resubmitting will remove your new score. Continue?",
        confirmText: "Confirm",
        cancelText: "Cancel",
      });

      if (!confirmed) return;
    }

    setSending(true);

    try {
      const fd = new FormData();
      fd.append("text", text.trim());
      if (file) fd.append("file", file);

      const { data, unauthorized } = await apiFetch<{
        success?: boolean;
        submission?: ExistingSubmission;
        error?: string;
      }>(`/activity/${encodeURIComponent(String(activityId))}/submit`, {
        method: "POST",
        body: fd,
        form: true,
      } as any);

      if (unauthorized) {
        showMsgRef.current("Session expired. Please sign in", "error");
        return;
      }

      if (data?.success) {
        setText("");
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        onSubmitted?.();
        showMsgRef.current(
          existingSubmission
            ? "Resubmitted successfully"
            : "Submitted successfully",
          "success"
        );
      } else {
        showMsgRef.current(data?.error ?? "Failed to submit", "error");
      }
    } catch (e) {
      console.error("Submit error:", e);
      showMsgRef.current("Server error", "error");
    } finally {
      setSending(false);
    }
  }, [
    activityId,
    file,
    onSubmitted,
    sending,
    text,
    existingSubmission,
    confirm,
  ]);

  const unsubmit = useCallback(async (): Promise<void> => {
    if (!existingSubmission) return;

    const confirmed = await confirm({
      title: "Unsubmit Confirmation",
      message:
        "Are you sure you want to unsubmit your work? You can resubmit later.",
      confirmText: "Confirm",
      cancelText: "Cancel",
    });

    if (!confirmed) return;

    setSending(true);

    try {
      const { data, unauthorized } = await apiFetch<{
        success?: boolean;
        error?: string;
      }>(
        `/activity/${encodeURIComponent(
          String(activityId)
        )}/submission/${encodeURIComponent(String(existingSubmission.id))}`,
        {
          method: "DELETE",
        }
      );

      if (unauthorized) {
        showMsgRef.current("Session expired. Please sign in", "error");
        return;
      }

      if (data?.success) {
        setExistingSubmission(null);
        setText("");
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        showMsgRef.current("Submission removed", "success");
        onSubmitted?.();
      } else {
        showMsgRef.current(data?.error ?? "Failed to unsubmit", "error");
      }
    } catch (e) {
      console.error("Unsubmit error:", e);
      showMsgRef.current("Server error", "error");
    } finally {
      setSending(false);
    }
  }, [activityId, existingSubmission, confirm, onSubmitted]);

  if (loading) {
    return (
      <section className="activity-section answer-submission">
        <p className="submission-loading">Loading submission status...</p>
      </section>
    );
  }

  return (
    <>
      {messageComponent}
      <ConfirmModal />
      <section className="activity-section answer-submission">
        {existingSubmission ? (
          <div className="submission-status">
            <div className="status-header">
              <h4>✅ Submitted</h4>
              {existingSubmission.score !== null &&
                existingSubmission.score !== undefined && (
                  <span className="score-badge-student">
                    Score: {existingSubmission.score}
                  </span>
                )}
            </div>

            <div className="submission-details">
              <p className="submission-time">
                <strong>Submitted:</strong>{" "}
                {existingSubmission.created_at
                  ? new Date(existingSubmission.created_at).toLocaleString()
                  : "—"}
              </p>
              {existingSubmission.updated_at &&
                existingSubmission.updated_at !==
                  existingSubmission.created_at && (
                  <p className="submission-time">
                    <strong>Last updated:</strong>{" "}
                    {new Date(existingSubmission.updated_at).toLocaleString()}
                  </p>
                )}

              {existingSubmission.original_name && (
                <div className="submitted-file">
                  <a
                    href={`${
                      import.meta.env.VITE_API_BASE_URL ||
                      "http://localhost:5000"
                    }/uploads/activities/${existingSubmission.file_path}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="file-link"
                  >
                    📎 {existingSubmission.original_name}
                  </a>
                </div>
              )}

              {existingSubmission.graded_at && (
                <p className="graded-info">
                  <strong>Graded:</strong>{" "}
                  {new Date(existingSubmission.graded_at).toLocaleString()}
                </p>
              )}
            </div>

            <div className="actions">
              <button
                onClick={unsubmit}
                disabled={sending}
                className="unsubmit-btn"
              >
                {sending ? "Unsubmitting..." : "Unsubmit"}
              </button>
            </div>

            <p className="submission-note">
              You can unsubmit and resubmit your work anytime.
              {existingSubmission.graded_at &&
                " Note: Resubmitting will remove your score."}
            </p>
          </div>
        ) : (
          <>
            <h4>Submit your answer</h4>

            <textarea
              className="activity-textarea"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write your answer..."
              disabled={sending}
            />

            <div
              className="answer-file-drop"
              onClick={() => !sending && fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && !sending)
                  fileInputRef.current?.click();
              }}
            >
              <span className="drop-sub">PDF, Doc, JPG or PNG up to 5MB</span>
              <input
                type="file"
                ref={fileInputRef}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                disabled={sending}
              />
            </div>

            {file && (
              <div className="answer-file-chip">
                <div>
                  <strong>{file.name}</strong>
                  <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
                <button
                  className="chip-remove"
                  type="button"
                  onClick={() => {
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  disabled={sending}
                >
                  Remove
                </button>
              </div>
            )}

            <div className="actions">
              <button
                onClick={submit}
                disabled={sending || (!text.trim() && !file)}
              >
                {sending ? "Submitting..." : "Submit"}
              </button>
            </div>
          </>
        )}
      </section>
    </>
  );
}
