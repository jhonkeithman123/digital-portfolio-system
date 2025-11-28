import { useId, useState } from "react";
import "./css/InputField.css";

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
  ...rest
}) {
  const id = useId();
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword && showToggle && revealed ? "text" : type;
  const sizeClass = `fi--${size || "auto"}`;

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
          onKeyDown={(e) => e.key === "Enter" && onEnter && onEnter(e)}
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
