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

  useEffect(() => {
    if (!message) return;

    setVisible(true);

    const ms = duration ?? 3000;
    const timer = window.setTimeout(() => {
      setVisible(false);
      setTimeout(() => {
        if (onClose) onClose();
      }, 350);
    }, ms);

    return () => window.clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;

  return (
    <div
      className={`toast toast-${type} ${visible ? "slide-down" : "slide-up"}`}
    >
      <span className="toast-text">{message}</span>
      <button
        className="toast-close-btn"
        type="button"
        onClick={() => {
          setVisible(false);
          setTimeout(() => {
            onClose();
          }, 350);
        }}
        aria-label="Close notification"
      >
        x
      </button>
    </div>
  );
};

export default MessageContainer;
