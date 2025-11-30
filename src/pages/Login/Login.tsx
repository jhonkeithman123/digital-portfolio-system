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
        navigate(`/dash`);
      } catch (err) {
        // keep console for debugging; surface friendly message to user
        // eslint-disable-next-line no-console
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
