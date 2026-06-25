import React, { useCallback, useContext, useEffect, useMemo } from "react";
import "./Styles/Sidebar.scss";
import "./Styles/SidebarShellFix.scss";
import { AuthContext } from "@/context/AuthContext";
import { filterNavigationByPermissionAccess } from "@/utils/frontendPermissionAccess";

const NAVIGATION_SECTIONS = [
  {
    title: "Tổng quan",
    items: [
      { id: "dashboard", icon: "📊", label: "Dashboard", page: "Tổng quan", permissions: ["dashboard.read", "report.read"] },
      { id: "analytics", icon: "📈", label: "Phân tích kinh doanh", page: "Phân tích kinh doanh", permissions: ["report.read"] },
    ],
  },
  {
    title: "Quản lý",
    items: [
      { id: "orders", permissions: ["order.read"], icon: "🛒", label: "Đơn hàng", page: "Đơn hàng" },
      { id: "menu", permissions: ["menu.read"], icon: "📋", label: "Thực đơn", page: "Thực đơn" },
      { id: "combos", permissions: ["menu.read"], icon: "🍱", label: "Combo", page: "Combo" },
      { id: "inventory", permissions: ["inventory.read", "stock.read"], icon: "📦", label: "Kho hàng", page: "Kho hàng" },
      { id: "tables", permissions: ["table.read"], icon: "🪑", label: "Bàn ăn", page: "Bàn ăn" },
      { id: "restaurant-info-management", permissions: ["restaurant.read"], icon: "🏪", label: "Quản lý thông tin nhà hàng", page: "Quản lý thông tin nhà hàng" },
    ],
  },
  {
    title: "Nhân sự",
    items: [
      { id: "staff", permissions: ["staff.read"], icon: "👥", label: "Nhân viên", page: "Nhân viên" },
      { id: "rbac", permissions: ["role.read", "permission.read", "staff.write"], icon: "🛡️", label: "Phân quyền nhân viên", page: "Phân quyền nhân viên" },
      { id: "schedules", permissions: ["shift.read"], icon: "📅", label: "Lịch làm việc", page: "Lịch làm việc" },
      { id: "payroll", permissions: ["payroll.read"], icon: "💰", label: "Lương thưởng", page: "Lương thưởng" },
    ],
  },
  {
    title: "Khách hàng",
    items: [
      { id: "customers", permissions: ["customer.read"], icon: "👤", label: "Khách hàng", page: "Khách hàng" },
      { id: "customer-analytics", permissions: ["report.read"], icon: "🧠", label: "Phân tích khách hàng", page: "Phân tích khách hàng" },
      { id: "promotions", permissions: ["promotion.read", "coupon.read"], icon: "🎁", label: "Khuyến mãi", page: "Chương trình khuyến mãi" },
      { id: "ai-handoff", permissions: ["ai.chatbot.handoff", "ai.chatbot.moderate"], icon: "🤖", label: "Handoff AI", page: "Handoff AI" },
      { id: "ai-chatbot-analytics", permissions: ["ai.chatbot.analytics.read", "ai.chatbot.read"], icon: "📡", label: "AI Chatbot Analytics", page: "AI Chatbot Analytics" },
      { id: "ai-chatbot-settings", permissions: ["ai.chatbot.write"], icon: "⚙️", label: "AI Chatbot Settings", page: "AI Chatbot Settings" },
      {
        id: "ai-chatbot-knowledge",
        permissions: ["ai.chatbot.read", "ai.chatbot.write", "ai.chatbot.moderate", "ai.chatbot.evaluate"],
        icon: "📚",
        label: "AI Chatbot Knowledge",
        page: "AI Chatbot Knowledge",
      },
      { id: "reviews", permissions: ["review.read", "report.read"], icon: "⭐", label: "Đánh giá", page: "Đánh giá" },
    ],
  },
  {
    title: "Báo cáo",
    items: [
      { id: "reports", permissions: ["report.read"], icon: "📊", label: "Báo cáo tổng hợp", page: "Báo cáo" },
      { id: "finance", permissions: ["payment.read"], icon: "💳", label: "Tài chính", page: "Tài chính" },
      { id: "transactions", permissions: ["transaction.read", "finance.read", "payment.read"], icon: "🧾", label: "Giao dịch", page: "Giao dịch" },
      { id: "transfer-review", permissions: ["payment.read"], icon: "🏦", label: "Thanh toán QR", page: "Thanh toán QR" },
      { id: "wallet", permissions: ["payment.read", "payment.write", "refund.write"], icon: "👛", label: "Ví khách hàng", page: "Ví khách hàng" },
    ],
  },
  {
    title: "Hệ thống",
    items: [
      { id: "settings", permissions: ["system.manage"], icon: "⚙️", label: "Cài đặt", page: "Cài đặt" },
      { id: "system-users", roles: ["admin"], icon: "👤", label: "Người dùng hệ thống", page: "Người dùng hệ thống" },
      { id: "print-management", permissions: ["print.read", "report.read"], icon: "🖨️", label: "Quản lý in ấn", page: "Quản lý in ấn" },
      { id: "backup", permissions: ["system.manage"], icon: "💾", label: "Sao lưu", page: "Sao lưu" },
    ],
  },
];

