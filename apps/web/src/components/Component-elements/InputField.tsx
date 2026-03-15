import React, { useId, useState } from "react";
import "./css/InputField.css";

type Size = "auto" | "md" | "lg" | "xl";

export interface InputFieldProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "size"
> {
  label?: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  showToggle?: boolean;
  onEnter?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  size?: Size;
  className?: string;
  helperText?: string;
}

export default function InputField({
  label,
  name,
  type = "text",
  value,
  onChange,
  placeholder,
  helperText,
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

  // Special handling for Grade and Section formatted input
  const isGradeAndSection = name === "gradeAndSection";

  // Parse the value into grade, strand, and section
  const parseGradeAndSection = (val: string) => {
    const parts = val.split("-");
    return {
      grade: parts[0] || "",
      strand: parts[1] || "",
      section: parts[2] || "",
    };
  };

  const { grade, strand, section } = isGradeAndSection
    ? parseGradeAndSection(String(value || ""))
    : { grade: "", strand: "", section: "" };

  const handleGradeAndSectionChange = (
    part: "grade" | "strand" | "section",
    newValue: string,
  ) => {
    const current = parseGradeAndSection(String(value || ""));
    current[part] = newValue;

    // Combine back into format: XX-YYYY-XY
    const combined = `${current.grade}-${current.strand}-${current.section}`;

    // Create a synthetic event
    const syntheticEvent = {
      target: {
        name: name || "",
        value: combined,
      },
    } as React.ChangeEvent<HTMLInputElement>;

    onChange?.(syntheticEvent);
  };

  const handleGradeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ""); // Only digits
    if (value.length <= 2) {
      handleGradeAndSectionChange("grade", value);
    }
  };

  const handleStrandChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^A-Za-z]/g, "").toUpperCase();
    if (value.length <= 5) {
      handleGradeAndSectionChange("strand", value);
    }
  };

  const handleSectionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    // Allow only letter followed by digit (e.g., A1, B2)
    if (/^[A-Z]?\d?$/.test(value) && value.length <= 2) {
      handleGradeAndSectionChange("section", value);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && onEnter) onEnter(e);
    if (onKeyDown)
      (onKeyDown as React.KeyboardEventHandler<HTMLInputElement>)(e);
  };

  // Render formatted input for Grade and Section
  if (isGradeAndSection) {
    return (
      <div
        className={`fi-field ${sizeClass} ${
          error ? "has-error" : ""
        } ${className} fi-formatted`}
      >
        {label && (
          <label className="fi-label" htmlFor={`${id}-${name || "input"}`}>
            {label} {required ? <span className="fi-required">*</span> : null}
          </label>
        )}
        <div className="fi-formatted-container">
          <input
            type="text"
            value={grade}
            onChange={handleGradeChange}
            placeholder="11"
            maxLength={2}
            className="fi-formatted-part fi-grade"
            disabled={disabled}
            aria-label="Grade"
          />
          <span className="fi-formatted-separator">-</span>
          <input
            type="text"
            value={strand}
            onChange={handleStrandChange}
            placeholder="ICT"
            maxLength={5}
            className="fi-formatted-part fi-strand"
            disabled={disabled}
            aria-label="Strand"
          />
          <span className="fi-formatted-separator">-</span>
          <input
            type="text"
            value={section}
            onChange={handleSectionChange}
            placeholder="A1"
            maxLength={2}
            className="fi-formatted-part fi-section"
            disabled={disabled}
            aria-label="Section"
          />
        </div>
        {hint && !error && <div className="fi-hint">{hint}</div>}
        {error && <div className="fi-error">{error}</div>}
        {helperText && <span className="helper-text">{helperText}</span>}
      </div>
    );
  }

  // Regular input field rendering
  return (
    <>
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
        {helperText && <span className="helper-text">{helperText}</span>}
      </div>
    </>
  );
}
