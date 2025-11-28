import { useState } from "react";
import MessageContainer from "../components/Component-elements/MessageContainer";

export default function useMessage(defaultDuration = 2500) {
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [messageKey, setMessageKey] = useState(0);

  const showMessage = (msg, type = "info") => {
    setMessage(msg);
    setMessageType(type);
    setMessageKey((k) => k + 1);
  };

  const messageComponent = (
    <MessageContainer
      key={messageKey}
      type={messageType}
      message={message}
      onClose={() => setMessage("")}
      duration={defaultDuration}
    />
  );

  return { messageComponent, showMessage };
}
