import React, { useEffect, useRef, useState } from "react";
import useMessage from "../../hooks/useMessage";
import useLoadingState from "../../hooks/useLoading";
import LoadingOverlay from "../Component-elements/loading_overlay";
import { apiFetch } from "../../utils/apiClient";
import "./css/TeacherInstructions.css";

interface TeacherInstructionsProps {
  activityId: string | number;
  currentInstructions?: string | null;
  onSaved?: (newInstructions: string) => void;
}

/**
 ** Simple editor to update instructions on an existing activity.
 ** PATCH /activity/:id/instructions { instructions }
 */
const TeacherInstructions: React.FC<TeacherInstructionsProps> = ({
  activityId,
  currentInstructions,
  onSaved,
}): React.ReactElement => {
  const [text, setText] = useState<string>(currentInstructions || "");
  const { loading, wrap } = useLoadingState(false);

  const { messageComponent, showMessage } = useMessage();

  const showMsgRef = useRef<typeof showMessage>(showMessage);

  useEffect(() => {
    showMsgRef.current = showMessage;
  }, [showMessage]);

  // keep local state in sync when prop changes
  useEffect(() => {
    setText(currentInstructions ?? "");
  }, [currentInstructions]);

  const save = async (): Promise<void> => {
    await wrap(async () => {
      if (!activityId) {
        showMsgRef.current("Missing activity id", "error");
        return;
      }

      try {
        const { data, unauthorized } = await apiFetch(
          `/activity/${encodeURIComponent(String(activityId))}/instructions`,
          {
            method: "PATCH",
            body: JSON.stringify({ instructions: text }),
            headers: { "Content-Type": "application/json" },
          }
        );

        if (unauthorized) {
          showMsgRef.current("Session expired. Please sign in.", "error");
          return;
        }

        if (data?.success) {
          showMsgRef.current("Instructions updated", "success");
          if (onSaved) onSaved(text);
        } else showMsgRef.current(data?.error || "Failed to save", "error");
      } catch (e) {
        console.error("Save instr err", e);
        showMsgRef.current("Server error", "error");
      }
    });
  };

  return (
    <>
      {messageComponent}
      <LoadingOverlay loading={loading} text="Processing..." fullPage={false} />
      <section className="activity-section teacher-instructions">
        <h4>Teacher: Edit instructions</h4>
        <textarea
          className="activity-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
        />
        <div className="instr-actions">
          <button
            onClick={save}
            disabled={loading || text === (currentInstructions ?? "")}
          >
            Save
          </button>
        </div>
      </section>
    </>
  );
};

export default TeacherInstructions;
