import React, { useEffect, useRef, useState } from "react";
import useMessage from "../../hooks/useMessage";
import useLoadingState from "../../hooks/useLoading";
import LoadingOverlay from "../Component-elements/loading_overlay";
import { apiFetch } from "../../utils/apiClient";
import "./css/TeacherInstructions.css";

interface Instruction {
  id: number;
  activity_id: number;
  teacher_id: number;
  instruction_text: string;
  created_at: string;
  updated_at: string;
  username: string;
  teacher_role: string;
}

interface TeacherInstructionsProps {
  activityId: string | number;
  currentInstructions?: string | null;
  onSaved?: (newInstructions: Instruction[]) => void;
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
  const [newInstruction, setNewInstruction] = useState<string>("");
  const [instructionHistory, setInstructionHistory] = useState<Instruction[]>(
    Array.isArray(currentInstructions) ? currentInstructions : []
  );
  const { loading, wrap } = useLoadingState(false);

  const { messageComponent, showMessage } = useMessage();
  const showMsgRef = useRef<typeof showMessage>(showMessage);

  useEffect(() => {
    showMsgRef.current = showMessage;
  }, [showMessage]);

  // keep local state in sync when prop changes
  useEffect(() => {
    if (Array.isArray(currentInstructions)) {
      setInstructionHistory(currentInstructions);
    }
  }, [currentInstructions]);

  const save = async (): Promise<void> => {
    await wrap(async () => {
      if (!activityId) {
        showMsgRef.current("Missing activity id", "error");
        return;
      }

      if (!newInstruction.trim()) {
        showMsgRef.current("Instruction cannot be empty", "error");
        return;
      }

      try {
        const { data, unauthorized } = await apiFetch(
          `/activity/${encodeURIComponent(String(activityId))}/instructions`,
          {
            method: "PATCH",
            body: JSON.stringify({ instructions: newInstruction }),
            headers: { "Content-Type": "application/json" },
          }
        );

        if (unauthorized) {
          showMsgRef.current("Session expired. Please sign in.", "error");
          return;
        }

        if (data?.success && Array.isArray(data.instructions)) {
          setInstructionHistory(data.instructions);
          setNewInstruction("");
          showMsgRef.current("Instructions updated", "success");
          if (onSaved) onSaved(data.instructions);
        } else
          showMsgRef.current(
            data?.error || "Failed to save instruction",
            "error"
          );
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

        <div className="new-instruction">
          <textarea
            className="activity-textarea"
            value={newInstruction}
            onChange={(e) => setNewInstruction(e.target.value)}
            placeholder="Add new instruction or update..."
            rows={4}
            disabled={loading}
          />
          <button onClick={save} disabled={loading || !newInstruction.trim()}>
            Add Instruction
          </button>
        </div>

        <div className="instruction-history">
          <h5>Instruction History</h5>
          {instructionHistory.length === 0 ? (
            <p className="empty">No instructions yet.</p>
          ) : (
            <ul className="instructions-list">
              {instructionHistory.map((instr, idx) => (
                <li key={instr.id || idx} className="instruction-entry">
                  <div className="instruction-header">
                    <strong>Instruction {idx + 1}</strong>
                    <span className="teacher-info">
                      by {instr.username} ({instr.teacher_role})
                    </span>
                    <time dateTime={instr.created_at}>
                      {new Date(instr.created_at).toLocaleString()}
                    </time>
                  </div>
                  <div className="instruction-text">
                    {instr.instruction_text}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
};

export default TeacherInstructions;
