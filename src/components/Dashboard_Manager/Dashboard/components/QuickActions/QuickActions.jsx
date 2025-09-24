import React from "react";
import "./QuickActions.scss";

const ActionButton = ({ icon, label, onClick, variant = "secondary" }) => (
  <button className={`btn btn-${variant}`} onClick={onClick}>
    {icon} {label}
  </button>
);

const QuickActions = () => {
  const actions = [
    {
      icon: "🍽️",
      label: "Thêm Món Mới",
      variant: "primary",
      onClick: () =>
        alert("🍽️ Chuyển đến trang thêm món mới...\n(Tính năng demo)"),
    },
    {
      icon: "📦",
      label: "Quản Lý Kho",
      onClick: () =>
        alert("📦 Chuyển đến trang quản lý kho...\n(Tính năng demo)"),
    },
    {
      icon: "📊",
      label: "Xem Báo Cáo",
      onClick: () =>
        alert("📊 Chuyển đến trang báo cáo chi tiết...\n(Tính năng demo)"),
    },
    {
      icon: "👥",
      label: "Quản Lý Nhân Viên",
      onClick: () =>
        alert("👥 Chuyển đến trang quản lý nhân viên...\n(Tính năng demo)"),
    },
    {
      icon: "💬",
      label: "Hỗ Trợ Khách Hàng",
      onClick: () =>
        alert("💬 Chuyển đến trang hỗ trợ khách hàng...\n(Tính năng demo)"),
    },
    {
      icon: "🎁",
      label: "Quản Lý Khuyến Mãi",
      onClick: () =>
        alert("🎁 Chuyển đến trang quản lý khuyến mãi...\n(Tính năng demo)"),
    },
  ];

  return (
    <div className="quick-actions-card fade-in">
      <div className="quick-actions-header">
        <h3 className="quick-actions-title">⚡ Thao Tác Nhanh</h3>
      </div>
      <div className="quick-actions-grid">
        {actions.map((action, index) => (
          <ActionButton
            key={index}
            icon={action.icon}
            label={action.label}
            variant={action.variant}
            onClick={action.onClick}
          />
        ))}
      </div>
    </div>
  );
};

export default QuickActions;
