import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import "./Styles/Sidebar.scss";
import "./Styles/SidebarShellFix.scss";
import { AuthContext } from "@/context/AuthContext";
import { filterNavigationByPermissionAccess } from "@/utils/frontendPermissionAccess";
import { isAdminRole } from "@/utils/frontendRoleAccess";
import { getDisplayUser, getInitials, resolveUserAvatarSrc } from "@/lib/userAvatar";
import {
  getCombinedRoleLabel,
  getMembershipScopeLabel,
  getRoleTooltip,
  isBrandWideRole,
} from "@/lib/userRoleDisplay";

const BACKUP_PERMISSIONS = ["backup.read", "backup.write", "backup.export", "backup.import", "system.manage"];

const NAVIGATION_SECTIONS = [
  {
    title: "Tổng quan",
    items: [
      { id: "dashboard", icon: "📊", label: "Dashboard", page: "Tổng quan", permissions: ["dashboard.read", "report.read"] },
      { id: "analytics", icon: "📈", label: "Quản lý kinh doanh", page: "Quản lý kinh doanh", permissions: ["report.read"] },
    ],
  },
  {
    title: "Quản lý",
    items: [
      { id: "brands", permissions: ["restaurant.read", "restaurant.write", "system.manage"], icon: "🏢", label: "Quản lý chuỗi", page: "Quản lý chuỗi" },
      { id: "orders", permissions: ["order.read"], icon: "🛒", label: "Đơn hàng", page: "Đơn hàng" },
      { id: "menu", permissions: ["menu.read"], icon: "📋", label: "Thực đơn", page: "Thực đơn" },
      { id: "modifiers", permissions: ["menu.read"], icon: "🧩", label: "Tuỳ chọn món", page: "Tuỳ chọn món" },
      { id: "combos", permissions: ["menu.read"], icon: "🍱", label: "Combo", page: "Combo" },
      { id: "inventory", permissions: ["inventory.read", "stock.read"], icon: "📦", label: "Kho hàng", page: "Kho hàng" },
      { id: "tables", permissions: ["table.read"], icon: "🪑", label: "Bàn ăn", page: "Bàn ăn" },
      { id: "table-qr", permissions: ["table.read"], icon: "📱", label: "QR bàn", page: "QR bàn" },
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
      { id: "backup", permissions: BACKUP_PERMISSIONS, icon: "💾", label: "Sao lưu & khôi phục", page: "Sao lưu & khôi phục" },
    ],
  },
];

const Sidebar = ({ isOpen, onClose, onToggle, onPageChange, activeItem, activeBrand = null }) => {
  const { user } = useContext(AuthContext);
  const [avatarImageFailed, setAvatarImageFailed] = useState(false);
  const sidebarUser = useMemo(() => getDisplayUser(user), [user]);
  const sidebarUserName = sidebarUser.fullName || "Quản lý";
  const activeMembership = activeBrand?.membership || (activeBrand?.membershipRole ? { role: activeBrand.membershipRole, restaurantIds: activeBrand.restaurantIds || [] } : null);
  const sidebarUserRole = useMemo(() => getCombinedRoleLabel({ user, activeBrand, membership: activeMembership, compact: true }), [activeBrand, activeMembership, user]);
  const sidebarScope = useMemo(() => getMembershipScopeLabel(activeMembership || { role: activeBrand?.membershipRole }, activeBrand?.restaurants, activeBrand?.name), [activeBrand, activeMembership]);
  const sidebarUserTooltip = useMemo(() => `${getRoleTooltip({ user, activeBrand, membership: activeMembership })} | Phạm vi phụ trách: ${sidebarScope}`, [activeBrand, activeMembership, sidebarScope, user]);
  const sidebarAvatarSrc = useMemo(() => resolveUserAvatarSrc(sidebarUser), [sidebarUser]);
  const sidebarAvatarFallback = useMemo(() => getInitials(sidebarUserName, "QL"), [sidebarUserName]);
  const ownsActiveBrand = Boolean(
    activeBrand?.ownerId && user?.id && String(activeBrand.ownerId) === String(user.id),
  );
  const canManageActiveBrand = isAdminRole(user) || ownsActiveBrand || isBrandWideRole(activeMembership);

  const visibleSections = useMemo(() => {
    const sections = filterNavigationByPermissionAccess(NAVIGATION_SECTIONS, user);
    if (canManageActiveBrand) return sections;
    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => item.id !== "brands"),
      }))
      .filter((section) => section.items.length > 0);
  }, [canManageActiveBrand, user]);

  const handleItemClick = useCallback((item) => {
    onPageChange(item.id);
    if (window.innerWidth <= 768) onClose();
  }, [onClose, onPageChange]);

  useEffect(() => {
    setAvatarImageFailed(false);
  }, [sidebarAvatarSrc]);

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
          {isOpen ? (
            <button className="logo-text logo-text-button" type="button" onClick={onToggle} aria-label="Thu gọn menu quản lý" aria-expanded="true">Cohan Manager</button>
          ) : null}
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
                  <span className="nav-icon" aria-hidden="true">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="user-avatar-small" aria-hidden="true">
            {sidebarAvatarSrc && !avatarImageFailed ? (
              <img src={sidebarAvatarSrc} alt="" onError={() => setAvatarImageFailed(true)} />
            ) : (
              <span>{sidebarAvatarFallback}</span>
            )}
          </div>
          <div className="user-info-small">
            <div className="user-name-small" title={sidebarUserName}>{sidebarUserName}</div>
            <div className="user-status-small" title={sidebarUserTooltip}>
              <span className="status-dot-small" aria-hidden="true" />
              <span>{sidebarUserRole} · {sidebarScope}</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
