import React from "react";

const StatCard = ({
  icon,
  number,
  label,
  helper,
  context,
  badgeText,
  badgeTone = "primary",
  loading = false,
}) => {
  return (
    <div className={`stat-card fade-in tone-${badgeTone}`}>
      <div className="stat-header">
        <div className="stat-icon">{icon}</div>
        {badgeText && <span className="stat-badge">{badgeText}</span>}
      </div>

      <div className="stat-main">
        <div className="stat-number">
          {loading ? <div className="skeleton skeleton-number" /> : number}
        </div>
        <div className="stat-label">{label}</div>
        <div className="stat-helper">
          {loading ? <div className="skeleton skeleton-text" /> : helper}
        </div>
      </div>

      {context && <div className="stat-context">{context}</div>}
    </div>
  );
};

export default StatCard;
