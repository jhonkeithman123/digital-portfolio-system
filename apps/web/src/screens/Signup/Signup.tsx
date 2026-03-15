import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Header from "components/Component-elements/Header";
import useMessage from "hooks/useMessage";
import InputField from "components/Component-elements/InputField";
import LoadingOverlay from "components/Component-elements/loading_overlay";
import useLoadingState from "hooks/useLoading";
import { apiFetchPublic } from "utils/apiClient";
import type { Role } from "types/models";
import "./Signup.css";
import { installLoginPageGuard } from "utils/tabAuth";
import { getLocalStorage, safeStorageGet } from "utils/safeStorage";
import { ALLOWED_EMAIL_DOMAINS } from "types/models";
import { roleColors } from "../RoleSelect/RoleSelect";

const validRoles = ["student", "teacher"] as const;

const SIGNUP_DATA_KEY = "signup_pending_data";
const VERIFICATION_STATE_KEY = "signup_verification_state";

interface SignupData {
  username: string;
  email: string;
  role: Role;
  gradeAndSection?: string;
  studentNumber?: string;
  timestamp: number;
}

interface VerificationState {
  email: string;
  role: Role;
  expiresAt: number;
}

const Signup: React.FC = (): React.ReactElement => {
  const navigate = useNavigate();
  const { messageComponent, showMessage } = useMessage();
  const showMsgRef = useRef<typeof showMessage>(showMessage);
  const { loading, wrap } = useLoadingState(false);

  const [username, setUsername] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [gradeAndSection, setGradeAndSection] = useState<string>("");
  const [studentNumber, setStudentNumber] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");

  const [showVerification, setShowVerification] = useState<boolean>(false);
  const [verificationCode, setVerificationCode] = useState<string>("");
  const [resendCooldown, setResendCooldown] = useState<number>(0);

  const roleRaw = safeStorageGet(getLocalStorage(), "role");
  const role = (roleRaw as Role | null) ?? null;

  const bgUrl = "/classroom.jpg";

  useEffect(() => {
    try {
      const savedVerificationState = sessionStorage.getItem(
        VERIFICATION_STATE_KEY,
      );
      const savedSignupData = sessionStorage.getItem(SIGNUP_DATA_KEY);

      if (savedVerificationState && savedSignupData) {
        const verificationState: VerificationState = JSON.parse(
          savedVerificationState,
        );
        const signupData: SignupData = JSON.parse(savedSignupData);

        // Check if verification is still valid (within 10 minutes)
        const now = Date.now();
        if (verificationState.expiresAt > now) {
          // Check if role matches
          if (verificationState.role === role) {
            // Restore signup data
            setUsername(signupData.username);
            setEmail(signupData.email);
            setGradeAndSection(signupData.gradeAndSection || "");
            setStudentNumber(signupData.studentNumber || "");

            // Show verification form
            setShowVerification(true);

            // Calculate remaining cooldown time
            const cooldownEnd =
              verificationState.expiresAt - (10 * 60 * 1000 - 60 * 1000); // 1 minute before expiry
            const remainingCooldown = Math.max(
              0,
              Math.floor((cooldownEnd - now) / 1000),
            );
            if (remainingCooldown > 0) {
              setResendCooldown(remainingCooldown);
            }

            showMsgRef.current?.(
              "Verification session restored. Please check your email for the code.",
              "info",
            );

            console.log("[Signup] Restored verification session", {
              email: verificationState.email,
              expiresIn: Math.floor((verificationState.expiresAt - now) / 1000),
            });
          } else {
            // Role mismatch, clear saved data
            sessionStorage.removeItem(VERIFICATION_STATE_KEY);
            sessionStorage.removeItem(SIGNUP_DATA_KEY);
          }
        } else {
          // Verification expired, clear saved data
          sessionStorage.removeItem(VERIFICATION_STATE_KEY);
          sessionStorage.removeItem(SIGNUP_DATA_KEY);
          showMsgRef.current?.(
            "Verification code expired. Please sign up again.",
            "error",
          );
        }
      }
    } catch (err) {
      console.error("[Signup] Error restoring session:", err);
      sessionStorage.removeItem(VERIFICATION_STATE_KEY);
      sessionStorage.removeItem(SIGNUP_DATA_KEY);
    }
  }, [role]);

  // Set accent color based on role
  useEffect(() => {
    try {
      if (role && (role === "student" || role === "teacher")) {
        const accentColor = roleColors[role] ?? "#6c757d";
        document.documentElement.style.setProperty(
          "--accent-color",
          accentColor,
        );
        console.log(
          `[Signup] Set accent color to ${accentColor} for role ${role}`,
        );
      } else {
        document.documentElement.style.removeProperty("--accent-color");
      }
    } catch {
      // Ignore
    }
  }, [role]);

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
    sessionStorage.removeItem(VERIFICATION_STATE_KEY);
    sessionStorage.removeItem(SIGNUP_DATA_KEY);
    navigate(`/${page}`);
  };

  const validateGradeAndSection = (
    gradeAndSec: string,
  ): { valid: boolean; error?: string } => {
    if (!gradeAndSec.trim()) {
      return { valid: true }; // Optional field
    }

    const parts = gradeAndSec.split("-");

    if (parts.length !== 3) {
      return {
        valid: false,
        error:
          "Grade & Section must be in format: XX-YYYY-XY (e.g., 12-ICT-A2)",
      };
    }

    const [grade, strand, section] = parts;

    // Validate grade (11 or 12)
    if (!["11", "12"].includes(grade)) {
      return {
        valid: false,
        error: "Grade must be 11 or 12",
      };
    }

    // Validate strand (2-5 letters)
    if (!/^[A-Z]{2,5}$/.test(strand)) {
      return {
        valid: false,
        error: "Strand must be 2-5 letters (e.g., ICT, STEM, ABM, HUMSS)",
      };
    }

    // Validate section (letter + digit)
    if (!/^[A-Z]\d$/.test(section)) {
      return {
        valid: false,
        error: "Section must be a letter followed by a digit (e.g., A1, B2)",
      };
    }

    return { valid: true };
  };

  const validateStudentNumber = (
    studentNum: string,
  ): { valid: boolean; error?: string } => {
    const trimmed = studentNum.trim().toUpperCase();

    // Format: AUJS-SHS-XX-YY-NNNNN or AUJS-SHS-XXX-YY-NNNNN
    // AUJS = School code (fixed)
    // SHS = Senior High School (education category)
    // XX/XXX = Department/Strand code (2-3 letters, e.g., AH, TIC, STEM, ABM, etc.)
    // YY = Freshman year (2 digits)
    // NNNNN = Student ID (5 digits)
    const studentNumberPattern = /^AUJS-SHS-[A-Z]{2,3}-?\d{2}-\d{5}$/;

    if (!studentNumberPattern.test(trimmed)) {
      return {
        valid: false,
        error:
          "Student Number must follow format: AUJS-SHS-XXX-YY-NNNNN (e.g., AUJS-SHS-AH-24-00491 or AUJS-SHS-TIC-23-03915)",
      };
    }

    // Extract year to validate it's reasonable
    const yearMatch = trimmed.match(/AUJS-SHS-[A-Z]{2,3}-?(\d{2})-\d{5}/);
    if (yearMatch) {
      const year = parseInt(yearMatch[1], 10);
      const currentYear = new Date().getFullYear() % 100; // Get last 2 digits of current year

      // Year should be within reasonable range (e.g., current year - 5 to current year + 1)
      if (year < currentYear - 5 || year > currentYear + 1) {
        return {
          valid: false,
          error: `Invalid freshman year in Student Number. Expected between ${currentYear - 10} and ${currentYear + 1}`,
        };
      }
    }

    return { valid: true };
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

    if (role === "student") {
      if (!studentNumber.trim()) {
        showMsgRef.current?.(
          "Student Number is required for students",
          "error",
        );
        return false;
      }

      const studentNumValidation = validateStudentNumber(studentNumber);
      if (!studentNumValidation.valid) {
        showMsgRef.current?.(
          studentNumValidation.error || "Invalid Student Number format",
          "error",
        );
        return false;
      }

      // Validate grade and section format
      const gradeSecValidation = validateGradeAndSection(gradeAndSection);
      if (!gradeSecValidation.valid) {
        showMsgRef.current?.(
          gradeSecValidation.error || "Invalid Grade & Section format",
          "error",
        );
        return false;
      }
    }

    return true;
  };

  const saveSignupData = () => {
    try {
      const signupData: SignupData = {
        username: username.trim(),
        email: email.trim().toLowerCase(),
        role: role!,
        gradeAndSection: gradeAndSection.trim(),
        studentNumber: studentNumber.trim().toUpperCase(),
        timestamp: Date.now(),
      };
      sessionStorage.setItem(SIGNUP_DATA_KEY, JSON.stringify(signupData));
      console.log("[Signup] Saved signup data to session");
    } catch (err) {
      console.error("[Signup] Failed to save signup data:", err);
    }
  };

  const saveVerificationState = () => {
    try {
      const verificationState: VerificationState = {
        email: email.trim().toLowerCase(),
        role: role!,
        expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes from now
      };
      sessionStorage.setItem(
        VERIFICATION_STATE_KEY,
        JSON.stringify(verificationState),
      );
      console.log("[Signup] Saved verification state to session");
    } catch (err) {
      console.error("[Signup] Failed to save verification state:", err);
    }
  };

  const clearSavedData = () => {
    try {
      sessionStorage.removeItem(VERIFICATION_STATE_KEY);
      sessionStorage.removeItem(SIGNUP_DATA_KEY);
      console.log("[Signup] Cleared saved data");
    } catch (err) {
      console.error("[Signup] Failed to clear saved data:", err);
    }
  };

  const handleSignup = useCallback(async (): Promise<void> => {
    await wrap(async () => {
      if (!validate()) return;

      try {
        // Split gradeAndSection into separate grade and section
        // Format: "12-ICT-A2" -> grade: "12", section: "ICT-A2"
        let grade: string | null = null;
        let section: string | null = null;

        if (role === "student" && gradeAndSection.trim()) {
          const parts = gradeAndSection.trim().toUpperCase().split("-");
          if (parts.length === 3) {
            grade = parts[0]; // "12"
            section = `${parts[1]}-${parts[2]}`; // "ICT-A2"
          }
        }

        const normalizedStudentNumber = studentNumber.trim().toUpperCase();

        const { ok, data } = await apiFetchPublic(
          `/auth/signup`,
          {
            method: "POST",
            body: JSON.stringify({
              username: username.trim(),
              email: email.trim(),
              password,
              role,
              grade: role === "student" ? grade : null,
              section: role === "student" ? section : null,
              studentNumber:
                role === "student" ? normalizedStudentNumber : null,
            }),
            headers: { "Content-Type": "application/json" },
          },
          { withCredentials: false },
        );

        if (ok && data?.success) {
          // Save signup data and verification state
          saveSignupData();
          saveVerificationState();

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
  }, [
    wrap,
    username,
    email,
    password,
    role,
    gradeAndSection,
    studentNumber,
    validate,
  ]);

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

          saveVerificationState();
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
          clearSavedData();

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

  // Auto-uppercase student number as user types
  const handleStudentNumberChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ): void => {
    const value = e.target.value.toUpperCase();
    setStudentNumber(value);
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
                <>
                  <InputField
                    label="Grade & Section"
                    name="gradeAndSection"
                    value={gradeAndSection}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setGradeAndSection(e.target.value)
                    }
                    placeholder="Format: XX-YYYY-XY"
                    helperText="Format: XX-YYYY-XY (e.g., 12-ICT-A2, 11-STEM-B1)"
                  />

                  <InputField
                    label="Student Number"
                    name="studentNumber"
                    value={studentNumber}
                    onChange={handleStudentNumberChange}
                    placeholder="e.g., AUJS-SHS-AH-24-00491"
                    helperText="Format: AUJS-SHS-XXX-YY-NNNNN"
                    required
                  />
                </>
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
