import React, { useId, useState } from "react";
import "./css/InputField.css";

type Size = "auto" | "md" | "lg" | "xl";

export interface InputFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  showToggle?: boolean;
  onEnter?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  size?: Size;
  className?: string;
}

export default function InputField({
  label,
  name,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
  required = false,
  disabled = false,
  error,
  hint,
  showToggle = type === "password",
  onEnter,
  className = "",
  size = "auto", // md | lg | xl
  onKeyDown,
  ...rest
}: InputFieldProps): React.ReactElement {
  const id = useId();
  const [revealed, setRevealed] = useState<boolean>(false);
  const isPassword = type === "password";
  const inputType = isPassword && showToggle && revealed ? "text" : type;
  const sizeClass = `fi--${size || "auto"}`;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && onEnter) onEnter(e);
    if (onKeyDown)
      (onKeyDown as React.KeyboardEventHandler<HTMLInputElement>)(e);
  };

  return (
    <div
      className={`fi-field ${sizeClass} ${
        error ? "has-error" : ""
      } ${className}`}
    >
      {label && (
        <label className="fi-label" htmlFor={`${id}-${name || "input"}`}>
          {label} {required ? <span className="fi-required">*</span> : null}
        </label>
      )}
      <div className="fi-control">
        <input
          id={`${id}-${name || "input"}`}
          name={name}
          type={inputType}
          className="fi-input"
          placeholder={placeholder}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          required={required}
          disabled={disabled}
          onKeyDown={handleKeyDown}
          {...rest}
        />
        {isPassword && showToggle && (
          <button
            type="button"
            className={`fi-eye ${revealed ? "on" : ""}`}
            onClick={() => setRevealed((s) => !s)}
            aria-label={revealed ? "Hide password" : "Show password"}
            tabIndex={-1}
          >
            {revealed ? "🙈" : "👁️"}
          </button>
        )}
      </div>
      {hint && !error && <div className="fi-hint">{hint}</div>}
      {error && <div className="fi-error">{error}</div>}
    </div>
  );
}
