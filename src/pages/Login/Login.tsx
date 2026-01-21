import React, {
  useEffect,
  useState,
  useMemo,
  useRef,
  useCallback,
} from "react";
import { useNavigate } from "react-router-dom";
import useMessage from "../../hooks/useMessage";
import Header from "../../components/Component-elements/Header";
import useLoadingState from "../../hooks/useLoading";
import LoadingOverlay from "../../components/Component-elements/loading_overlay";
import {
  localStorageRemove,
  localStorageGet,
  localStorageSet,
} from "../../utils/modifyFromLocalStorage";
import { apiFetchPublic } from "../../utils/apiClient";
import InputField from "../../components/Component-elements/InputField";
import "./Login.css";
import {
  installLoginPageGuard,
  setTabAuth,
  getGlobalAuthState,
  broadcastAuthState,
  isTabAuthenticated,
} from "../../utils/tabAuth";

type Role = "teacher" | "student" | string;
type User = { role?: Role; [k: string]: any };

const Login: React.FC = (): React.ReactElement => {
  const [, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const navigate = useNavigate();
  const { messageComponent, showMessage } = useMessage();
  const valid_roles = useMemo(() => ["student", "teacher"], []);
  const { loading, wrap } = useLoadingState(false);

  const showMsgRef = useRef<typeof showMessage>(showMessage);
  const role = localStorageGet({ keys: ["role"] })[0] as Role | null;

  useEffect(() => {
    showMsgRef.current = showMessage;
  }, [showMessage]);

  // Check if user is already authenticated when landing on login page
  useEffect(() => {
    // Check if user is already authenticated in another tab or this tab
    const globalAuth = getGlobalAuthState();
    const isThisTabAuth = isTabAuthenticated();

    if (globalAuth?.authenticated || isThisTabAuth) {
      console.log(
        "[Login] User already authenticated, redirecting to dashboard"
      );
      showMsgRef.current("You are already logged in!", "info");
      setTabAuth();
      navigate("/dash", { replace: true });
      return;
    }

    // Only install login page guard if NOT authenticated
    const cleanup = installLoginPageGuard();
    return cleanup;
  }, [navigate]);

  // Listen for popstate events (browser back/forward)
  useEffect(() => {
    const handlePopState = () => {
      const globalAuth = getGlobalAuthState();
      const isThisTabAuth = isTabAuthenticated();

      // If user is authenticated and tries to go back to login
      if (globalAuth?.authenticated || isThisTabAuth) {
        console.log(
          "[Login] Authenticated user tried to access login via back button"
        );
        showMsgRef.current(
          "You cannot return to login while authenticated. Please logout first.",
          "error"
        );
        // Push them forward to dashboard
        navigate("/dash", { replace: true });
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
        // User just logged in and pressed back - redirect them
        console.log("[Login] Detected back navigation after login");
        showMsgRef.current(
          "You cannot return to login after logging in. Redirecting...",
          "info"
        );
        navigate("/dash", { replace: true });
      }
    } catch {
      // ignore errors
    }
  }, [navigate, location]);

  useEffect(() => {
    localStorageRemove({ keys: ["token", "user", "currentClassroom"] });

    if (!role || !valid_roles.includes(role)) {
      localStorage.clear();
      showMsgRef.current(
        "Your role is not in the storage. Please choose again.",
        "error"
      );
      navigate("/");
    }
  }, [role, navigate, valid_roles]);

  const handleSelect = useCallback(
    (page = "login") => {
      navigate(`/${page}`);
    },
    [navigate]
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
          { withCredentials: true }
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

        // Set tab auth and broadcast to all tabs
        setTabAuth();
        broadcastAuthState(true, data.user?.id);

        // mark that we just performed a login so Dashboard can clear cookie if user navigates back
        try {
          sessionStorage.setItem("justLoggedIn", "1");
        } catch {
          // ignore storage errors
        }

        // mark using history state so back/forward behavior works per-tab
        try {
          if (window.history && window.history.replaceState) {
            window.history.replaceState(
              { justLoggedIn: true },
              "",
              window.location.href
            );
          }
        } catch {
          // ignore
        }

        navigate(`/dash`);
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
