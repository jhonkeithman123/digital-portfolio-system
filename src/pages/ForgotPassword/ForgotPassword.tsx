import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../../components/Component-elements/Header";
import useMessage from "../../hooks/useMessage";
import InputField from "../../components/Component-elements/InputField";
import { apiFetchPublic } from "../../utils/apiClient";
import "./ForgotPassword.css";

const validRoles = ["student", "teacher"] as const;
type Role = (typeof validRoles)[number];

export default function ForgotPassword(): React.ReactElement {
  const navigate = useNavigate();
  const { messageComponent, showMessage } = useMessage();

  const showMsgRef = useRef(showMessage);

  const [code, setCode] = useState<string>("");
  const [step, setStep] = useState<"verify" | "code" | "reset">("verify");
  const [email, setEmail] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [retryPassword, setRetryPassword] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const roleRaw = localStorage.getItem("role");
  const role = (roleRaw as Role | null) ?? null;

  const bgUrl = `${(import.meta.env as any).PUBLIC_URL || ""}/classroom.jpg`;

  useEffect(() => {
    showMsgRef.current = showMessage;
  }, [showMessage]);

  useEffect(() => {
    if (!role || !validRoles.includes(role as Role)) {
      try {
        localStorage.removeItem("user");
      } catch {}
      showMsgRef.current(
        "Your role is not in the storage. Please choose again.",
        "error"
      );
      navigate("/");
    }
  }, [role, navigate]);

  const handleSelect = (page = "login"): void => {
    navigate(`/${page}`);
  };

  const isValidEmail = (e: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(e);
  };

  const handleCodeVerify = async (): Promise<void> => {
    setLoading(true);
    if (!code.trim()) {
      showMsgRef.current("Please enter the verification code.", "error");
      setLoading(false);
      return;
    }

    try {
      const { ok, data } = await apiFetchPublic(`/auth/verify-code`, {
        method: "POST",
        body: JSON.stringify({ email, code }),
        headers: { "Content-Type": "application/json" },
      } as RequestInit);

      if (ok && data?.success) {
        showMsgRef.current(data.message || "Email verified!", "success");
        setStep("reset");
      } else {
        showMsgRef.current(data?.message || "Invalid or expired code", "error");
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      showMsgRef.current("Server error. Try again later.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (): Promise<void> => {
    setLoading(true);
    if (!email.trim()) {
      showMsgRef.current("Email is required.", "error");
      setLoading(false);
      return;
    }

    if (!isValidEmail(email)) {
      showMsgRef.current("Please enter a valid email address.", "error");
      setLoading(false);
      return;
    }

    try {
      const { ok, data } = await apiFetchPublic(`/auth/request-verification`, {
        method: "POST",
        body: JSON.stringify({ email, role }),
        headers: { "Content-Type": "application/json" },
      } as RequestInit);

      if (ok && data?.success) {
        showMsgRef.current(
          data.message || "Verification code sent!",
          "success"
        );
        setStep("code");
      } else {
        // eslint-disable-next-line no-console
        console.error(data);
        showMsgRef.current(
          data?.error || "Failed to send verification code.",
          "error"
        );
      }
    } catch (error) {
      showMsgRef.current("Server error. Please try again later.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (): Promise<void> => {
    setLoading(true);
    if (!newPassword || !retryPassword) {
      showMsgRef.current("Please fill in both password fields.", "error");
      setLoading(false);
      return;
    }

    if (newPassword !== retryPassword) {
      showMsgRef.current("Passwords do not match.", "error");
      setLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      showMsgRef.current("Password must be at least 6 characters.", "error");
      setLoading(false);
      return;
    }

    try {
      const { ok, data } = await apiFetchPublic(`/auth/reset-password`, {
        method: "PATCH",
        body: JSON.stringify({ email, newPassword }),
        headers: { "Content-Type": "application/json" },
      } as RequestInit);

      if (ok && data?.success) {
        showMsgRef.current(
          data.message || "Password reset successful!",
          "success"
        );
        setTimeout(() => navigate("/login"), 1500);
      } else {
        // eslint-disable-next-line no-console
        console.error(data || "Failed to reset password.");
        showMsgRef.current("Failed to reset password.", "error");
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Server error", err);
      showMsgRef.current("Server error", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    void handleForgot();
  };
  const handleCodeSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    void handleCodeVerify();
  };
  const handleResetSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    void handleReset();
  };

  return (
    <>
      <Header
        variant="public"
        subtitle={
          role ? `Forgot Password as ${role.toUpperCase()}` : "Forgot Password"
        }
        leftActions={
          <button onClick={() => navigate("/")} className="header-link">
            ← Back
          </button>
        }
      />

      {messageComponent}

      <div
        className="fp-background"
        style={{ backgroundImage: `url(${bgUrl})` }}
        aria-hidden="true"
      />
      <div className="fp-overlay" />

      <div className="fp-container">
        {step === "verify" && (
          <form className="fp-card" onSubmit={handleForgotSubmit}>
            <InputField
              label="Email"
              name="email"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setEmail(e.target.value)
              }
              autoComplete="email"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className={`fp-button ${loading ? "disabled" : ""}`}
            >
              Submit
            </button>
          </form>
        )}

        {step === "code" && (
          <form className="fp-card" onSubmit={handleCodeSubmit}>
            <InputField
              label="Verification Code"
              name="code"
              type="text"
              placeholder="Enter Code"
              value={code}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setCode(e.target.value)
              }
              required
            />
            <button
              type="submit"
              disabled={loading}
              className={`fp-button ${loading ? "disabled" : ""}`}
            >
              Verify
            </button>
          </form>
        )}

        {step === "reset" && (
          <form className="fp-card" onSubmit={handleResetSubmit}>
            <InputField
              label="Reset Password"
              name="reset"
              type="password"
              placeholder="Enter new Password"
              value={newPassword}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setNewPassword(e.target.value)
              }
              showToggle
              required
            />
            <InputField
              label="Re-Enter Password"
              name="retry"
              type="password"
              placeholder="Re-Enter Password"
              value={retryPassword}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setRetryPassword(e.target.value)
              }
              showToggle
              required
            />
            <button
              type="submit"
              disabled={loading}
              className={`fp-button ${loading ? "disabled" : ""}`}
            >
              Reset
            </button>
          </form>
        )}

        {loading && (
          <div className="fp-overlay-spinner">
            <div className="fp-spinner" />
          </div>
        )}
        <div className="fp-button-row">
          <button
            onClick={() => handleSelect()}
            className="fp-button fp-button-secondary"
            type="button"
          >
            Back to Log in
          </button>
        </div>
      </div>
    </>
  );
}
