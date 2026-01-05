import React, { useEffect } from "react";
import { useLocation } from "react-router-dom";
import NotFound from "./pages/NotFound/NotFound";

const NotFoundHandler: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    if (location.pathname.startsWith("/uploads/")) {
      const backendUrl =
        import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
      window.location.href = `${backendUrl}${location.pathname}`;
    }
  }, [location]);

  if (location.pathname.startsWith("/uploads/")) {
    return <div>Loading file...</div>;
  }

  return <NotFound />;
};

export default NotFoundHandler;
