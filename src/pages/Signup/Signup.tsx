import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../../components/Component-elements/Header.js";
import useMessage from "../../hooks/useMessage.js";
import InputField from "../../components/Component-elements/InputField.js";
import { apiFetchPublic } from "../../utils/apiClient.js";
import type { Role } from "../../types/models";
import "./Signup.css";

const validRoles = ["student", "teacher"] as const;

const Signup: React.FC = (): React.ReactElement => {
  const navigate = useNavigate();

  const [username, setUsername] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [section, setSection] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");

  const { messageComponent, showMessage } = useMessage();
  const showMsgRef = useRef<typeof showMessage>(showMessage);

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
      showMsgRef.current?.(
        "Your role is not in the storage. Please choose again.",
        "error"
      );
      setTimeout(() => navigate("/"), 2000);
    }
  }, [role, navigate]);

  const handleSelect = (page: string = "login"): void => {
    navigate(`/${page}`);
  };

  const validate = (): boolean => {
    if (!username.trim() || !email.trim() || !password) {
      showMsgRef.current?.("All fields are required", "error");
      return false;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      showMsgRef.current?.("Invalid email format", "error");
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

    return true;
  };

  const handleSignup = async (): Promise<void> => {
    if (!validate()) return;

    try {
      const { ok, data } = await apiFetchPublic(
        `/auth/signup`,
        {
          method: "POST",
          body: JSON.stringify({
            username: username.trim(),
            email: email.trim(),
            password,
            role,
            section: role === "student" ? section.trim() || null : null,
          }),
          headers: { "Content-Type": "application/json" },
        },
        { withCredentials: false }
      );

      if (ok && data?.success) {
        showMsgRef.current?.("Signup successful! Redirecting...", "success");
        setTimeout(() => navigate(`/login?role=${role}`), 1500);
      } else {
        showMsgRef.current?.(data?.error || "Signup failed", "error");
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Signup error:", err);
      showMsgRef.current?.("Server error", "error");
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    void handleSignup();
  };

  return (
    <>
      <Header
        subtitle={role ? `Sign Up as ${String(role).toUpperCase()}` : "Sign Up"}
        leftActions={
          <button onClick={() => navigate("/")} className="header-link">
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

      <form className="containerS" onSubmit={handleSubmit}>
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
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setSection(e.target.value)
              }
              placeholder="e.g. 7-A, STEM-2"
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
            placeholder="Email"
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
          <button type="submit" className="buttonS">
            Sign up
          </button>
          <button
            type="button"
            onClick={() => handleSelect()}
            className="buttonS buttonS-secondary"
          >
            Back to Log in
          </button>
        </div>
      </form>
    </>
  );
};

export default Signup;
