import React, { useEffect, useRef, useState, useCallback } from "react";
import { apiFetch } from "../../utils/apiClient";
import useMessage from "../../hooks/useMessage";
import useLoadingState from "../../hooks/useLoading";
import LoadingOverlay from "../Component-elements/loading_overlay";
import "./css/ActivityComments.css";

type Reply = {
  id: string | number;
  username?: string | null;
  reply?: string;
  created_at?: string | null;
  createdAt?: string | null;
  [k: string]: any;
};

type Comment = {
  id: string | number;
  username?: string | null;
  authorName?: string | null;
  comment?: string;
  text?: string;
  created_at?: string | null;
  createdAt?: string | null;
  replies?: Reply[];
  [k: string]: any;
};

interface ActivityCommentsProps {
  activityId: string | number;
}

const ActivityComments: React.FC<ActivityCommentsProps> = ({
  activityId,
}): React.ReactElement => {
  const { messageComponent, showMessage } = useMessage();
  const { loading, wrap } = useLoadingState();

  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState<string>("");
  const [replyDrafts, setReplyDrafts] = useState<
    Record<string | number, string>
  >({});

  const showMsgRef = useRef(showMessage);

  useEffect(() => {
    showMsgRef.current = showMessage;
  }, [showMessage]);

  const load = useCallback(
    (signal?: AbortSignal) => {
      return wrap(async () => {
        try {
          const { data } = await apiFetch<{
            success?: boolean;
            comments?: Comment[];
            error?: string;
          }>(`/activity/${encodeURIComponent(String(activityId))}/comments`, {
            signal,
          });

          if (data?.success) {
            const unique = Array.from(
              new Map(
                (data.comments ?? []).map((item) => [
                  item.id,
                  { ...item, replies: item.replies ?? [] },
                ])
              )
            ).map(([, value]) => value as Comment);
            setComments(unique);
          } else {
            showMsgRef.current(
              data?.error ?? "Failed to load comments",
              "error"
            );
          }
        } catch (e) {
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

  return (
    <>
      {messageComponent}
      <LoadingOverlay loading={loading} text="Processing..." fullPage={false} />
      <section className="activity-section activity-comments">
        <h4>Comments</h4>

        <div className="comment-form">
          <textarea
            className="activity-textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a comment..."
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
            comments.map((c) => (
              <li key={String(c.id)} className="comment">
                <div className="meta">
                  <strong>{c.username ?? c.authorName ?? "User"}</strong>
                  <time dateTime={c.created_at ?? c.createdAt ?? undefined}>
                    {new Date(
                      c.created_at ?? c.createdAt ?? ""
                    ).toLocaleString()}
                  </time>
                </div>

                <div className="body">{c.comment ?? c.text}</div>

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
                </div>

                {c.replies && c.replies.length > 0 && (
                  <ul className="comment-replies">
                    {c.replies.map((r) => (
                      <li className="comment-reply" key={String(r.id)}>
                        <div className="meta">
                          <strong>{r.username ?? "User"}</strong>
                          <time
                            dateTime={r.created_at ?? r.createdAt ?? undefined}
                          >
                            {new Date(
                              r.created_at ?? r.createdAt ?? ""
                            ).toLocaleString()}
                          </time>
                        </div>
                        <div className="body">{r.reply}</div>
                      </li>
                    ))}
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
            ))
          )}
        </ul>
      </section>
    </>
  );
};

export default ActivityComments;
