import { useEffect, useRef, useState, useCallback } from "react";
import { apiFetch } from "../../utils/apiClient";
import PropTypes from "prop-types";
import useMessage from "../../hooks/useMessage";
import useLoadingState from "../../hooks/useLoading";
import "./css/ActivityComments.css";

const ActivityComments = ({ activityId }) => {
  const { messageComponent, showMessage } = useMessage();
  const { loading, wrap } = useLoadingState();

  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [replyDrafts, setReplyDrafts] = useState({});

  const showMsgRef = useRef(showMessage);

  useEffect(() => {
    showMsgRef.current = showMessage;
  }, [showMessage]);

  const load = useCallback(
    () =>
      wrap(async () => {
        try {
          const { data } = await apiFetch(
            `/activity/${encodeURIComponent(activityId)}/comments`
          );

          if (data?.success) {
            console.log("Comments GET payload", data.comments);
            const unique = Array.from(
              new Map((data.comments ?? []).map((item) => [item.id, item]))
            ).map(([, value]) => ({
              ...value,
              replies: value.replies ?? [],
            }));
            setComments(unique);
          } else if (data?.error) {
            showMsgRef.current(data.error, "error");
          }
        } catch (e) {
          console.error("Comments load err:", e);
          showMsgRef.current("Failed to load comments.", "error");
        }
      }),
    [activityId, wrap]
  );

  useEffect(() => {
    if (activityId) load();
  }, [activityId, load]);

  const submit = async () => {
    if (!text.trim()) return;
    const comment = text.trim();

    try {
      const { data } = await apiFetch(
        `/activity/${encodeURIComponent(activityId)}/comments`,
        {
          method: "POST",
          body: JSON.stringify({ comment }),
          headers: { "Content-Type": "application/json" },
        }
      );

      if (data?.success) {
        console.log("Comments POST response", data.comments);
        setText("");
        if (data.comments) {
          setComments((prev) => {
            const next = new Map([[data.comments.id, data.comments]]);
            prev.forEach((item) => next.set(item.id, item));
            return Array.from(next.values());
          });
        } else {
          load();
        }
        showMsgRef.current("Comment uploaded", "success");
      } else {
        showMsgRef.current(data?.error || "Failed to post comment", "error");
      }
    } catch (e) {
      console.error(e);
      showMsgRef.current("Server error", "error");
    }
  };

  const toggleReply = (id) => {
    setReplyDrafts((prev) => {
      if (Object.prototype.hasOwnProperty.call(prev, id)) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: "" };
    });
  };

  const submitReply = async (id) => {
    const draft = (replyDrafts[id] ?? "").trim();
    if (!draft) return;

    try {
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
    } catch (e) {
      console.error("Reply error:", e);
      showMsgRef.current("Server error", "error");
    }
  };

  return (
    <>
      {messageComponent}

      <section className="activity-section activity-comments">
        <h4>Comments</h4>
        <div className="comment-form">
          <textarea
            className="activity-textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a comment..."
          />
          <button onClick={submit} disabled={!text.trim()}>
            Post
          </button>
        </div>

        <hr className="comments-divider" />

        {loading ? (
          <p>Loading Comments...</p>
        ) : (
          <ul className="comments-list">
            {comments.length === 0 ? (
              <li className="empty">No comments yet.</li>
            ) : (
              comments.map((c) => (
                <li key={c.id} className="comment">
                  <div className="meta">
                    <strong>{c.username ?? c.authorName ?? "User"}</strong>
                    <time dateTime={c.created_at || c.createdAt}>
                      {new Date(c.created_at || c.createdAt).toLocaleString()}
                    </time>
                  </div>
                  <div className="body">{c.comment ?? c.text}</div>
                  <div className="comment-footer">
                    <button
                      className="reply-toggle"
                      type="button"
                      onClick={() => toggleReply(c.id)}
                    >
                      {Object.prototype.hasOwnProperty.call(replyDrafts, c.id)
                        ? "Cancel reply"
                        : "Reply"}
                    </button>
                  </div>

                  {c.replies?.length ? (
                    <ul className="comment-replies">
                      {c.replies.map((r) => (
                        <li className="comment-reply" key={r.id}>
                          <div className="meta">
                            <strong>{r.username ?? "User"}</strong>
                            <time dateTime={r.created_at || r.createdAt}>
                              {new Date(
                                r.created_at || r.createdAt
                              ).toLocaleString()}
                            </time>
                          </div>
                          <div className="body">{r.reply}</div>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {Object.prototype.hasOwnProperty.call(replyDrafts, c.id) && (
                    <div className="reply-form">
                      <textarea
                        value={replyDrafts[c.id]}
                        onChange={(e) =>
                          setReplyDrafts((prev) => ({
                            ...prev,
                            [c.id]: e.target.value,
                          }))
                        }
                        placeholder="Write a reply..."
                      />
                      <button
                        type="button"
                        onClick={() => submitReply(c.id)}
                        disabled={!replyDrafts[c.id]?.trim()}
                      >
                        Post a reply
                      </button>
                      ;
                    </div>
                  )}
                </li>
              ))
            )}
          </ul>
        )}
      </section>
    </>
  );
};

ActivityComments.propTypes = {
  activityId: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
    .isRequired,
};

export default ActivityComments;
