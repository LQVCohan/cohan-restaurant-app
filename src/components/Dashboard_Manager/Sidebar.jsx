import React, { useState, useEffect } from "react";
import "./Styles/Sidebar.scss";

const Sidebar = ({ isOpen, onClose, onPageChange }) => {
  const [activeItem, setActiveItem] = useState("dashboard");

  // Navigation items data
  const navigationSections = [
    {
      title: "Tổng quan",
      items: [
        { id: "dashboard", icon: "📊", label: "Dashboard", page: "Tổng quan" },
        { id: "analytics", icon: "📈", label: "Phân tích", page: "Phân tích" },
      ],
    },
    {
      title: "Quản lý",
      items: [
        { id: "orders", icon: "🛒", label: "Đơn hàng", page: "Đơn hàng" },
        { id: "menu", icon: "📋", label: "Thực đơn", page: "Thực đơn" },
        { id: "inventory", icon: "📦", label: "Kho hàng", page: "Kho hàng" },
        { id: "tables", icon: "🪑", label: "Bàn ăn", page: "Bàn ăn" },
      ],
    },
    {
      title: "Nhân sự",
      items: [
        { id: "staff", icon: "👥", label: "Nhân viên", page: "Nhân viên" },
        {
          id: "schedules",
          icon: "📅",
          label: "Lịch làm việc",
          page: "Lịch làm việc",
        },
        {
          id: "payroll",
          icon: "💰",
          label: "Lương thưởng",
          page: "Lương thưởng",
        },
      ],
    },
    {
      title: "Khách hàng",
      items: [
        {
          id: "customers",
          icon: "👤",
          label: "Khách hàng",
          page: "Khách hàng",
        },
        {
          id: "promotions",
          icon: "🎁",
          label: "Khuyến mãi",
          page: "Chương trình khuyến mãi",
        },
        { id: "reviews", icon: "⭐", label: "Đánh giá", page: "Đánh giá" },
      ],
    },
    {
      title: "Báo cáo",
      items: [
        {
          id: "reports",
          icon: "📊",
          label: "Báo cáo tổng hợp",
          page: "Báo cáo",
        },
        { id: "finance", icon: "💳", label: "Tài chính", page: "Tài chính" },
      ],
    },
    {
      title: "Hệ thống",
      items: [
        { id: "settings", icon: "⚙️", label: "Cài đặt", page: "Cài đặt" },
        { id: "backup", icon: "💾", label: "Sao lưu", page: "Sao lưu" },
      ],
    },
  ];

  // Handle navigation item click
  const handleItemClick = (item) => {
    setActiveItem(item.id);
    onPageChange(item.id);
    console.log("item.page: ", item.page);
    // Close sidebar on mobile after selection
    if (window.innerWidth <= 768) {
      onClose();
    }
  };

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isOpen && window.innerWidth <= 768) {
        const sidebar = document.querySelector(".sidebar");
        if (
          sidebar &&
          !sidebar.contains(event.target) &&
          !event.target.closest(".sidebar-toggle")
        ) {
          onClose();
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}

      {/* Sidebar */}
      <aside className={`sidebar ${isOpen ? "sidebar-open" : ""}`}>
        {/* Header */}
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <span className="logo-icon">🍽️</span>
            <span className="logo-text">Restaurant</span>
          </div>
          <button className="sidebar-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {navigationSections.map((section, sectionIndex) => (
            <div key={sectionIndex} className="nav-section">
              <div className="nav-section-title">{section.title}</div>
              {section.items.map((item) => (
                <button
                  key={item.id}
                  className={`nav-item ${
                    activeItem === item.id ? "active" : ""
                  }`}
                  onClick={() => handleItemClick(item)}
                  title={item.label}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                  {activeItem === item.id && <div className="nav-indicator" />}
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="user-avatar-small">👨‍💼</div>
            <div className="user-info-small">
              <div className="user-name-small">Nguyễn Quản Lý</div>
              <div className="user-status-small">
                <span className="status-dot-small"></span>
                Online
              </div>
            </div>
          </div>

          <div className="sidebar-version">
            <span>v2.1.0</span>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
