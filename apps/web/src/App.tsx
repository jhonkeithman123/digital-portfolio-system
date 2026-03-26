import React, { useEffect, useRef, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { apiFetch } from "utils/apiClient";
import type { SessionResponse } from "types/api";
import useMessage from "hooks/useMessage";

//* Pages
import Home from "screens/Home/Home";
import Login from "screens/Login/Login";
import RoleSelect from "screens/RoleSelect/RoleSelect";
import Signup from "screens/Signup/Signup";
import ForgotPassword from "screens/ForgotPassword/ForgotPassword";
import Dashboard from "screens/Dashboard/Dashboard";
import Admin from "screens/Admin/Admin";
import JoinClassroom from "screens/classrooms/JoinClassroom";
import CreateClassroom from "screens/classrooms/CreateClassroom";
import ActivityView from "components/Activity-components/ActivityView";
import NotFoundHandler from "./NotFoundHandler";
import Portfolio from "screens/Portfolio/Portfolio";
import PortfolioDocs from "screens/Portfolio/PortfolioDocs";
import Drive from "screens/Drive/Drive";
import { DrivePublic } from "screens/Drive/Drive";

type ShowMessageFn = (
  text: string,
  kind?: "info" | "success" | "error",
) => void;

const routerBase = "/";

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
        const { unauthorized, data } =
          await apiFetch<SessionResponse>("/auth/session");
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
            path="/admin"
            element={
              <ProtectedRoute showMessage={showMessage}>
                <Admin />
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
          <Route
            path="/portfolio"
            element={
              <ProtectedRoute showMessage={showMessage}>
                <Portfolio />
              </ProtectedRoute>
            }
          />
          <Route
            path="/portfolio/docs"
            element={
              <ProtectedRoute showMessage={showMessage}>
                <PortfolioDocs />
              </ProtectedRoute>
            }
          />
          <Route
            path="/drive"
            element={
              <ProtectedRoute showMessage={showMessage}>
                <Drive />
              </ProtectedRoute>
            }
          />
          {/* Debug route: public access to Drive content (no auth) */}
          <Route path="/drive-debug" element={<DrivePublic />} />
          <Route path="*" element={<NotFoundHandler />} />
        </Routes>
      </main>
    </Router>
  );
}

export default App;
