import React from "react";
import "./PageNavigation.scss";

const PageNavigation = ({ currentPage, onPageChange }) => {
  const pages = [
    { id: "dashboard", label: "👥 Quản Lý Nhân Viên", icon: "👥" },
    { id: "attendance", label: "📝 Chấm Công", icon: "📝" },
    { id: "leave", label: "🏖️ Nghỉ Phép", icon: "🏖️" },
    { id: "schedule", label: "📅 Lịch Làm Việc", icon: "📅" },
    { id: "reports", label: "📊 Báo Cáo", icon: "📊" },
  ];

  return (
    <div className="page-nav fade-in">
      {pages.map((page) => (
        <div
          key={page.id}
          className={`nav-item ${currentPage === page.id ? "active" : ""}`}
          onClick={() => onPageChange(page.id)}
        >
          <span className="nav-icon">{page.icon}</span>
          <span className="nav-label">{page.label}</span>
        </div>
      ))}
    </div>
  );
};

export default PageNavigation;
