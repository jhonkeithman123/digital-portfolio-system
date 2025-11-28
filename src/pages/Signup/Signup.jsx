import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../../components/Component-elements/Header";
import useMessage from "../../hooks/useMessage";
import InputField from "../../components/Component-elements/InputField";
import { apiFetchPublic } from "../../utils/apiClient.js";
import "./Signup.css";

const Signup = () => {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [section, setSection] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const { messageComponent, showMessage } = useMessage();

  const showMsgRef = useRef(showMessage);

  const role = localStorage.getItem("role");
  const validRoles = ["student", "teacher"];
  const bgUrl = `${process.env.PUBLIC_URL || ""}/classroom.jpg`;

  useEffect(() => {
    showMsgRef.current = showMessage;
  }, [showMessage]);

  useEffect(() => {
    if (!role || !validRoles.includes(role)) {
      localStorage.removeItem("user");
      showMsgRef.current(
        "Your role is not in the storage. Please choose again.",
        "error"
      );
      setTimeout(() => {
        navigate("/");
      }, 2000);
    }
  }, [role, navigate]);

  const handleSelect = (page = "login") => {
    navigate(`/${page}`);
  };

  const validate = () => {
    if (!username || !email || !password) {
      showMsgRef.current("All fields are required", "error");
      return false;
    }

    if (!/\S+@\S+\./.test(email)) {
      showMsgRef.current("Invalid email format", "error");
      return false;
    }

    if (password.length < 6) {
      showMsgRef.current("Passwords must be at least 6 characters", "error");
      return false;
    }

    if (password !== confirmPassword) {
      showMsgRef.current("Passwords must match", "error");
      return false;
    }

    return true;
  };

  const handleSignup = () => {
    if (!validate()) return;

    apiFetchPublic(
      `/auth/signup`,
      {
        method: "POST",
        body: JSON.stringify({
          username,
          email,
          password,
          role,
          section: role === "student" ? section.trim() || null : null,
        }),
      },
      { withCredentials: false } // no cookie needed on signup
    )
      .then(({ ok, data }) => {
        if (ok && data?.success) {
          showMsgRef.current("Signup successful! Redirecting...", "success");
          setTimeout(() => navigate(`/login?role=${role}`), 1500);
        } else {
          showMsgRef.current(data?.error || "Signup failed", "error");
        }
      })
      .catch(() => showMsgRef.current("Server error", "error"));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleSignup();
  };

  return (
    <>
      <Header
        subtitle={role ? `Sign Up as ${role.toUpperCase()}` : "Sign Up"}
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
      ></div>
      <div className="overlayS"></div>

      {messageComponent}

      <form className="containerS" onSubmit={handleSubmit}>
        <div className="input-containerS">
          <InputField
            label="Username"
            name="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            placeholder="Username"
            required
          />

          {role === "student" && (
            <InputField
              label="Section"
              name="section"
              value={section}
              onChange={(e) => setSection(e.target.value)}
              placeholder="e.g. 7-A, STEM-2"
            />
          )}

          <InputField
            label="Email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="Email"
            required
          />

          <InputField
            label="Password"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
            onChange={(e) => setConfirmPassword(e.target.value)}
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
