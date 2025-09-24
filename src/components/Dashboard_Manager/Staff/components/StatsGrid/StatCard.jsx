import React from "react";

const StatCard = ({
  icon,
  number,
  label,
  trend,
  trendValue,
  change,
  period,
  changeType,
}) => {
  return (
    <div className="stat-card fade-in">
      <div className="stat-header">
        <div className="stat-icon">{icon}</div>
        <div className={`stat-trend trend-${trend}`}>{trendValue}</div>
      </div>

      <div className="stat-main">
        <div className="stat-number">{number}</div>
        <div className="stat-label">{label}</div>
      </div>

      <div className="stat-footer">
        <div className={`stat-change ${changeType}`}>{change}</div>
        <div className="stat-period">{period}</div>
      </div>
    </div>
  );
};

export default StatCard;
