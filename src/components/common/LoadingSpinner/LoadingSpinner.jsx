import React from "react";
import "./LoadingSpinner.scss";

const LoadingSpinner = ({
  size = "medium",
  color = "primary",
  className = "",
}) => {
  return (
    <div
      className={`loading-spinner loading-spinner--${size} loading-spinner--${color} ${className}`}
    >
      <div className="spinner"></div>
    </div>
  );
};

export default LoadingSpinner;
