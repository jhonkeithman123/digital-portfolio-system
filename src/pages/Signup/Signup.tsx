import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Header from "components/Component-elements/Header.js";
import useMessage from "hooks/useMessage.js";
import InputField from "components/Component-elements/InputField.js";
import LoadingOverlay from "components/Component-elements/loading_overlay.js";
import useLoadingState from "hooks/useLoading.js";
import { apiFetchPublic } from "utils/apiClient.js";
import type { Role } from "types/models";
import "./Signup.css";
import { installLoginPageGuard } from "utils/tabAuth.js";
import { ALLOWED_EMAIL_DOMAINS } from "types/models";

const validRoles = ["student", "teacher"] as const;

const Signup: React.FC = (): React.ReactElement => {
  const navigate = useNavigate();
  const { messageComponent, showMessage } = useMessage();
  const showMsgRef = useRef<typeof showMessage>(showMessage);
  const { loading, wrap } = useLoadingState(false);

  const [username, setUsername] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [section, setSection] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");

  const [showVerification, setShowVerification] = useState<boolean>(false);
  const [verificationCode, setVerificationCode] = useState<string>("");
  const [resendCooldown, setResendCooldown] = useState<number>(0);

  const roleRaw = localStorage.getItem("role");
  const role = (roleRaw as Role | null) ?? null;

  const bgUrl = `${(import.meta.env as any).PUBLIC_URL || ""}/classroom.jpg`;

  useEffect(() => {
    showMsgRef.current = showMessage;
  }, [showMessage]);

  useEffect(() => {
    const cleanup = installLoginPageGuard();
    return cleanup;
  }, []);

  useEffect(() => {
    if (!role || !validRoles.includes(role as Role)) {
      try {
        localStorage.removeItem("user");
      } catch {}
      showMsgRef.current?.(
        "Your role is not in the storage. Please choose again.",
        "error",
      );
      setTimeout(() => navigate("/"), 2000);
    }
  }, [role, navigate]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(
        () => setResendCooldown(resendCooldown - 1),
        1000,
      );
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleSelect = (page: string = "login"): void => {
    navigate(`/${page}`);
  };

  const validateSectionFormat = (sectionInput: string): boolean => {
    const trimmed = sectionInput.trim().toUpperCase();

    // Pattern: Letters/numbers, dash, letters/numbers
    // Example: STEM-1, ABM-2A, ICT-12, HUMMS-3, GAS-11A
    const sectionPattern = /^[A-Z0-9]+-[A-Z0-9]+$/; // Letters/Numbers-letters/numbers
    return sectionPattern.test(trimmed);
  };

  const validateEmail = (email: string): { valid: boolean; error?: string } => {
    const trimmedEmail = email.trim().toLowerCase();

    // Basic email format validation
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(trimmedEmail)) {
      return {
        valid: false,
        error: "Please enter a valid email address (e.g., user@example.com)",
      };
    }

    // Extract domain from email
    const domain = trimmedEmail.split("@")[1];

    // Check if domain is in allowed list
    if (!ALLOWED_EMAIL_DOMAINS.includes(domain)) {
      return {
        valid: false,
        error: `Email domain not supported. Please use: ${ALLOWED_EMAIL_DOMAINS.slice(0, 5).join(", ")}, etc.`,
      };
    }

    return { valid: true };
  };

  const validate = (): boolean => {
    if (!username.trim() || !email.trim() || !password) {
      showMsgRef.current?.("All fields are required", "error");
      return false;
    }

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      showMsgRef.current?.(emailValidation.error || "Invalid email", "error");
      return false;
    }

    if (password.length < 6) {
      showMsgRef.current?.("Passwords must be at least 6 characters", "error");
      return false;
    }

    if (password !== confirmPassword) {
      showMsgRef.current?.("Passwords must match", "error");
      return false;
    }

    if (role === "student" && section.trim()) {
      if (!validateSectionFormat(section)) {
        showMsgRef.current?.(
          "Section must follow format: STRAND-LETTER+NUMBER (e.g., ICT-A2, STEM-B1, ABM-C3)",
          "error",
        );
        return false;
      }
    }

    return true;
  };

  const handleSignup = useCallback(async (): Promise<void> => {
    await wrap(async () => {
      if (!validate()) return;

      try {
        const normalizedSection = section.trim().toUpperCase() || null;

        const { ok, data } = await apiFetchPublic(
          `/auth/signup`,
          {
            method: "POST",
            body: JSON.stringify({
              username: username.trim(),
              email: email.trim(),
              password,
              role,
              section: role === "student" ? normalizedSection : null,
            }),
            headers: { "Content-Type": "application/json" },
          },
          { withCredentials: false },
        );

        if (ok && data?.success) {
          showMsgRef.current?.(
            "Account created! Please verify your email.",
            "success",
          );

          // Send verification code
          await requestVerificationCode();

          // Show verification form
          setShowVerification(true);
        } else {
          showMsgRef.current?.(data?.error || "Signup failed", "error");
        }
      } catch (err) {
        console.error("Signup error:", err);
        showMsgRef.current?.("Server error", "error");
      }
    });
  }, [wrap, username, email, password, role, section, validate]);

  const requestVerificationCode = useCallback(async (): Promise<void> => {
    await wrap(async () => {
      try {
        const { ok, data } = await apiFetchPublic(
          `/auth/request-verification`,
          {
            method: "POST",
            body: JSON.stringify({
              email: email.trim(),
              role,
            }),
            headers: { "Content-Type": "application/json" },
          },
          { withCredentials: false },
        );

        if (ok && data?.success) {
          showMsgRef.current?.(
            data.message || "Verification code sent to your email!",
            "success",
          );
          setResendCooldown(60); // 60 second cooldown
        } else {
          showMsgRef.current?.(
            data?.error || "Failed to send verification code",
            "error",
          );
        }
      } catch (err) {
        console.error("Request verification error:", err);
        showMsgRef.current?.("Server error", "error");
      }
    });
  }, [wrap, email, role]);

  const handleVerifyCode = useCallback(async (): Promise<void> => {
    await wrap(async () => {
      if (!verificationCode.trim()) {
        showMsgRef.current?.("Please enter the verification code", "error");
        return;
      }

      try {
        const { ok, data } = await apiFetchPublic(
          `/auth/verify-code`,
          {
            method: "POST",
            body: JSON.stringify({
              email: email.trim(),
              code: verificationCode.trim(),
            }),
            headers: { "Content-Type": "application/json" },
          },
          { withCredentials: false },
        );

        if (ok && data?.success) {
          showMsgRef.current?.(
            "Email verified! Redirecting to login...",
            "success",
          );
          setTimeout(() => navigate(`/login?role=${role}`), 1500);
        } else {
          showMsgRef.current?.(
            data?.error || "Invalid verification code",
            "error",
          );
        }
      } catch (err) {
        console.error("Verify code error:", err);
        showMsgRef.current?.("Server error", "error");
      }
    });
  }, [wrap, email, verificationCode, role, navigate]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (showVerification) {
      void handleVerifyCode();
    } else {
      void handleSignup();
    }
  };

  // Auto-uppercase section as user types
  const handleSectionChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ): void => {
    const value = e.target.value.toUpperCase();
    setSection(value);
  };

  return (
    <>
      <Header
        subtitle={
          showVerification
            ? "Verify Your Email"
            : role
              ? `Sign Up as ${String(role).toUpperCase()}`
              : "Sign Up"
        }
        leftActions={
          <button
            onClick={() => {
              if (showVerification) {
                setShowVerification(false);
                setVerificationCode("");
              } else {
                navigate("/");
              }
            }}
            className="header-link"
            disabled={loading}
          >
            ← Back
          </button>
        }
      />
      <div
        className="backgroundS"
        style={{ backgroundImage: `url(${bgUrl})` }}
        aria-hidden="true"
      />
      <div className="overlayS" />

      {messageComponent}

      <LoadingOverlay
        loading={loading}
        text={showVerification ? "Verifying..." : "Signing up..."}
        fullPage={false}
      />

      <form className="containerS" onSubmit={handleSubmit}>
        {!showVerification ? (
          <>
            <div className="input-containerS">
              <InputField
                label="Username"
                name="username"
                value={username}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setUsername(e.target.value)
                }
                autoComplete="username"
                placeholder="Username"
                required
              />

              {role === "student" && (
                <InputField
                  label="Section"
                  name="section"
                  value={section}
                  onChange={handleSectionChange}
                  placeholder="e.g. ICT-A2, STEM-B1"
                  helperText="Format: STRAND-LETTER+NUMBER (e.g., ICT-A2, HUMSS-B3)"
                />
              )}

              <InputField
                label="Email"
                name="email"
                type="email"
                value={email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setEmail(e.target.value)
                }
                autoComplete="email"
                placeholder="e.g., user@gmail.com"
                helperText="Supported: Gmail, Yahoo, Outlook, Hotmail, iCloud, etc."
                required
              />

              <InputField
                label="Password"
                name="password"
                type="password"
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setPassword(e.target.value)
                }
                autoComplete="new-password"
                placeholder="Password"
                showToggle
                required
              />

              <InputField
                label="Confirm Password"
                name="confirm"
                type="password"
                value={confirmPassword}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setConfirmPassword(e.target.value)
                }
                autoComplete="new-password"
                placeholder="Confirm Password"
                showToggle
                required
              />
            </div>
            <div className="button-containerS">
              <button type="submit" className="buttonS" disabled={loading}>
                Sign up
              </button>
              <button
                type="button"
                onClick={() => handleSelect()}
                className="buttonS buttonS-secondary"
                disabled={loading}
              >
                Back to Log in
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="input-containerS">
              <div style={{ marginBottom: "16px", textAlign: "center" }}>
                <p style={{ color: "#64748b", fontSize: "14px" }}>
                  We've sent a verification code to <strong>{email}</strong>
                </p>
                <p style={{ color: "#64748b", fontSize: "14px" }}>
                  Please check your email and enter the code below.
                </p>
              </div>

              <InputField
                label="Verification Code"
                name="verification-code"
                value={verificationCode}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setVerificationCode(e.target.value)
                }
                placeholder="Enter 6-digit code"
                maxLength={6}
                required
                autoComplete="one-time-code"
              />
            </div>
            <div className="button-containerS">
              <button type="submit" className="buttonS" disabled={loading}>
                Verify Email
              </button>
              <button
                type="button"
                onClick={() => void requestVerificationCode()}
                className="buttonS buttonS-secondary"
                disabled={loading || resendCooldown > 0}
              >
                {resendCooldown > 0
                  ? `Resend in ${resendCooldown}s`
                  : "Resend Code"}
              </button>
            </div>
          </>
        )}
      </form>
    </>
  );
};

export default Signup;
