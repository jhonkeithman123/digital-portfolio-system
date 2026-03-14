import React from "react";
import "./css/loading_overlay.css";

interface LoadingOverlayProps {
  loading: boolean;
  text: string;
  fullPage: boolean;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  loading,
  text = "Loading...",
  fullPage = false,
}): React.ReactElement | null => {
  if (!loading) return null;

  return (
    <div className={fullPage ? "loading-overlay full" : "loading-overlay"}>
      <div className="loading-spinner"></div>
      <span className="loading-text">{text}</span>
    </div>
  );
};

export default LoadingOverlay;
