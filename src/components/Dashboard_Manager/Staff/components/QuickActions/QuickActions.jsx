import React from "react";
import "./QuickActions.scss";

const QuickActions = ({ onPageChange }) => {
  const actions = [
    {
      icon: "📝",
      label: "Điểm Danh",
      onClick: () => onPageChange("attendance"),
    },
    {
      icon: "📅",
      label: "Xem Lịch Làm",
      onClick: () => onPageChange("schedule"),
    },
    {
      icon: "💰",
      label: "Tính Lương",
      onClick: () => alert("💰 Tính lương...\n(Tính năng demo)"),
    },
    {
      icon: "🏖️",
      label: "Quản Lý Nghỉ Phép",
      onClick: () => onPageChange("leave"),
    },
  ];

  return (
    <div className="quick-actions-card fade-in">
      <div className="quick-actions-header">
        <h3 className="quick-actions-title">⚡ Thao Tác Nhanh</h3>
      </div>
      <div className="quick-actions-grid">
        {actions.map((action, index) => (
          <button
            key={index}
            className="btn btn-secondary quick-action-btn"
            onClick={action.onClick}
          >
            <span className="action-icon">{action.icon}</span>
            <span className="action-label">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuickActions;
