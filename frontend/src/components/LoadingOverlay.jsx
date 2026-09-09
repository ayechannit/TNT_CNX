import "./LoadingOverlay.css";

export default function LoadingOverlay({ show }) {
  if (!show) return null;
  return (
    <div className="loading-overlay">
      <div className="loading-overlay-spinner" />
    </div>
  );
}
