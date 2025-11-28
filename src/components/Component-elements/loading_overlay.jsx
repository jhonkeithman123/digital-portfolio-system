import "./css/loading_overlay.css";

const LoadingOverlay = ({ loading, text = "Loading...", fullPage = false }) => {
  if (!loading) return null;

  return (
    <div className={fullPage ? "loading-overlay full" : "loading-overlay"}>
      <div className="loading-spinner"></div>
      <span className="loading-text">{text}</span>
    </div>
  );
};

export default LoadingOverlay;
