import React, {
  useEffect,
  useState,
  useMemo,
  useRef,
  useCallback,
} from "react";
import { useNavigate, useLocation } from "react-router-dom"; // ADD useLocation
import useMessage from "hooks/useMessage";
import Header from "components/Component-elements/Header";
import useLoadingState from "hooks/useLoading";
import LoadingOverlay from "components/Component-elements/loading_overlay";
import {
  localStorageRemove,
  localStorageGet,
  localStorageSet,
} from "utils/modifyFromLocalStorage";
import { apiFetchPublic } from "utils/apiClient";
import InputField from "components/Component-elements/InputField";
import "./Login.css";
import {
  installLoginPageGuard,
  setTabAuth,
  getGlobalAuthState,
  broadcastAuthState,
  isTabAuthenticated,
  clearGlobalAuthState,
} from "utils/tabAuth";
import { roleColors } from "../RoleSelect/RoleSelect";

type Role = "teacher" | "student" | string;
type User = { role?: Role; [k: string]: any };

const Login: React.FC = (): React.ReactElement => {
  const [, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const navigate = useNavigate();
  const location = useLocation(); // ADD THIS
  const { messageComponent, showMessage } = useMessage();
  const valid_roles = useMemo(() => ["student", "teacher"], []);
  const { loading, wrap } = useLoadingState(false);

  const showMsgRef = useRef<typeof showMessage>(showMessage);
  const checkAuthRef = useRef(false);
  const role = localStorageGet({ keys: ["role"] })[0] as Role | null;

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
          `[Login] Set accent color to ${accentColor} for role ${role}`,
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

  // Check if user is already authenticated when landing on login page
  useEffect(() => {
    if (checkAuthRef.current) return;
    checkAuthRef.current = true;

    const checkAuth = async () => {
      console.log("[Login] Checking authentication with server...");

      try {
        const { data, ok } = await apiFetchPublic("/auth/session");

        if (ok && data?.success) {
          // User is actually authenticated
          console.log("[Login] User authenticated, redirecting to dashboard");
          // DON'T call setTabAuth or broadcastAuthState here - they're already set
          navigate("/dash", { replace: true });
          return;
        }
      } catch (err) {
        console.log("[Login] Session check failed:", err);
      }

      // Not authenticated - clear any stale state
      console.log("[Login] Not authenticated, clearing stale state");
      clearGlobalAuthState();

      // Only install guard if NOT authenticated
      const cleanup = installLoginPageGuard();
      return cleanup;
    };

    const cleanupPromise = checkAuth();
    return () => {
      cleanupPromise.then((cleanup) => cleanup && cleanup());
    };
  }, [navigate]);

  // Listen for popstate events (browser back/forward)
  useEffect(() => {
    const handlePopState = async () => {
      try {
        const { data, ok } = await apiFetchPublic("/auth/session");

        if (ok && data?.success) {
          console.log(
            "[Login] Authenticated user pressed back, redirecting to dashboard",
          );
          showMsgRef.current(
            "You cannot return to login while authenticated. Please logout first.",
            "error",
          );
          navigate("/dash", { replace: true });
        }
      } catch {
        // Not authenticated, stay on login
        console.log("[Login] Not authenticated, staying on login page");
      }
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [navigate]);

  // Check history state for justLoggedIn marker
  useEffect(() => {
    try {
      const historyState = window.history.state;
      if (historyState?.justLoggedIn) {
        console.log("[Login] Detected back navigation after login");
        showMsgRef.current(
          "You cannot return to login after logging in. Redirecting...",
          "info",
        );
        navigate("/dash", { replace: true });
      }
    } catch {
      // ignore errors
    }
  }, [navigate, location]); // location is now properly imported

  useEffect(() => {
    if (!role || !valid_roles.includes(role)) {
      console.log("[Login] Invalid or missing role");
      showMsgRef.current(
        "Your role is not in the storage. Please choose again.",
        "error",
      );
      navigate("/");
    }
  }, [role, navigate, valid_roles]);

  const handleSelect = useCallback(
    (page = "login") => {
      navigate(`/${page}`);
    },
    [navigate],
  );

  const validation = useCallback((): Record<string, string> => {
    const newErrors: Record<string, string> = {};

    if (!email) newErrors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email))
      newErrors.email = "Invalid email format";

    if (!password) newErrors.password = "Password is required";
    else if (password.length < 6)
      newErrors.password = "Password must be atleast 6 characters long";

    setErrors(newErrors);
    return newErrors;
  }, [email, password]);

  const handleLogin = useCallback(async (): Promise<void> => {
    await wrap(async () => {
      const validationErrors = validation();

      if (Object.keys(validationErrors).length > 0) {
        const firstError = Object.values(validationErrors)[0];
        showMsgRef.current(firstError, "error");
        return;
      }

      try {
        const { ok, data } = await apiFetchPublic(
          `/auth/login`,
          {
            method: "POST",
            body: JSON.stringify({ email, password, role }),
            headers: { "Content-Type": "application/json" },
          },
          { withCredentials: true },
        );

        if (!ok || !data?.success) {
          const msg = data?.error || "Login failed";
          showMsgRef.current(msg, "error");
          return;
        }

        showMsgRef.current("Login successful", "success");
        setUser(data.user ?? null);
        localStorageSet({
          keys: ["user", "role"],
          values: [JSON.stringify(data.user ?? {}), data.user?.role],
        });

        // Set tab auth and broadcast ONCE after successful login
        setTabAuth();
        broadcastAuthState(true, data.user?.id);

        // Mark that we just performed a login
        try {
          sessionStorage.setItem("justLoggedIn", "1");
        } catch {
          // ignore storage errors
        }

        // Mark using history state
        try {
          if (window.history && window.history.replaceState) {
            window.history.replaceState(
              { justLoggedIn: true },
              "",
              window.location.href,
            );
          }
        } catch {
          // ignore
        }

        // Use replace to prevent going back to login
        navigate("/dash", { replace: true });
      } catch (err) {
        console.error("Login error:", err);
        showMsgRef.current("Server Error", "error");
      }
    });
  }, [wrap, email, password, role, navigate, validation]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void handleLogin();
  };

  const bgUrl = `${import.meta.env.PUBLIC_URL || ""}/classroom.jpg`;

  return (
    <>
      <Header
        leftActions={
          <button
            onClick={() => navigate("/")}
            className="header-link"
            disabled={loading}
          >
            ← Back
          </button>
        }
      />
      <div
        className="backgroundL"
        style={{ backgroundImage: `url(${bgUrl})` }}
        aria-hidden="true"
      />
      <div className="overlayL" />

      {messageComponent}

      <LoadingOverlay loading={loading} text="Logging in..." fullPage={false} />

      <form className="containerL" onSubmit={handleSubmit} noValidate>
        <div className="panelL" role="region" aria-labelledby="login-heading">
          <h2 id="login-heading" className="panel-title">
            Welcome back
          </h2>
          <p className="panel-sub">
            {role ? `Continue as ${role}` : "Sign in to continue"}
          </p>

          <div className="input-container">
            <InputField
              label="Email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="Email"
              required
              error={errors.email}
            />
            <InputField
              label="Password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="Password"
              showToggle
              required
              error={errors.password}
            />
          </div>
          <div className="buttonContainerL">
            <button type="submit" className="buttonL" disabled={loading}>
              Log in
            </button>
            <button
              onClick={() => handleSelect("signup")}
              type="button"
              className="buttonL"
              disabled={loading}
            >
              Sign up
            </button>
            <button
              onClick={() => handleSelect("forgot")}
              type="button"
              className="buttonNBG"
              disabled={loading}
            >
              Forgot Password?
            </button>
          </div>
        </div>
      </form>
    </>
  );
};

export default Login;
