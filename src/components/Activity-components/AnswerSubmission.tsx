import React, { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "../../utils/apiClient";
import useMessage from "../../hooks/useMessage";
import "./css/AnswerSubmission.css";

interface AnswerSubmissionProps {
  activityId: string | number;
  onSubmitted?: () => void;
}

export default function AnswerSubmission({
  activityId,
  onSubmitted,
}: AnswerSubmissionProps): React.ReactElement {
  const [text, setText] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState<boolean>(false);

  const { messageComponent, showMessage } = useMessage();
  const showMsgRef = useRef(showMessage);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    showMsgRef.current = showMessage;
  }, [showMessage]);

  const submit = useCallback(async (): Promise<void> => {
    if (!text.trim() && !file) {
      showMsgRef.current("Add an answer or attach a file.", "error");
      return;
    }
    if (sending) return;
    setSending(true);

    try {
      const fd = new FormData();
      fd.append("text", text.trim());
      if (file) fd.append("file", file);

      const { data, unauthorized } = await apiFetch<{
        success?: boolean;
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
        showMsgRef.current("Submitted", "success");
      } else {
        showMsgRef.current(data?.error ?? "Failed to submit", "error");
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Submit error:", e);
      showMsgRef.current("Server error", "error");
    } finally {
      setSending(false);
    }
  }, [activityId, file, onSubmitted, sending, text]);

  return (
    <>
      {messageComponent}
      <section className="activity-section answer-submission">
        <h4>Submit your answer</h4>

        <textarea
          className="activity-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write your answer..."
        />

        <div
          className="answer-file-drop"
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ")
              fileInputRef.current?.click();
          }}
        >
          <span className="drop-sub">PDF, Doc, JPG or PNG up to 5MB</span>
          <input
            type="file"
            ref={fileInputRef}
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
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
                if (fileInputRef.current)
                  (fileInputRef.current as HTMLInputElement).value = "";
              }}
            >
              Remove
            </button>
          </div>
        )}

        <div className="actions">
          <button onClick={submit} disabled={sending}>
            {sending ? "Submitting..." : "Submit"}
          </button>
        </div>
      </section>
    </>
  );
}
