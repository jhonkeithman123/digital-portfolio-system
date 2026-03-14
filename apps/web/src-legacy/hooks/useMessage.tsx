import React, { useState } from "react";
import MessageContainer from "components/Component-elements/MessageContainer";

type MessageType = "info" | "success" | "error";

export default function useMessage(defaultDuration = 2500): {
  messageComponent: React.ReactElement | null;
  showMessage: (msg: string, type?: MessageType) => void;
} {
  const [message, setMessage] = useState<string | null>("");
  const [messageType, setMessageType] = useState<MessageType>("info");
  const [messageKey, setMessageKey] = useState<number>(0);

  const showMessage = (msg: string, type: MessageType = "info") => {
    setMessage(msg);
    setMessageType(type);
    setMessageKey((k) => k + 1);
  };

  const messageComponent =
    message !== null ? (
      <MessageContainer
        key={messageKey}
        type={messageType}
        message={message}
        onClose={() => setMessage(null)}
        duration={defaultDuration}
      />
    ) : null;

  return { messageComponent, showMessage };
}
