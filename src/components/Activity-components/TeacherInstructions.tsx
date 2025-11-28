import React, { useEffect, useRef, useState } from "react";
import useMessage from "../../hooks/useMessage";
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
  const [saving, setSaving] = useState<boolean>(false);

  const { messageComponent, showMessage } = useMessage();

  const showMsgRef = useRef(showMessage);

  useEffect(() => {
    showMsgRef.current = showMessage;
  }, [showMessage]);

  // keep local state in sync when prop changes
  useEffect(() => {
    setText(currentInstructions ?? "");
  }, [currentInstructions]);

  const save = async (): Promise<void> => {
    if (!activityId) {
      showMsgRef.current("Missing activity id", "error");
      return;
    }
    setSaving(true);

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
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {messageComponent}
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
            disabled={saving || text === (currentInstructions ?? "")}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </section>
    </>
  );
};

export default TeacherInstructions;
