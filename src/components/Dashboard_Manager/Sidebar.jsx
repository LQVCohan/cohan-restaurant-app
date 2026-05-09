import React, { useContext, useEffect } from "react";
import "./Styles/Sidebar.scss";
import { AuthContext } from "@/context/AuthContext";
import { filterNavigationByRole } from "@/utils/frontendRoleAccess";

const Sidebar = ({ isOpen, onClose, onPageChange, activeItem }) => {
  const { user } = useContext(AuthContext);
  // Navigation items data
  const navigationSections = [
    {
      title: "Tổng quan",
      items: [
        { id: "dashboard", icon: "📊", label: "Dashboard", page: "Tổng quan", roles: ["admin", "manager", "hr", "accountant"] },
        { id: "analytics", icon: "📈", label: "Phân tích", page: "Phân tích", roles: ["admin", "manager"] },
      ],
    },
    {
      title: "Quản lý",
      items: [
        { id: "orders", roles: ["admin", "manager"], icon: "🛒", label: "Đơn hàng", page: "Đơn hàng" },
        { id: "menu", roles: ["admin", "manager"], icon: "📋", label: "Thực đơn", page: "Thực đơn" },
        { id: "inventory", roles: ["admin", "manager"], icon: "📦", label: "Kho hàng", page: "Kho hàng" },
        { id: "tables", roles: ["admin", "manager"], icon: "🪑", label: "Bàn ăn", page: "Bàn ăn" },
        {
          id: "restaurant-info-management",
          roles: ["admin", "manager"],
          icon: "🏪",
          label: "Quản lý thông tin nhà hàng",
          page: "Quản lý thông tin nhà hàng",
        },
      ],
    },
    {
      title: "Nhân sự",
      items: [
        { id: "staff", roles: ["admin", "manager", "hr"], icon: "👥", label: "Nhân viên", page: "Nhân viên" },
        {
          id: "schedules",
          roles: ["admin", "manager"],
          icon: "📅",
          label: "Lịch làm việc",
          page: "Lịch làm việc",
        },
        {
          id: "payroll",
          roles: ["admin", "manager", "accountant"],
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
          roles: ["admin", "manager"],
          icon: "👤",
          label: "Khách hàng",
          page: "Khách hàng",
        },
        {
          id: "customer-analytics",
          roles: ["admin", "manager"],
          icon: "🧠",
          label: "Phân tích người dùng",
          page: "Phân tích người dùng",
        },
        {
          id: "promotions",
          roles: ["admin", "manager"],
          icon: "🎁",
          label: "Khuyến mãi",
          page: "Chương trình khuyến mãi",
        },
        { id: "reviews", roles: ["admin", "manager"], icon: "⭐", label: "Đánh giá", page: "Đánh giá" },
      ],
    },
    {
      title: "Báo cáo",
      items: [
        {
          id: "reports",
          roles: ["admin", "manager"],
          icon: "📊",
          label: "Báo cáo tổng hợp",
          page: "Báo cáo",
        },
        { id: "finance", roles: ["admin", "manager", "accountant"], icon: "💳", label: "Tài chính", page: "Tài chính" },
      ],
    },
    {
      title: "Hệ thống",
      items: [
        { id: "settings", roles: ["admin"], icon: "⚙️", label: "Cài đặt", page: "Cài đặt" },
        {
          id: "print-management",
          roles: ["admin", "manager"],
          icon: "🖨️",
          label: "Quản lý in ấn",
          page: "Quản lý in ấn",
        },
        { id: "backup", roles: ["admin"], icon: "💾", label: "Sao lưu", page: "Sao lưu" },
      ],
    },
  ];


  const visibleSections = filterNavigationByRole(navigationSections, user?.roleName || user?.role?.slug);

  // Handle navigation item click
  const handleItemClick = (item) => {
    onPageChange(item.id);

    if (window.innerWidth <= 768) {
      onClose();
    }
  };

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
          {visibleSections.map((section, sectionIndex) => (
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
