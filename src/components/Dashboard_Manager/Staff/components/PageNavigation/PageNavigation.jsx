// src/pages/StaffManagement/components/PageNavigation.jsx
import React from "react";
import "./PageNavigation.scss";

const PageNavigation = ({ currentPage, onPageChange }) => {
  const pages = [
    { id: "dashboard", label: "Tổng Quan", icon: "👥" }, // Rút gọn label cho đẹp
    { id: "attendance", label: "Chấm Công", icon: "📝" },
    { id: "leave", label: "Nghỉ Phép", icon: "🏖️" },
    { id: "schedule", label: "Lịch Làm", icon: "📅" },
    { id: "reports", label: "Báo Cáo", icon: "📊" },
  ];

  return (
    <div className="page-nav-container fade-in">
      <div className="nav-scroll-wrapper">
        {pages.map((page) => (
          <button
            key={page.id}
            type="button"
            className={`nav-item ${currentPage === page.id ? "active" : ""}`}
            onClick={() => onPageChange(page.id)}
          >
            <span className="nav-icon">{page.icon}</span>
            <span className="nav-label">{page.label}</span>
            {currentPage === page.id && <span className="active-dot" />}
          </button>
        ))}
      </div>
    </div>
  );
};

export default PageNavigation;
