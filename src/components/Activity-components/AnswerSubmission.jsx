import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { apiFetch } from "../../utils/apiClient";
import useMessage from "../../hooks/useMessage";
import "./css/AnswerSubmission.css";

const AnswerSubmission = ({ activityId, onSubmitted }) => {
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);

  const { messageComponent, showMessage } = useMessage();

  const showMsgRef = useRef(showMessage);
  const fileInputRef = useRef(null);

  useEffect(() => {
    showMsgRef.current = showMessage;
  }, [showMessage]);

  const submit = async () => {
    if (!text.trim() && !file) {
      showMsgRef.current("Add an answer or attach a file.", "error");
      return;
    }
    setSending(true);

    try {
      const fd = new FormData();
      fd.append("text", text.trim());

      if (file) fd.append("file", file);

      const { data } = await apiFetch(
        `/activity/${encodeURIComponent(activityId)}/submit`,
        {
          method: "POST",
          body: fd,
          form: true,
        }
      );

      if (data?.success) {
        setText("");
        setFile(null);

        if (onSubmitted) onSubmitted();
        showMsgRef.current("Submitted", "success");
      } else showMsgRef.current(data?.error || "Failed to submit", "error");
    } catch (e) {
      console.error("Submit error:", e);
      showMsgRef.current("Server error", "error");
    } finally {
      setSending(false);
    }
  };

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
                if (fileInputRef.current) fileInputRef.current.value = "";
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
};

AnswerSubmission.proptypes = {
  activityId: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
    .isRequired,
  onSubmitted: PropTypes.func,
};

export default AnswerSubmission;
