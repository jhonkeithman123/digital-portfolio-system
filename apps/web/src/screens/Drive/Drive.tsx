import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "utils/apiClient";
import Header from "components/Component-elements/Header";
import DOMPurify from "dompurify";
import NotificationBell from "components/Component-elements/NotificationBell";
import useLogout from "hooks/useLogout";
import useMessage from "hooks/useMessage";
import TokenGuard from "components/auth/tokenGuard";
import LoadingOverlay from "components/Component-elements/loading_overlay";
import { getLocalStorage, safeStorageGet } from "utils/safeStorage";
import "../Portfolio/Portfolio.css";

type Entry = { name: string; type: "file" | "folder" };

function Icon({ type }: { type: "file" | "folder" }) {
  return <div style={{ fontSize: 40 }}>{type === "folder" ? "📁" : "📄"}</div>;
}

function DriveContent(): React.ReactElement {
  const navigate = useNavigate();
  const { messageComponent, showMessage } = useMessage();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPath, setCurrentPath] = useState<string>("");
  const [historyStack, setHistoryStack] = useState<string[]>([]);

  const user = (() => {
    try {
      return JSON.parse(safeStorageGet(getLocalStorage(), "user") || "null");
    } catch {
      return null;
    }
  })();

  const showMsgRef = useRef(showMessage);
  useEffect(() => {
    showMsgRef.current = showMessage;
  }, [showMessage]);

  const [logout, LogoutModal] = useLogout();
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const loadPath = async (relPath = "") => {
    setLoading(true);
    try {
      // Use per-user Drive listing endpoint
      const { data, unauthorized } = await apiFetch(`/portfolio/drive/files`);
      if (unauthorized) {
        showMsgRef.current("Session expired. Please sign in again.", "error");
        navigate("/login");
        return;
      }
      if (data?.success) {
        const list: Entry[] = [];
        (data.files || []).forEach((f: { name: string }) =>
          list.push({ name: f.name, type: "file" }),
        );
        setEntries(list);
      } else {
        showMsgRef.current("Failed to load drive", "error");
      }
    } catch (err) {
      showMsgRef.current("Network error loading drive", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPath("");
  }, []);

  const openEntry = async (e: Entry) => {
    // For Drive entries (files) download via drive endpoint and preview inline
    if (e.type === "file") {
      try {
        const apiBase = (
          process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000"
        ).replace(/\/$/, "");
        const ext = e.name.includes(".")
          ? e.name.slice(e.name.lastIndexOf(".")).toLowerCase()
          : "";

        // Use preview endpoint for ODT -> HTML
        if (ext === ".odt") {
          const url = `${apiBase}/portfolio/drive/preview?path=${encodeURIComponent(
            e.name,
          )}`;
          const res = await fetch(url, { credentials: "include" });
          if (!res.ok) {
            showMsgRef.current("Failed to preview file", "error");
            return;
          }
          const html = await res.text();
          setPreviewName(e.name);
          setPreviewType("html");
          setPreviewText(html);
          setPreviewUrl(null);
          setPreviewOpen(true);
          return;
        }

        const url = `${apiBase}/portfolio/drive/download?path=${encodeURIComponent(e.name)}`;
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) {
          showMsgRef.current("Failed to download file", "error");
          return;
        }

        const ct = res.headers.get("content-type") || "";
        setPreviewName(e.name);

        if (ct.startsWith("text/") || ct === "application/json") {
          const txt = await res.text();
          setPreviewType("text");
          setPreviewText(txt);
          setPreviewUrl(null);
          setPreviewOpen(true);
          return;
        }

        // binary (image, pdf, other) -> blob + object URL
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        if (ct.startsWith("image/")) {
          setPreviewType("image");
        } else if (ct === "application/pdf") {
          setPreviewType("pdf");
        } else if (ct.startsWith("video/")) {
          setPreviewType("video");
        } else {
          setPreviewType("other");
        }
        setPreviewText(null);
        setPreviewUrl(blobUrl);
        setPreviewOpen(true);
      } catch (err) {
        console.error("Drive openEntry error", err);
        showMsgRef.current("Failed to open file", "error");
      }
    }
  };

  const goBack = async () => {
    const prev = historyStack[historyStack.length - 1] ?? "";
    setHistoryStack((s) => s.slice(0, -1));
    setCurrentPath(prev);
    await loadPath(prev);
  };

  // Preview modal state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewType, setPreviewType] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string | null>(null);

  const closePreview = () => {
    setPreviewOpen(false);
    setPreviewType(null);
    setPreviewText(null);
    setPreviewName(null);
    if (previewUrl) {
      try {
        URL.revokeObjectURL(previewUrl);
      } catch {}
      setPreviewUrl(null);
    }
  };

  return (
    <div className="portfolio-page">
      <Header
        variant="authed"
        user={user}
        leftActions={
          <button
            className="header-link"
            onClick={() => navigate("/dash")}
            title="Back to Dashboard"
          >
            ← Back to Dashboard
          </button>
        }
        headerClass={"app-header portfolio-header-main"}
        welcomeClass="app-welcome"
        showDriveButton={false}
        rightActions={
          <>
            <NotificationBell
              unreadCount={unreadCount}
              setUnreadCount={setUnreadCount}
            />
            {user?.role === "teacher" && user?.isAdmin && (
              <button className="pill-btn" onClick={() => navigate("/admin")}>
                Admin Panel
              </button>
            )}
            <button className="pill-btn" onClick={() => logout()}>
              Logout
            </button>
          </>
        }
      />

      {messageComponent}
      <LogoutModal />
      {loading && (
        <LoadingOverlay
          loading={true}
          text="Loading drive..."
          fullPage={false}
        />
      )}

      <div style={{ padding: 16 }}>
        <div
          className="portfolio-toolbar"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h2 style={{ margin: 0 }}>Drive</h2>
          </div>

          <div>
            <button
              className="dashboard-button"
              onClick={() => {
                setCurrentPath("");
                setHistoryStack([]);
                loadPath("");
              }}
            >
              Refresh
            </button>
            <button
              className="dashboard-button"
              onClick={goBack}
              disabled={historyStack.length === 0}
              style={{ marginLeft: 8 }}
            >
              Back
            </button>
            <label style={{ marginLeft: 8 }} className="dashboard-button">
              <input
                type="file"
                style={{ display: "none" }}
                onChange={async (ev) => {
                  const f = ev.currentTarget.files?.[0];
                  if (!f) return;
                  const fd = new FormData();
                  fd.append("file", f);
                  try {
                    const { data, unauthorized } = await apiFetch(
                      "/portfolio/drive/upload",
                      {
                        method: "POST",
                        body: fd,
                        form: true as any,
                      } as any,
                    );
                    if (unauthorized) return;
                    if (data?.success) {
                      showMsgRef.current("Uploaded to Drive", "success");
                      await loadPath("");
                    } else {
                      showMsgRef.current("Failed to upload", "error");
                    }
                  } catch (e) {
                    console.error("Drive upload error", e);
                    showMsgRef.current("Upload error", "error");
                  }
                }}
              />
              Upload
            </label>
          </div>
        </div>

        <div
          style={{
            minHeight: "60vh",
            border: "1px dashed #e5e7eb",
            borderRadius: 8,
            padding: 16,
            marginTop: 12,
          }}
        >
          {entries.length === 0 && !loading ? (
            <div style={{ textAlign: "center", color: "#94a3b8" }}>
              <p style={{ fontSize: 48 }}>🗂️</p>
              <p>No items here yet.</p>
              <p>Use the `docs/portfolios` folder to add files and folders.</p>
            </div>
          ) : (
            <div className="drive-grid">
              {entries.map((ent) => (
                <div
                  key={ent.name}
                  className="drive-item-card"
                  onDoubleClick={() => openEntry(ent)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") openEntry(ent);
                  }}
                >
                  <div className="drive-icon">
                    <Icon type={ent.type} />
                  </div>
                  <div className="drive-entry-name" title={ent.name}>
                    {ent.name}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {previewOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 120,
            padding: 16,
          }}
          onClick={closePreview}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "95%",
              maxHeight: "90%",
              width: previewType === "image" ? "auto" : "90%",
              background: "var(--panel-bg, #0b0d14)",
              borderRadius: 8,
              padding: 12,
              boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
              overflow: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <strong style={{ color: "#fff" }}>{previewName}</strong>
              <div>
                <button
                  className="dashboard-button"
                  onClick={() => {
                    if (previewUrl) {
                      const a = document.createElement("a");
                      a.href = previewUrl;
                      a.download = previewName || "file";
                      a.click();
                    }
                  }}
                >
                  Download
                </button>
                <button
                  className="dashboard-button"
                  style={{ marginLeft: 8 }}
                  onClick={closePreview}
                >
                  Close
                </button>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              {previewType === "image" && previewUrl && (
                <img
                  src={previewUrl}
                  alt={previewName || "preview"}
                  style={{
                    maxWidth: "100%",
                    maxHeight: "75vh",
                    display: "block",
                    margin: "0 auto",
                  }}
                />
              )}
              {previewType === "pdf" && previewUrl && (
                <iframe
                  src={previewUrl}
                  title={previewName || "pdf"}
                  style={{ width: "100%", height: "75vh", border: 0 }}
                />
              )}
              {previewType === "video" && previewUrl && (
                <video
                  controls
                  src={previewUrl}
                  style={{ width: "100%", maxHeight: "75vh" }}
                />
              )}
              {previewType === "text" && previewText && (
                <pre
                  style={{
                    color: "#e5e7eb",
                    whiteSpace: "pre-wrap",
                    maxHeight: "75vh",
                    overflow: "auto",
                  }}
                >
                  {previewText}
                </pre>
              )}
              {previewType === "html" && previewText && (
                <div
                  style={{
                    color: "#e5e7eb",
                    maxHeight: "75vh",
                    overflow: "auto",
                  }}
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(previewText),
                  }}
                />
              )}
              {previewType === "other" && (
                <div style={{ color: "#e5e7eb" }}>
                  <p>Preview not available for this file type.</p>
                  {previewUrl && (
                    <a
                      href={previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open in new tab
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Drive(): React.ReactElement {
  return (
    <TokenGuard
      redirectInfo="/login"
      onExpire={() =>
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        undefined
      }
    >
      <DriveContent />
    </TokenGuard>
  );
}

// Public variant for debugging (no TokenGuard)
export function DrivePublic(): React.ReactElement {
  return <DriveContent />;
}
