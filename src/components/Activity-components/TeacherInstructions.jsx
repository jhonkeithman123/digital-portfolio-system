import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import useMessage from "../../hooks/useMessage";
import { apiFetch } from "../../utils/apiClient";
import "./css/TeacherInstructions.css";

/**
 ** Simple editor to update instructions on an existing activity.
 ** PATCH /activity/:id/instructions { instructions }
 */
const TeacherInstructions = ({ activityId, currentInstructions, onSaved }) => {
  const [text, setText] = useState(currentInstructions || "");
  const [saving, setSaving] = useState(false);

  const { messageComponent, showMessage } = useMessage();

  const showMsgRef = useRef(showMessage);

  useEffect(() => {
    showMsgRef.current = showMessage;
  }, [showMessage]);

  const save = async () => {
    setSaving(true);

    try {
      const { data } = await apiFetch(
        `/activity/${encodeURIComponent(activityId)}/instructions`,
        {
          method: "PATCH",
          body: JSON.stringify({ instructions: text }),
          headers: { "Content-Type": "application/json" },
        }
      );

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
          <button onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </section>
    </>
  );
};

TeacherInstructions.proptypes = {
  activityId: PropTypes.string.isRequired,
  currentInstructions: PropTypes.string,
  onSaved: PropTypes.func,
};

export default TeacherInstructions;
