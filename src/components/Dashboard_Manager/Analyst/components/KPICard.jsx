import React from "react";

const KPICard = ({
  icon,
  iconClass,
  value,
  label,
  change,
  changeType,
  comparison,
}) => {
  return (
    <div className="kpi-card">
      <div className="kpi-header">
        <div className={`kpi-icon ${iconClass}`}>
          <i className={icon}></i>
        </div>
        <span className={`kpi-change ${changeType}`}>{change}</span>
      </div>
      <h3 className="kpi-value">{value}</h3>
      <p className="kpi-label">{label}</p>
      <div className="kpi-comparison">
        <i
          className={`fas ${
            changeType === "positive" ? "fa-arrow-up" : "fa-arrow-down"
          }`}
        ></i>
        {comparison}
      </div>
    </div>
  );
};

export default KPICard;
