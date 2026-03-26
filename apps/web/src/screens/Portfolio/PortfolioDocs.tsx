"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "utils/apiClient";
import Header from "components/Component-elements/Header";
import NotificationBell from "components/Component-elements/NotificationBell";
import useLogout from "hooks/useLogout";
import useMessage from "hooks/useMessage";
import DrivePicker from "components/DrivePicker/DrivePicker";
import TokenGuard from "components/auth/tokenGuard";
import LoadingOverlay from "components/Component-elements/loading_overlay";
import { getLocalStorage, safeStorageGet } from "utils/safeStorage";
import "./Portfolio.css";
import { marked } from "marked";
import DOMPurify from "dompurify";

type PortfolioInfo = { name: string; files: string[] };

export default function PortfolioDocs(): React.ReactElement {
  const navigate = useNavigate();
  const { messageComponent, showMessage } = useMessage();
  const [portfolios, setPortfolios] = useState<PortfolioInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [driveOpen, setDriveOpen] = useState(false);

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

  const sanitizedHtml = useMemo(() => {
    if (!fileContent) return "";
    try {
      const raw = marked.parse(fileContent);
      return DOMPurify.sanitize(raw);
    } catch (e) {
      return "<pre>Failed to render markdown</pre>";
    }
  }, [fileContent]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const { data, unauthorized } = await apiFetch("/portfolio/docs");
        if (unauthorized) {
          showMsgRef.current("Session expired. Please sign in again.", "error");
          navigate("/login");
          return;
        }

        if (data?.success) {
          if (mounted) setPortfolios(data.portfolios || []);
        } else {
          showMsgRef.current("Failed to load portfolios", "error");
        }
      } catch (err) {
        showMsgRef.current("Network error loading portfolios", "error");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  const openFolder = async (folder: string) => {
    setSelectedFolder(folder);
    setFileContent(null);
    setFiles([]);
    setLoading(true);
    try {
      const { data, unauthorized } = await apiFetch(
        `/portfolio/docs/${encodeURIComponent(folder)}`,
      );
      if (unauthorized) {
        showMsgRef.current("Session expired. Please sign in again.", "error");
        navigate("/login");
        return;
      }

      if (data?.success) {
        setFiles(data.files || []);
      } else {
        showMsgRef.current("Failed to load folder", "error");
      }
    } catch (err) {
      showMsgRef.current("Network error loading folder", "error");
    } finally {
      setLoading(false);
    }
  };

  const openFile = async (file: string) => {
    setFileContent(null);
    setLoading(true);
    try {
      const { data, unauthorized } = await apiFetch(
        `/portfolio/docs/${encodeURIComponent(selectedFolder || "")}/${encodeURIComponent(file)}`,
      );
      if (unauthorized) {
        showMsgRef.current("Session expired. Please sign in again.", "error");
        navigate("/login");
        return;
      }

      if (data?.success) {
        setFileContent(data.content || "");
      } else {
        showMsgRef.current("Failed to load file", "error");
      }
    } catch (err) {
      showMsgRef.current("Network error loading file", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <TokenGuard
      redirectInfo="/login"
      onExpire={() =>
        showMsgRef.current("Session expired. Please sign in again.", "error")
      }
    >
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
          showDriveButton={false}
        />
        <LogoutModal />
        <div
          style={{
            display: "flex",
            gap: "1rem",
            padding: "1rem",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                className="header-link"
                onClick={() => navigate("/dash")}
                title="Back to Dashboard"
              >
                ← Back to Dashboard
              </button>
              <h2 style={{ margin: 0 }}>Portfolios</h2>
            </div>
            <div>
              <button
                className="dashboard-button"
                onClick={() => {
                  setSelectedFolder(null);
                  setFiles([]);
                  setFileContent(null);
                }}
              >
                Clear Selection
              </button>
              <button
                className="dashboard-button"
                onClick={() => setDriveOpen(true)}
                style={{ marginLeft: 8 }}
              >
                Open Drive
              </button>
            </div>
          </div>
          <aside style={{ width: 280 }}>
            <h3>Portfolios</h3>
            <ul style={{ listStyle: "none", padding: 0 }}>
              {portfolios.map((p) => (
                <li key={p.name} style={{ marginBottom: "0.5rem" }}>
                  <button
                    className="dashboard-button"
                    onClick={() => openFolder(p.name)}
                  >
                    {p.name}
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <main style={{ flex: 1 }}>
            {!selectedFolder ? (
              <div>
                <h2>Select a portfolio</h2>
                <p>Choose a folder to view markdown files.</p>
              </div>
            ) : (
              <div>
                <h2>{selectedFolder}</h2>
                <div style={{ display: "flex", gap: "1rem" }}>
                  <div style={{ width: 260 }}>
                    <h4>Files</h4>
                    <ul style={{ listStyle: "none", padding: 0 }}>
                      {files.map((f) => (
                        <li key={f} style={{ marginBottom: "0.5rem" }}>
                          <button
                            className="dashboard-button"
                            onClick={() => openFile(f)}
                          >
                            {f}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4>Content</h4>
                    {fileContent ? (
                      <div
                        className="portfolio-markdown"
                        style={{
                          border: "1px solid #e5e7eb",
                          padding: "1rem",
                          borderRadius: 6,
                          background: "var(--panel-bg, transparent)",
                        }}
                        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                      />
                    ) : (
                      <div style={{ color: "#6b7280" }}>
                        Select a file to view its content.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
        {driveOpen && (
          <DrivePicker
            onClose={() => setDriveOpen(false)}
            onSelect={(p) => {
              showMsgRef.current(`Selected ${p} from Drive`, "success");
              setDriveOpen(false);
            }}
          />
        )}
      </div>
    </TokenGuard>
  );
}
