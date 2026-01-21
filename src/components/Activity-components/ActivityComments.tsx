import React, { useEffect, useRef, useState, useCallback } from "react";
import { apiFetch } from "../../utils/apiClient";
import useMessage from "../../hooks/useMessage";
import useLoadingState from "../../hooks/useLoading";
import LoadingOverlay from "../Component-elements/loading_overlay";
import "./css/ActivityComments.css";
import useConfirm from "../../hooks/useConfirm";

import type { Comment, ActivityCommentsProps } from "../../types/activity";
import useRealTimeData from "../../hooks/useRealTimeData";

const ActivityComments: React.FC<ActivityCommentsProps> = ({
  activityId,
}): React.ReactElement => {
  const { messageComponent, showMessage } = useMessage();
  const { loading, wrap } = useLoadingState();
  const [confirm, ConfirmModal] = useConfirm();

  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState<string>("");
  const [replyDrafts, setReplyDrafts] = useState<
    Record<string | number, string>
  >({});
  const [editDrafts, setEditDrafts] = useState<Record<string | number, string>>(
    {}
  );
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const showMsgRef = useRef<typeof showMessage>(showMessage);

  //* current user id from localStorage "user" (fallback null)
  const currentUserId = (() => {
    try {
      // Try "user" first
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const user = JSON.parse(userStr);
        console.log("[ActivityComments] User from localStorage:", user);
        return user?.ID ?? user?.id ?? user?.userId ?? null;
      }

      // Try decoding token as fallback
      const token = localStorage.getItem("token");
      if (token) {
        const payload = JSON.parse(atob(token.split(".")[1]));
        console.log("[ActivityComments] User from token:", payload);
        return payload?.ID ?? payload?.userId ?? payload?.id ?? null;
      }

      return null;
    } catch (e) {
      console.error("[ActivityComments] Failed to get user ID:", e);
      return null;
    }
  })() as string | number | null;

  console.log("[ActivityComments] Current user ID:", currentUserId);

  useEffect(() => {
    showMsgRef.current = showMessage;
  }, [showMessage]);

  // Real-time polling for comments
  const { refresh: refreshComments, isPolling } = useRealTimeData({
    fetchFn: async () => {
      if (!activityId) return [];
      const { data } = await apiFetch(
        `/activity/${encodeURIComponent(String(activityId))}/comments`
      );
      if (data?.success && Array.isArray(data.comments)) {
        const unique = Array.from(
          new Map(
            (data.comments ?? []).map((item: Comment) => [
              item.id,
              { ...item, replies: item.replies ?? [] },
            ])
          )
        ).map(([, value]) => value as Comment);
        return unique;
      }
      return [];
    },
    interval: 8000, // Poll every 8 seconds
    enabled: !!activityId,
    onChange: (comments) => {
      setComments(comments);
    },
  });

  const load = useCallback(
    (signal?: AbortSignal) => {
      return wrap(async () => {
        try {
          const response = await apiFetch<{
            success?: boolean;
            comments?: Comment[];
            error?: string;
          }>(`/activity/${encodeURIComponent(String(activityId))}/comments`, {
            signal,
          });

          const { data, ok, status } = response;

          if (!ok || status !== 200) {
            console.warn("[ActivityComments] Request failed:", { ok, status });
            if (data?.error) {
              showMsgRef.current(data.error, "error");
            }
            return;
          }

          if (data?.success && Array.isArray(data.comments)) {
            const unique = Array.from(
              new Map(
                (data.comments ?? []).map((item) => [
                  item.id,
                  { ...item, replies: item.replies ?? [] },
                ])
              )
            ).map(([, value]) => value as Comment);

            console.log("[ActivityComments] Loaded comments:", unique.length);
            setComments(unique);
          } else {
            console.warn(
              "[ActivityComments] No success or invalid data:",
              data
            );
            if (data?.error) {
              showMsgRef.current(data.error, "error");
            }
          }
        } catch (e) {
          // FIX: Ignore AbortError - it's expected when component unmounts
          if (e instanceof Error && e.name === "AbortError") {
            console.log("[ActivityComments] Request aborted (cleanup)");
            return;
          }

          console.error("Comments load err:", e);
          showMsgRef.current("Failed to load comments.", "error");
        }
      });
    },
    [activityId, wrap]
  );

  useEffect(() => {
    if (!activityId) return;
    const ac = new AbortController();
    void load(ac.signal);
    return () => ac.abort();
  }, [activityId, load]);

  const submit = useCallback(async () => {
    if (!text.trim()) return;
    const comment = text.trim();
    await wrap(async () => {
      const { data } = await apiFetch<{
        success?: boolean;
        comments?: Comment;
        error?: string;
      }>(`/activity/${encodeURIComponent(String(activityId))}/comments`, {
        method: "POST",
        body: JSON.stringify({ comment }),
        headers: { "Content-Type": "application/json" },
      });

      if (data?.success) {
        setText("");
        const newComment = data.comments;
        if (newComment) {
          setComments((prev) => {
            const next = new Map<string | number, Comment>([
              [newComment.id, newComment],
            ]);
            prev.forEach((item) => next.set(item.id, item));
            return Array.from(next.values());
          });
        } else {
          await load();
        }
        showMsgRef.current("Comment uploaded", "success");
      } else {
        showMsgRef.current(data?.error ?? "Failed to post comment", "error");
      }
    });
  }, [activityId, text, load, wrap]);

  const toggleReply = useCallback((id: string | number) => {
    setReplyDrafts((prev) => {
      if (Object.prototype.hasOwnProperty.call(prev, id)) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: "" };
    });
  }, []);

  const startEdit = useCallback((c: Comment) => {
    setEditDrafts((prev) => ({
      ...prev,
      [c.id]: String(c.comment ?? c.text ?? ""),
    }));
    setEditingId(c.id);
  }, []);

  const cancelEdit = useCallback((id: string | number) => {
    setEditDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setEditingId((cur) => (cur === id ? null : cur));
  }, []);

  const submitReply = async (id: string | number): Promise<void> => {
    const draft = (replyDrafts[id] ?? "").trim();
    if (!draft) return;

    await wrap(async () => {
      const { data } = await apiFetch(
        `/activity/${encodeURIComponent(
          activityId
        )}/comments/${encodeURIComponent(id)}/replies`,
        {
          method: "POST",
          body: JSON.stringify({ reply: draft }),
          headers: { "Content-Type": "application/json" },
        }
      );

      if (data?.success && data?.reply) {
        setComments((prev) =>
          prev.map((c) =>
            c.id === id
              ? { ...c, replies: [...(c.replies ?? []), data.reply] }
              : c
          )
        );
        setReplyDrafts((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        showMsgRef.current("Reply added", "success");
      } else {
        showMsgRef.current(data?.error || "Failed to add reply", "error");
      }
    });
  };

  const submitEdit = useCallback(
    async (id: string | number) => {
      const draft = (editDrafts[id] ?? "").trim();
      if (!draft)
        return showMsgRef.current?.("Comment cannot be empty", "error");

      await wrap(async () => {
        try {
          const { data, unauthorized } = await apiFetch(
            `/activity/${encodeURIComponent(
              String(activityId)
            )}/comments/${encodeURIComponent(String(id))}`,
            {
              method: "PATCH",
              body: JSON.stringify({ comment: draft }),
              headers: { "Content-Type": "application/json" },
            }
          );

          if (unauthorized) {
            showMsgRef.current?.(
              "Session expired. Please login again",
              "error"
            );
            return;
          }

          if (data?.success) {
            //* Check if the comment is a comment or a reply to a comment
            if (data?.type === "comment" && data?.comment) {
              const updated = data.comment;
              setComments((prev) =>
                prev.map((c) => (c.id === id ? { ...c, ...updated } : c))
              );
              showMsgRef.current?.("Comment updated", "success");
            } else if (data.type === "reply" && data.reply) {
              const updatedReply = data.reply;
              setComments((prev) =>
                prev.map((c) => ({
                  ...c,
                  replies: (c.replies ?? []).map((r) =>
                    String((r as any).id) === String(updatedReply.id)
                      ? updatedReply
                      : r
                  ),
                }))
              );
              showMsgRef.current?.("Reply updated", "success");
            } else {
              console.warn(
                "[ActivityComments] Unexpected response structure:",
                data
              );
              showMsgRef.current?.("Updated successfuly", "success");
            }

            // clear edit state
            setEditDrafts((prev) => {
              const next = { ...prev };
              delete next[id];
              return next;
            });
            setEditingId((cur) => (cur === id ? null : cur));
          } else {
            console.warn("[ActivityComments] update failed:", data);
            showMsgRef.current?.(
              data?.error ?? "Failed to updated comment",
              "error"
            );
          }
        } catch (e: unknown | undefined) {
          console.error("Edit comment error:", e);
          showMsgRef.current?.("Server error", "error");
        }
      });
    },
    [activityId, editDrafts, wrap]
  );

  const deleteComment = useCallback(
    async (id: string | number) => {
      await wrap(async () => {
        const ok = await confirm({
          title: "Delete comment?",
          message: "Are you sure you want to delete this comment?",
          confirmText: "Delete",
          cancelText: "Cancel",
        });

        if (!ok) return;

        try {
          const { data, unauthorized } = await apiFetch(
            `/activity/${encodeURIComponent(
              String(activityId)
            )}/comments/${encodeURIComponent(String(id))}`,
            {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
            }
          );

          if (unauthorized) {
            showMsgRef.current?.(
              data?.error || "Session expired. Please login again",
              "error"
            );
            return;
          }

          if (data?.success) {
            setComments((prev) => prev.filter((c) => c.id !== id));
            showMsgRef.current?.(data?.message || "Comment deleted", "success");
          } else {
            showMsgRef.current?.(
              data?.error ?? "Failed to delete comment",
              "error"
            );
          }
        } catch (e) {
          console.error("Delete comment error:", e);
          showMsgRef.current?.("Server error", "error");
        }
      });
    },
    [activityId, wrap]
  );

  const deleteReply = useCallback(
    async (commentId: string | number, replyId: string | number) => {
      await wrap(async () => {
        const ok = await confirm({
          title: "Delete this comment?",
          message: "Are you sure you want to delete this comment",
          confirmText: "Delete",
          cancelText: "Cancel",
        });

        if (!ok) return;

        try {
          const { data, unauthorized } = await apiFetch(
            `/activity/${encodeURIComponent(
              String(activityId)
            )}/comments/${encodeURIComponent(
              String(commentId)
            )}/replies/${encodeURIComponent(String(replyId))}`,
            {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
            }
          );

          if (unauthorized) {
            showMsgRef.current?.(
              data?.error || "Session expired. Please login again.",
              "error"
            );
            return;
          }

          if (data?.success) {
            setComments((prev) =>
              prev.map((c) =>
                c.id === commentId
                  ? {
                      ...c,
                      replies: (c.replies ?? []).filter(
                        (r) => String((r as any).id) !== String(replyId)
                      ),
                    }
                  : c
              )
            );
            showMsgRef.current?.("Reply delete", "success");
          } else {
            showMsgRef.current?.(
              data?.error ?? "Failed to delete reply",
              "error"
            );
          }
        } catch (e) {
          console.error("Delete reply error:", e);
          showMsgRef.current?.("Server error", "error");
        }
      });
    },
    [activityId, wrap]
  );

  return (
    <>
      {messageComponent}
      <ConfirmModal />
      <LoadingOverlay loading={loading} text="Processing..." fullPage={false} />
      <section className="activity-section activity-comments">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1rem",
          }}
        >
          <h4 style={{ margin: 0 }}>Comments</h4>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {isPolling && (
              <span
                className="polling-indicator"
                title="Checking for updates..."
              >
                🔄
              </span>
            )}
            <button
              className="refresh-btn"
              onClick={refreshComments}
              disabled={loading}
              title="Refresh comments"
              style={{
                padding: "6px 12px",
                fontSize: "13px",
                background: "var(--accent-color)",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="comment-form">
          <textarea
            className="activity-textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a comment..."
            disabled={loading}
          />
          <button onClick={submit} disabled={!text.trim() || loading}>
            Post
          </button>
        </div>

        <hr className="comments-divider" />

        <ul className="comments-list">
          {comments.length === 0 && !loading ? (
            <li className="empty">No comments yet.</li>
          ) : (
            comments.map((c) => {
              const isAuthor =
                currentUserId !== null &&
                String(currentUserId) === String(c.user_id);

              console.log("[ActivityComments] Comment check:", {
                commentId: c.id,
                commentUserId: c.user_id,
                currentUserId,
                isAuthor,
              });

              const edited =
                !!(c.updated_at ?? c.updatedAt) &&
                (c.updated_at ?? c.updatedAt) !== (c.created_at ?? c.createdAt);

              return (
                <li key={String(c.id)} className="comment">
                  <div className="meta">
                    <strong>{c.username ?? c.authorName ?? "User"}</strong>
                    <time dateTime={c.created_at ?? c.createdAt ?? undefined}>
                      {new Date(
                        c.created_at ?? c.createdAt ?? ""
                      ).toLocaleString()}
                    </time>
                  </div>

                  {editingId === c.id ? (
                    <div className="edit-area">
                      <textarea
                        disabled={loading}
                        value={editDrafts[c.id] ?? ""}
                        onChange={(e) =>
                          setEditDrafts((prev) => ({
                            ...prev,
                            [c.id]: e.target.value,
                          }))
                        }
                        className="activity-textarea edit-textarea"
                      />
                      <div className="edit-actions">
                        <button
                          type="button"
                          onClick={() => void submitEdit(c.id)}
                          disabled={loading || !(editDrafts[c.id] ?? "").trim()}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => cancelEdit(c.id)}
                          disabled={loading}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="body">
                      {c.comment ?? c.text}{" "}
                      {edited && <span className="edited-label">(edited)</span>}
                    </div>
                  )}

                  <div className="comment-footer">
                    <button
                      className="reply-toggle"
                      type="button"
                      onClick={() => toggleReply(c.id)}
                      disabled={loading}
                    >
                      {Object.prototype.hasOwnProperty.call(replyDrafts, c.id)
                        ? "Cancel reply"
                        : "Reply"}
                    </button>
                    {isAuthor && editingId !== c.id && (
                      <button
                        className="reply-toggle"
                        type="button"
                        onClick={() => startEdit(c)}
                        disabled={loading}
                      >
                        Edit
                      </button>
                    )}
                    <button
                      className="delete-btn"
                      type="button"
                      onClick={() => void deleteComment(c.id)}
                      disabled={loading}
                    >
                      Delete
                    </button>
                  </div>

                  {c.replies && c.replies.length > 0 && (
                    <ul className="comment-replies">
                      {c.replies.map((r) => {
                        const isReplyAuthor =
                          currentUserId !== null &&
                          String(currentUserId) === String((r as any).user_id);
                        const replyEdited = (r as any).edited === 1;

                        return (
                          <li
                            className="comment-reply"
                            key={String((r as any).id)}
                          >
                            <div className="meta">
                              <strong>{(r as any).username ?? "User"}</strong>
                              <time
                                dateTime={
                                  (r as any).created_at ??
                                  (r as any).createdAt ??
                                  undefined
                                }
                              >
                                {new Date(
                                  (r as any).created_at ??
                                    (r as any).createdAt ??
                                    ""
                                ).toLocaleString()}
                              </time>
                            </div>

                            {editingId === (r as any).id ? (
                              <div className="edit-area">
                                <textarea
                                  disabled={loading}
                                  value={editDrafts[(r as any).id] ?? ""}
                                  onChange={(e) =>
                                    setEditDrafts((prev) => ({
                                      ...prev,
                                      [(r as any).id]: e.target.value,
                                    }))
                                  }
                                  className="activity-textarea edit-textarea"
                                />
                                <div className="edit-actions">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void submitEdit((r as any).id)
                                    }
                                    disabled={
                                      loading ||
                                      !(editDrafts[(r as any).id] ?? "").trim()
                                    }
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => cancelEdit((r as any).id)}
                                    disabled={loading}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="body">
                                {(r as any).reply}{" "}
                                {replyEdited && (
                                  <span className="edited-label">(edited)</span>
                                )}
                              </div>
                            )}

                            <div className="comment-footer">
                              {isReplyAuthor && editingId !== (r as any).id && (
                                <>
                                  <button
                                    className="reply-toggle"
                                    type="button"
                                    onClick={() => {
                                      // start edit for reply
                                      setEditDrafts((prev) => ({
                                        ...prev,
                                        [(r as any).id]: String(
                                          (r as any).reply ?? ""
                                        ),
                                      }));
                                      setEditingId((r as any).id);
                                    }}
                                    disabled={loading}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    className="delete-btn"
                                    type="button"
                                    onClick={() =>
                                      void deleteReply(c.id, (r as any).id)
                                    }
                                    disabled={loading}
                                  >
                                    Delete
                                  </button>
                                </>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {Object.prototype.hasOwnProperty.call(replyDrafts, c.id) && (
                    <div className="reply-form">
                      <textarea
                        value={replyDrafts[c.id] ?? ""}
                        onChange={(e) =>
                          setReplyDrafts((prev) => ({
                            ...prev,
                            [c.id]: e.target.value,
                          }))
                        }
                        placeholder="Write a reply..."
                        disabled={loading}
                      />
                      <button
                        type="button"
                        onClick={() => submitReply(c.id)}
                        disabled={!replyDrafts[c.id]?.trim() || loading}
                      >
                        Post a reply
                      </button>
                    </div>
                  )}
                </li>
              );
            })
          )}
        </ul>
      </section>
    </>
  );
};

export default ActivityComments;
