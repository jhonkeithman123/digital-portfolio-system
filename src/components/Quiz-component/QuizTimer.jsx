import React, { useEffect, useState } from "react";

export default function QuizTimer({ expiresAt, onExpire }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.floor((new Date(expiresAt) - new Date()) / 1000)));

  useEffect(() => {
    setRemaining(Math.max(0, Math.floor((new Date(expiresAt) - new Date()) / 1000)));
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(id);
          if (onExpire) onExpire();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  return <div style={{ padding: "6px 10px", background: "#222", color: "#fff", borderRadius: 6 }}>{mm}:{ss}</div>;
}