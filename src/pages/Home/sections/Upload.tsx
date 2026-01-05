import React, { useEffect, useRef, useState } from "react";
import "../Home.css";
import { apiFetch } from "../../../utils/apiClient";
import { useNavigate } from "react-router-dom";
import useConfirm from "../../../hooks/useConfirm";

type Role = "teacher" | "student" | string;

type Activity = {
  id: string | number;
  title?: string;
  instructions?: string;
  original_name?: string | null;
  created_at?: string | null;
  [k: string]: any;
};

interface FileUploadProps {
  role: Role;
  classroomCode?: string | null;
  showMessage: (text: string, kind?: "info" | "success" | "error") => void;
  loadingOuter?: boolean;
}

const allowedTypes = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
];
const maxSize = 5 * 1024 * 1024;

const FileUpload: React.FC<FileUploadProps> = ({
  role,
  classroomCode,
  showMessage,
  loadingOuter = false,
}) => {
  const navigate = useNavigate();
  const [confirm, ConfirmModal] = useConfirm();

  const [title, setTitle] = useState<string>("");
  const [instructions, setInstructions] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [creating, setCreating] = useState<boolean>(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState<boolean>(false);
  const [maxScore, setMaxScore] = useState<number>(100);

  const showMsgRef = useRef<typeof showMessage>(showMessage);
  useEffect(() => {
    showMsgRef.current = showMessage;
  }, [showMessage]);

  // return a compact "digital clock" time + short date for display
  const fmtClock = (d?: string | null) => {
    if (!d) return { time: "", date: "" };
    const dt = new Date(d);
    const time = dt.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    const date = dt.toLocaleDateString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    return { time, date };
  };
  const dbg = (...args: unknown[]) => {
    // mark args as used to avoid "declared but its value is never read"
    void args;
    // toggle debug easily
    // console.log("[Upload]", ...args);
  };

  const normalize = (list: any[] = []): Activity[] =>
    list.map((a) => ({
      id:
        a.id ??
        a._id ??
        crypto?.randomUUID?.() ??
        `${Date.now()}-${Math.random()}`,
      title: a.title ?? "",
      instructions: a.instructions ?? "",
      original_name: a.original_name ?? a.fileName ?? null,
      created_at: a.created_at ?? a.createdAt ?? new Date().toISOString(),
      ...a,
    }));

  const validateFile = (f: File | null): boolean => {
    if (!f) return false;
    if (!allowedTypes.includes(f.type)) {
      showMsgRef.current(
        "Invalid type: PDF, DOC, DOCX, JPG, PNG only.",
        "error"
      );
      return false;
    }
    if (f.size > maxSize) {
      showMsgRef.current("File exceeds 5MB.", "error");
      return false;
    }
    return true;
  };

  const pickFile = (f: File | null) => {
    if (validateFile(f)) setFile(f);
  };

  // fetch activities whenever classroomCode becomes available
  useEffect(() => {
    dbg("Upload effect: classroomCode=", classroomCode, "role=", role);
    if (!classroomCode) return;
    let ignore = false;
    const ac = new AbortController();

    const load = async () => {
      setLoadingActivities(true);
      try {
        const path = `/activity/classroom/${encodeURIComponent(
          String(classroomCode)
        )}`;
        dbg("[Upload] fetching activities from", path);
        const { data } = await apiFetch(path, { signal: ac.signal });
        dbg("[Upload] activities response:", data);
        if (ignore) return;
        if (data?.success) setActivities(normalize(data.activities || []));
        else {
          // fallback: try singular endpoint if needed
          dbg("[Upload] primary failed, trying fallback");
          const fb = await apiFetch(path, { signal: ac.signal });
          dbg("[Upload] fallback response:", fb);
          if (!ignore && fb.data?.success)
            setActivities(normalize(fb.data.activities || []));
          else if (!ignore)
            showMsgRef.current(
              data?.error || fb.data?.error || "Failed to load activities",
              "error"
            );
        }
      } catch (e) {
        if (!ignore)
          showMsgRef.current("Server error loading activities.", "error");
         
        console.error("[Upload] fetch error:", e);
      } finally {
        if (!ignore) setLoadingActivities(false);
      }
    };

    void load();
    return () => {
      ignore = true;
      ac.abort();
    };
  }, [classroomCode, role]);

  const handleOpenActivity = (id: string | number) => {
    navigate(`/activity/${encodeURIComponent(String(id))}/view`);
  };

  const handleDeleteActivity = async (id: string | number) => {
    const ok = await confirm({
      title: "Delete activity",
      message: "Are you sure you want to delete this activity?",
      confirmText: "Delete",
      cancelText: "Cancel",
    });
    if (!ok) return;

    try {
      showMsgRef.current?.("Deleting...", "info");
      const { data, unauthorized } = await apiFetch(
        `/activity/${encodeURIComponent(String(id))}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        }
      );
      if (unauthorized) {
        showMsgRef.current?.("Session expired. Please sign in again.", "error");
        return;
      }
      if (!data?.success) {
        showMsgRef.current?.(
          data?.error || "Failed to delete activity",
          "error"
        );
        return;
      }
      setActivities((prev) => prev.filter((a) => String(a.id) !== String(id)));
      showMsgRef.current?.("Activity deleted.", "success");
    } catch (e) {
       
      console.error("Delete activity error:", e);
      showMsgRef.current?.("Server error while deleting activity.", "error");
    }
  };

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setIsDragging(true);
    else setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0] ?? null;
    if (dropped) pickFile(dropped);
  };

  const canSubmit =
    role === "teacher" &&
    !!classroomCode &&
    title.trim().length > 0 &&
    instructions.trim().length > 0 &&
    !creating;

  const disabledReason = (() => {
    if (role !== "teacher") return "Teacher only";
    if (!classroomCode) return "No classroom code";
    if (!title.trim()) return "Missing title";
    if (!instructions.trim()) return "Missing instructions";
    if (creating) return "Submitting...";
    return "";
  })();

  const handleSubmit = async () => {
    if (!canSubmit) {
      dbg("Submit blocked. Reason:", disabledReason, {
        classroomCode,
        title,
        instructions,
        creating,
      });
      showMsgRef.current(disabledReason || "Complete required fields", "error");
      return;
    }
    setCreating(true);
    dbg("Submitting new activity", { title, instructions, hasFile: !!file });
    try {
      const fd = new FormData();
      fd.append("title", title.trim());
      fd.append("instructions", instructions.trim());
      fd.append("classroomCode", String(classroomCode));
      fd.append("maxScore", String(maxScore));
      if (file) fd.append("file", file);

      const { data } = await apiFetch("/activity/create", {
        method: "POST",
        body: fd,
        form: true,
      } as any);

      dbg("Create response:", data);

      if (!data?.success) {
        dbg("Create failed:", data?.error);
        showMsgRef.current(
          data?.error || "Failed to create activity.",
          "error"
        );
      } else {
        showMsgRef.current("Activity created.", "success");
        setActivities((prev) => [
          {
            id: data.id ?? `${Date.now()}-${Math.random()}`,
            title: title.trim(),
            instructions: instructions.trim(),
            original_name: file?.name ?? null,
            created_at: new Date().toISOString(),
          },
          ...prev,
        ]);

        // Reload from server to match student view (best-effort)
        try {
          dbg("Reloading list after create");
          const { data: reload } = await apiFetch(
            `/activity/classroom/${encodeURIComponent(String(classroomCode))}`
          );
          dbg("Reload response:", reload);
          if (reload?.success)
            setActivities(normalize(reload.activities || []));
        } catch (e) {
          dbg("Reload failed:", e);
        }

        setTitle("");
        setInstructions("");
        setFile(null);
      }
    } catch (e) {
      dbg("Submit exception:", e);
       
      console.error("Submit exception:", e);
      showMsgRef.current("Server error.", "error");
    } finally {
      dbg("Submit finished");
      setCreating(false);
      setMaxScore(100);
    }
  };

  return (
    <>
      <ConfirmModal />
      <section className="home-card">
        <h2>{role === "teacher" ? "Upload Activity" : "Activities"}</h2>
        {loadingOuter && <p>Loading classroom...</p>}

        {role === "teacher" ? (
          <>
            <div className="upload-form">
              <div className="form-row">
                <label className="up-label" htmlFor="activity-title">
                  Title
                </label>
                <input
                  id="activity-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={120}
                  placeholder="e.g., Reflection Essay #1"
                />
              </div>
              <div className="form-row">
                <label className="up-label" htmlFor="activity-max-score">
                  Max Score
                </label>
                <input
                  type="number"
                  id="activity-max-score"
                  value={maxScore}
                  onChange={(e) =>
                    setMaxScore(Math.max(1, parseInt(e.target.value) || 100))
                  }
                  min={1}
                  max={1000}
                  placeholder="100"
                />
              </div>
              <div className="form-row">
                <label className="up-label" htmlFor="activity-instructions">
                  Instructions
                </label>
                <textarea
                  id="activity-instructions"
                  rows={4}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  maxLength={1000}
                  placeholder="Add clear instructions for this activity…"
                />
              </div>
            </div>

            <div
              className={`upload-zone ${isDragging ? "dragging" : ""}`}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
            >
              <div className="upload-icon">📄</div>
              <p>Optional: drag & drop a file or</p>
              <input
                type="file"
                id="file-input"
                className="file-input-hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  if (f) pickFile(f);
                }}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              />
              <label htmlFor="file-input" className="file-input-label">
                Choose File
              </label>
              <p className="file-types">
                (Optional) Allowed: PDF, DOC, DOCX, JPG, PNG (max 5MB)
              </p>
            </div>

            {file && (
              <div className="file-preview">
                <div className="file-info">
                  <span className="file-icon">📎</span>
                  <div className="file-details">
                    <p className="file-name">{file.name}</p>
                    <p className="file-size">
                      {(file.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                </div>
                <button
                  className="file-remove"
                  onClick={() => {
                    setFile(null);
                    showMsgRef.current("File removed.", "info");
                  }}
                  type="button"
                >
                  ✕
                </button>
              </div>
            )}

            <button
              className={`upload-button ${!canSubmit ? "disabled" : ""}`}
              onClick={handleSubmit}
              disabled={!canSubmit}
              type="button"
            >
              {creating
                ? "Submitting"
                : canSubmit
                ? "Create Activity"
                : disabledReason}
            </button>

            <hr
              style={{
                margin: "18px 0",
                border: "none",
                borderTop: "1px solid #eee",
              }}
            />
            <h3 style={{ marginTop: 0 }}>Activities in this classroom</h3>
          </>
        ) : (
          <>
            {!classroomCode ? (
              <p>Join a classroom to see activities.</p>
            ) : loadingActivities ? (
              <p>Loading activities…</p>
            ) : null}
          </>
        )}

        {classroomCode && !loadingActivities && (
          <div className="activity-list" style={{ marginTop: 12 }}>
            {activities.length === 0 ? (
              <p>No activities yet.</p>
            ) : (
              <ul className="activities-ul">
                {activities.map((a) => (
                  <li key={String(a.id)} className="activity-item">
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <div>
                        <strong>{a.title}</strong>
                        <div className="activity-instructions">
                          {a.instructions?.slice(0, 160)}
                          {a.instructions && a.instructions.length > 160 && "…"}
                        </div>
                      </div>

                      {a.original_name && (
                        <span className="activity-file-name">
                          {a.original_name}
                        </span>
                      )}

                      <div>
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                          }}
                        >
                          {(() => {
                            const { time, date } = fmtClock(a.created_at);
                            return (
                              <div
                                className="activity-clock"
                                title={a.created_at ?? ""}
                                aria-hidden={false}
                              >
                                <span className="activity-time">{time}</span>
                                <span className="activity-day">{date}</span>
                              </div>
                            );
                          })()}

                          <button
                            className="activity-open-btn"
                            type="button"
                            onClick={() => handleOpenActivity(a.id)}
                          >
                            View
                          </button>

                          {role === "teacher" && (
                            <button
                              className="activity-delete-btn"
                              type="button"
                              onClick={() => void handleDeleteActivity(a.id)}
                              title="Delete activity"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </>
  );
};

export default FileUpload;
