import React, { useMemo, useEffect, useRef, useState } from "react";
import "./css/QuizTimer.css";
import type { QuizTimerProps } from "types/quiz";

export default function QuizTimer({
  expiresAt = null,
  onExpire,
  className = "",
  size = "medium",
}: QuizTimerProps): React.ReactElement {
  const computeRemainingMs = (exp?: Date | string | null) => {
    if (!exp) return 0;
    const target =
      exp instanceof Date ? exp.getTime() : new Date(exp).getTime();
    const diff = target - Date.now();
    return diff > 0 ? diff : 0;
  };

  const [remainingMs, setRemainingMs] = useState<number>(() =>
    computeRemainingMs(expiresAt),
  );
  const initialMsRef = useRef<number | null>(null);
  const expiredRef = useRef<boolean>(false);

  //* Record initial remaining when expiresAt changes so ring can show progress for current mount
  useEffect(() => {
    const ms = computeRemainingMs(expiresAt);

    setRemainingMs(ms);
    initialMsRef.current = ms > 0 ? ms : null;
    expiredRef.current = false;
  }, [expiresAt]);

  useEffect(() => {
    if (!expiresAt) return;
    if (remainingMs === 0) {
      if (!expiredRef.current) {
        expiredRef.current = true;
        onExpire?.();
      }
      return;
    }
    const interval = setInterval(() => {
      setRemainingMs(() => {
        const next = computeRemainingMs(expiresAt);
        if (next <= 0) {
          clearInterval(interval);
          if (!expiredRef.current) {
            expiredRef.current = true;
            onExpire?.();
          }
          return 0;
        }
        return next;
      });
    }, 250);
    return () => clearInterval(interval);
  }, [expiresAt, onExpire, remainingMs]);

  const totalMs = initialMsRef.current ?? Math.max(remainingMs, 1);
  const pct = Math.max(0, Math.min(1, remainingMs / totalMs));

  const sizePx = size === "small" ? 42 : size === "large" ? 78 : 56;
  const stroke = 6;
  const radius = (sizePx - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - pct);

  const minutes = Math.floor(remainingMs / 60000);
  const seconds = Math.ceil((remainingMs % 60000) / 1000);
  const label = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0",
  )}`;

  const stateClass = useMemo(() => {
    const pct100 = pct * 100;
    if (pct100 <= 10) return "qtimer-critical";
    if (pct100 <= 30) return "qtimer-warning";
    return "qtimer-ok";
  }, [pct]);

  return (
    <div
      className={`qtimer ${stateClass} ${className}`}
      data-size={size}
      role="timer"
      aria-live="polite"
      aria-atomic="true"
      style={{ "--qt-size": `${sizePx}px` } as React.CSSProperties}
    >
      <svg
        className="qtimer-svg"
        width={sizePx}
        height={sizePx}
        viewBox={`0 0 ${sizePx} ${sizePx}`}
        aria-hidden
      >
        <g transform={`translate(${sizePx / 2}, ${sizePx / 2})`}>
          <circle
            className="qtimer-track"
            r={radius}
            cx="0"
            cy="0"
            strokeWidth={stroke}
            fill="none"
          />
          <circle
            className="qtimer-progress"
            r={radius}
            cx="0"
            cy="0"
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${circumference}`}
            strokeDashoffset={dashOffset}
            style={{
              transition: "stroke-dashoffset 220ms linear, stroke 300ms linear",
            }}
          />
        </g>
      </svg>

      <div className="qtimer-body">
        <div className="qtimer-label">{label}</div>
        <div className="qtimer-sub">time left</div>
      </div>
    </div>
  );
}