const Sidebar = ({ isOpen, onClose, onToggle, onPageChange, activeItem }) => {
  const { user } = useContext(AuthContext);
  const sidebarUserName = user?.fullName || user?.name || "Quản lý";
  const sidebarUserRole = user?.role?.name || user?.roleName || "Đang hoạt động";

  const visibleSections = useMemo(
    () => filterNavigationByPermissionAccess(NAVIGATION_SECTIONS, user),
    [user],
  );

  const handleItemClick = useCallback((item) => {
    onPageChange(item.id);
    if (window.innerWidth <= 768) onClose();
  }, [onClose, onPageChange]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isOpen && window.innerWidth <= 768) {
        const sidebar = document.querySelector(".sidebar");
        if (sidebar && !sidebar.contains(event.target) && !event.target.closest(".sidebar-toggle")) onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape" && isOpen) onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  return (
    <aside className={`sidebar ${isOpen ? "sidebar-open" : ""}`} aria-label="Thanh điều hướng quản lý">
      <button className="sidebar-rail-toggle" onClick={onToggle} type="button" aria-label={isOpen ? "Thu gọn menu quản lý" : "Mở menu quản lý"} aria-expanded={isOpen}>
        <span aria-hidden="true">{isOpen ? "‹" : "›"}</span>
      </button>

      <div className="sidebar-header">
        <div className="sidebar-logo">
          <button className="logo-icon logo-icon-button" type="button" onClick={onToggle} aria-label={isOpen ? "Thu gọn menu quản lý" : "Mở menu quản lý"} aria-expanded={isOpen}>🍽️</button>
          <button className="logo-text logo-text-button" type="button" onClick={onToggle} aria-label={isOpen ? "Thu gọn menu quản lý" : "Mở menu quản lý"} aria-expanded={isOpen}>Cohan Manager</button>
        </div>
        <button className="sidebar-close" onClick={onClose} type="button" aria-label="Đóng thanh điều hướng">✕</button>
      </div>

      <nav className="sidebar-nav" aria-label="Điều hướng quản lý nhà hàng">
        {visibleSections.map((section, sectionIndex) => (
          <div key={section.title || sectionIndex} className="nav-section">
            <div className="nav-section-title" id={`manager-nav-section-${sectionIndex}`}>{section.title}</div>
            {section.items.map((item) => {
              const isAiItem = item.id?.startsWith("ai-");
              return (
                <button
                  key={item.id}
                  className={`nav-item ${isAiItem ? "nav-item--ai" : ""} ${activeItem === item.id ? "active" : ""}`}
                  onClick={() => handleItemClick(item)}
                  title={item.label}
                  type="button"
                  aria-current={activeItem === item.id ? "page" : undefined}
                  aria-label={item.label}
                  data-tooltip={item.label}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                  {activeItem === item.id && <div className="nav-indicator" />}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="user-avatar-small">👨‍💼</div>
          <div className="user-info-small">
            <div className="user-name-small">{sidebarUserName}</div>
            <div className="user-status-small"><span className="status-dot-small" />{sidebarUserRole}</div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
