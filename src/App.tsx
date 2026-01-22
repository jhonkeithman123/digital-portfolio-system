import React, { useEffect, useRef, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { apiFetch } from "utils/apiClient";
import useMessage from "hooks/useMessage.js";

//* Pages
import Home from "pages/Home/Home";
import Login from "pages/Login/Login";
import RoleSelect from "pages/RoleSelect/RoleSelect";
import Signup from "pages/Signup/Signup";
import ForgotPassword from "pages/ForgotPassword/ForgotPassword";
import Dashboard from "pages/Dashboard/Dashboard.js";
import JoinClassroom from "pages/classrooms/JoinClassroom";
import CreateClassroom from "pages/classrooms/CreateClassroom";
import ActivityView from "components/Activity-components/ActivityView";
import NotFoundHandler from "./NotFoundHandler.js";

type ShowMessageFn = (
  text: string,
  kind?: "info" | "success" | "error",
) => void;

const routerBase =
  (import.meta.env.BASE_URL as string) ||
  ((import.meta.env as any).VITE_BASE as string) ||
  "/";

interface ProtectedRouteProps {
  children: React.ReactNode;
  showMessage: ShowMessageFn;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  showMessage,
}) => {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const showMsgRef = useRef<ShowMessageFn>(showMessage);

  useEffect(() => {
    showMsgRef.current = showMessage;
  }, [showMessage]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { unauthorized, data } = await apiFetch("/auth/session");
        if (!mounted) return;
        if (unauthorized || !data?.success) {
          showMsgRef.current("Unauthorized access", "error");
          setAuthorized(false);
        } else {
          setAuthorized(true);
        }
      } catch (err) {
        showMsgRef.current("Unauthorized access", "error");
        if (mounted) setAuthorized(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (authorized === null) return null;
  return authorized ? <>{children}</> : <Navigate to="/login" replace />;
};

function App(): React.ReactElement {
  const { messageComponent, showMessage } = useMessage();
  useEffect(() => {
    const root = document.documentElement;
    const cachedRole = localStorage.getItem("role");

    if (cachedRole === "teacher") {
      root.style.setProperty("--accent-color", "#dc3545");
    } else if (cachedRole === "student") {
      root.style.setProperty("--accent-color", "#007bff");
    }
  }, []);

  return (
    <Router basename={routerBase}>
      <main style={{ height: "94vh" }}>
        {messageComponent}
        <Routes>
          <Route path="/" element={<RoleSelect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot" element={<ForgotPassword />} />
          <Route
            path="/home"
            element={
              <ProtectedRoute showMessage={showMessage}>
                <Home />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dash"
            element={
              <ProtectedRoute showMessage={showMessage}>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/join"
            element={
              <ProtectedRoute showMessage={showMessage}>
                <JoinClassroom />
              </ProtectedRoute>
            }
          />
          <Route
            path="/create"
            element={
              <ProtectedRoute showMessage={showMessage}>
                <CreateClassroom />
              </ProtectedRoute>
            }
          />
          <Route
            path="/activity/:id/view"
            element={
              <ProtectedRoute showMessage={showMessage}>
                <ActivityView />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFoundHandler />} />
        </Routes>
      </main>
    </Router>
  );
}

export default App;
