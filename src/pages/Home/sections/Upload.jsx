import { useEffect, useState, useRef } from "react";
import "../Home.css";
import { apiFetch } from "../../../utils/apiClient";
import { useNavigate } from "react-router-dom";

const FileUpload = ({ role, classroomCode, showMessage, loadingOuter }) => {
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [creating, setCreating] = useState(false);
  const [activities, setActivities] = useState([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  const showMsgRef = useRef(showMessage);

  const allowedTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/jpeg",
    "image/png",
  ];
  const maxSize = 5 * 1024 * 1024;
  const fmtDate = (d) => new Date(d).toLocaleDateString();
  const dbg = (...args) => console.log("[Upload]", ...args);

  useEffect(() => {
    showMsgRef.current = showMessage;
  }, [showMessage]);

  const handleOpenActivity = (id) => {
    navigate(`/activity/${encodeURIComponent(id)}/view`);
  };

  const normalize = (list = []) =>
    list.map((a) => ({
      id: a.id ?? a._id ?? crypto.randomUUID(),
      title: a.title ?? "",
      instructions: a.instructions ?? "",
      original_name: a.original_name ?? a.fileName ?? null,
      created_at: a.created_at ?? a.createdAt ?? new Date().toISOString(),
    }));

  const validateFile = (f) => {
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

  const pickFile = (f) => {
    if (validateFile(f)) setFile(f);
  };

  // fetch activities whenever classroomCode becomes available (student or teacher)
  useEffect(() => {
    dbg("Upload effect: classroomCode=", classroomCode, "role=", role);
    if (!classroomCode) return;
    let ignore = false;
    const load = async () => {
      setLoadingActivities(true);
      try {
        // primary endpoint (adjust if your backend differs)
        const path = `/activity/classroom/${encodeURIComponent(classroomCode)}`;
        dbg("[Upload] fetching activities from", path);
        const { data } = await apiFetch(path);
        dbg("[Upload] activities response:", data);
        if (!ignore) {
          if (data?.success) setActivities(normalize(data.activities || []));
          else {
            // fallback: try singular endpoint if needed
            dbg("[Upload] primary failed, trying fallback");
            const fb = await apiFetch(
              `/activity/classroom/${encodeURIComponent(classroomCode)}`
            );
            dbg("[Upload] fallback response:", fb);
            if (fb.data?.success)
              setActivities(normalize(fb.data.activities || []));
            else
              showMsgRef.current(
                data?.error || fb.data?.error || "Failed to load activities",
                "error"
              );
          }
        }
      } catch (e) {
        dbg("[Upload] fetch error:", e);
        if (!ignore)
          showMsgRef.current("Server error loading activities.", "error");
      } finally {
        if (!ignore) setLoadingActivities(false);
      }
    };
    load();
    return () => {
      ignore = true;
    };
  }, [classroomCode, role]);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setIsDragging(true);
    else setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) pickFile(dropped);
  };

  const canSubmit =
    role === "teacher" &&
    !!classroomCode &&
    title.trim() &&
    instructions.trim() &&
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
      fd.append("classroomCode", classroomCode);
      if (file) fd.append("file", file); // only append if provided

      const { data } = await apiFetch("/activity/create", {
        method: "POST",
        body: fd,
        form: true,
      });
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
            id: data.id,
            title: title.trim(),
            instructions: instructions.trim(),
            original_name: file?.name || null,
            created_at: new Date().toISOString(),
          },
          ...prev,
        ]);
        // Reload from server to match student view
        try {
          dbg("Reloading list after create");
          const { data: reload } = await apiFetch(
            `activity/classroom/${encodeURIComponent(classroomCode)}`
          );
          dbg("Reload response:", reload);
          if (reload?.success) setActivities(normalize(reload.activities));
        } catch (e) {
          dbg("Reload failed:", e);
        }
        setTitle("");
        setInstructions("");
        setFile(null);
      }
    } catch (e) {
      dbg("Submit exception:", e);
      showMsgRef.current("Server error.", "error");
    } finally {
      dbg("Submit finished");
      setCreating(false);
    }
  };

  return (
    <>
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
                  const f = e.target.files?.[0];
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
                >
                  ✕
                </button>
              </div>
            )}

            <button
              className={`upload-button ${!canSubmit ? "disabled" : ""}`}
              onClick={handleSubmit}
              disabled={!canSubmit}
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
                  <li key={a.id} className="activity-item">
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
                          {a.instructions?.length > 160 && "…"}
                        </div>
                      </div>

                      {a.original_name && (
                        <span className="activity-file-name">
                          {a.original_name}
                        </span>
                      )}

                      <div>
                        <span className="activity-date">
                          {fmtDate(a.created_at)}
                        </span>

                        <button
                          className="activity-open-btn"
                          type="button"
                          onClick={() => handleOpenActivity(a.id)}
                        >
                          View Activity
                        </button>
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
