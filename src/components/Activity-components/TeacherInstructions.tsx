import React, { useEffect, useRef, useState } from "react";
import useMessage from "../../hooks/useMessage";
import useLoadingState from "../../hooks/useLoading";
import LoadingOverlay from "../Component-elements/loading_overlay";
import { apiFetch } from "../../utils/apiClient";
import "./css/TeacherInstructions.css";

export interface Instruction {
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
  currentInstructions?: Instruction[];
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
  const [instructionHistory, setInstructionHistory] = useState<Instruction[]>(
    Array.isArray(currentInstructions) ? currentInstructions : []
  );
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDrafts, setEditDrafts] = useState<Record<number, string>>({});
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [newInstruction, setNewInstruction] = useState<string>("");

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

  const addInstruction = async (): Promise<void> => {
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
          setShowAddForm(false);
          showMsgRef.current(data?.message || "Instruction added", "success");
          if (onSaved) onSaved(data.instructions);
        } else {
          showMsgRef.current(
            data?.error || "Failed to add instruction",
            "error"
          );
        }
      } catch (e) {
        console.error("Add instruction error:", e);
        showMsgRef.current("Server error", "error");
      }
    });
  };

  const startEdit = (instr: Instruction): void => {
    setEditingId(instr.id);
    setEditDrafts((prev) => ({
      ...prev,
      [instr.id]: instr.instruction_text,
    }));
  };

  const cancelEdit = (): void => {
    setEditingId(null);
    setEditDrafts({});
  };

  const saveEdit = async (id: number): Promise<void> => {
    await wrap(async () => {
      const updatedText = editDrafts[id]?.trim();
      if (!updatedText) {
        showMsgRef.current("Instruction cannot be empty", "error");
        return;
      }

      try {
        const { data, unauthorized } = await apiFetch<{
          success?: boolean;
          message?: string;
          instructions?: Instruction[];
          error?: string;
        }>(
          `/activity/${encodeURIComponent(
            String(activityId)
          )}/instructions/${encodeURIComponent(String(id))}`,
          {
            method: "PUT",
            body: JSON.stringify({ instruction_text: updatedText }),
            headers: { "Content-Type": "application/json" },
          }
        );

        if (unauthorized) {
          showMsgRef.current("Session expired. PLease sign in.", "error");
          return;
        }

        if (data?.success && Array.isArray(data.instructions)) {
          setInstructionHistory(data.instructions);
          setEditingId(null);
          setEditDrafts({});
          showMsgRef.current(data?.message || "Instructions updated", "error");
          if (onSaved) onSaved(data.instructions);
        } else {
          showMsgRef.current(
            data?.error || "Failed to update instruction",
            "error"
          );
        }
      } catch (e) {
        console.error("Updated instruction error:", e);
        showMsgRef.current("Server error", "error");
      }
    });
  };

  return (
    <>
      {messageComponent}
      <LoadingOverlay loading={loading} text="Processing..." fullPage={false} />

      <section className="activity-section teacher-instructions">
        <h4>Instructions</h4>
        <button
          className="add-instruction-btn"
          onClick={() => setShowAddForm(!showAddForm)}
          disabled={loading}
        >
          {showAddForm ? "Cancel" : "+ Add Instruction"}
        </button>

        {showAddForm && (
          <div className="instruction-edit-form add-form">
            <textarea
              className="activity-textarea"
              value={newInstruction}
              onChange={(e) => setNewInstruction(e.target.value)}
              placeholder="Enter new instruction..."
              rows={4}
              disabled={loading}
              autoFocus
            />
            <div className="edit-actions">
              <button
                onClick={addInstruction}
                disabled={loading || !newInstruction.trim()}
              >
                Save
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setNewInstruction("");
                }}
                disabled={loading}
                className="cancel-btn"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="instruction-history">
          {instructionHistory.length === 0 ? (
            <p className="empty">No instructions yet</p>
          ) : (
            <ul className="instructions-list">
              {instructionHistory.map((instr, idx) => (
                <li key={instr.id} className="instruction-entry">
                  {editingId === instr.id ? (
                    // Edit mode
                    <div className="instruction-edit-form">
                      <textarea
                        className="activity-textarea"
                        value={editDrafts[instr.id] ?? ""}
                        rows={4}
                        onChange={(e) =>
                          setEditDrafts((prev) => ({
                            ...prev,
                            [instr.id]: e.target.value,
                          }))
                        }
                        disabled={loading}
                        autoFocus
                      />
                      <div className="edit-actions">
                        <button
                          onClick={() => saveEdit(instr.id)}
                          disabled={loading || !editDrafts[instr.id]?.trim()}
                        >
                          Save
                        </button>
                        <button
                          onClick={cancelEdit}
                          disabled={loading}
                          className="cancel-btn"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    // View mode
                    <>
                      <div className="instruction-header">
                        <div className="instruction-meta">
                          <strong>Instruction {idx + 1}</strong>
                          <span className="teacher-info">
                            by {instr.username}
                          </span>
                          <time dateTime={instr.created_at}>
                            {new Date(instr.created_at).toLocaleString()}
                          </time>
                        </div>
                        <button
                          className="edit-btn"
                          onClick={() => startEdit(instr)}
                          disabled={loading}
                        >
                          Edit
                        </button>
                      </div>
                      <div className="instruction-text">
                        {instr.instruction_text}
                      </div>
                    </>
                  )}
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
