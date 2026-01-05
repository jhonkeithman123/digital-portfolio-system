import React, { useEffect, useState } from "react";
import "./css/MessageContainer.css";

interface MessageContainerProps {
  type: "info" | "success" | "error";
  message: string | null;
  onClose: () => void;
  duration?: number;
}

const MessageContainer: React.FC<MessageContainerProps> = ({
  type = "info",
  message,
  onClose,
  duration = 3000,
}) => {
  const [visible, setVisible] = useState<boolean>(false);
  const [queueMessage, setQueueMessage] = useState<string>("");

  useEffect(() => {
    if (!message || message === queueMessage) return;

    setQueueMessage(message);
    setVisible(true);

    const ms = duration ?? 3000;
    const timer: ReturnType<typeof setTimeout> = window.setTimeout(() => {
      setVisible(false);
      if (onClose) onClose();
    }, ms);

    return () => window.clearTimeout(timer);
  }, [message, duration, onClose]);

  return (
    <div
      className={`toast ${type ?? ""} ${visible ? "slide-down" : "slide-up"}`}
    >
      <span className="toast-text">{message}</span>
      <button
        className="toast-close-btn"
        type="button"
        onClick={() => {
          setVisible(false);
          onClose();
        }}
        aria-label="Close notification"
      >
        x
      </button>
    </div>
  );
};

export default MessageContainer;
