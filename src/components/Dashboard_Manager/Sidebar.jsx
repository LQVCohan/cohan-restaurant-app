import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Home, UsersRound } from "lucide-react";
import "./Styles/Sidebar.scss";
import "./Styles/SidebarShellFix.scss";
import "./Styles/SidebarPortalActions.scss";
import { AuthContext } from "@/context/AuthContext";
import { filterNavigationByPermissionAccess } from "@/utils/frontendPermissionAccess";
import { canAccessRoute, isAdminRole } from "@/utils/frontendRoleAccess";
import { getDisplayUser, getInitials, resolveUserAvatarSrc } from "@/lib/userAvatar";
import {
  getCombinedRoleLabel,
  getMembershipScopeLabel,
  getRoleTooltip,
  isBrandWideRole,
} from "@/lib/userRoleDisplay";

const BACKUP_PERMISSIONS = ["backup.read", "backup.write", "backup.export", "backup.import", "system.manage"];
const LOG_PERMISSIONS = ["log.read", "admin.audit.read", "system.manage", "menu.audit.read"];

const NAVIGATION_SECTIONS = [
  {
    title: "Tổng quan",
    items: [
      { id: "dashboard", icon: "📊", label: "Tổng quan", page: "Tổng quan", permissions: ["dashboard.read", "report.read"] },
      { id: "analytics", icon: "📈", label: "Phân tích kinh doanh", page: "Phân tích kinh doanh", permissions: ["report.read"] },
    ],
  },
  {
    title: "Vận hành",
    items: [
      { id: "brands", permissions: ["restaurant.read", "restaurant.write", "system.manage"], icon: "🏢", label: "Chuỗi nhà hàng", page: "Chuỗi nhà hàng" },
      { id: "orders", permissions: ["order.read"], icon: "🛒", label: "Đơn hàng", page: "Đơn hàng" },
      { id: "menu", permissions: ["menu.read"], icon: "📋", label: "Thực đơn", page: "Thực đơn" },
      { id: "modifiers", permissions: ["menu.read"], icon: "🧩", label: "Tùy chọn món", page: "Tùy chọn món" },
      { id: "combos", permissions: ["menu.read"], icon: "🍱", label: "Combo món", page: "Combo món" },
      { id: "inventory", permissions: ["inventory.read", "stock.read"], icon: "📦", label: "Kho hàng", page: "Kho hàng" },
      { id: "tables", permissions: ["table.read"], icon: "🪑", label: "Bàn ăn", page: "Bàn ăn" },
      { id: "table-qr", permissions: ["table.read"], icon: "📱", label: "Mã QR tại bàn", page: "Mã QR tại bàn" },
      { id: "restaurant-info-management", permissions: ["restaurant.read"], icon: "🏪", label: "Thông tin nhà hàng", page: "Thông tin nhà hàng" },
    ],
  },
  {
    title: "Nhân sự",
    items: [
      { id: "staff", permissions: ["staff.read"], icon: "👥", label: "Nhân viên", page: "Nhân viên" },
      { id: "rbac", permissions: ["role.read", "permission.read", "staff.write"], icon: "🛡️", label: "Phân quyền nhân viên", page: "Phân quyền nhân viên" },
      { id: "schedules", permissions: ["shift.read"], icon: "📅", label: "Lịch làm việc", page: "Lịch làm việc" },
      { id: "payroll", permissions: ["payroll.read"], icon: "💰", label: "Bảng lương", page: "Bảng lương" },
    ],
  },
  {
    title: "Khách hàng",
    items: [
      { id: "customers", permissions: ["customer.read"], icon: "👤", label: "Khách hàng", page: "Khách hàng" },
      { id: "customer-analytics", permissions: ["report.read"], icon: "🧠", label: "Phân tích khách hàng", page: "Phân tích khách hàng" },
      { id: "promotions", permissions: ["promotion.read", "coupon.read"], icon: "🎁", label: "Khuyến mãi", page: "Chương trình khuyến mãi" },
      { id: "ai-handoff", permissions: ["ai.chatbot.handoff", "ai.chatbot.moderate"], icon: "🤖", label: "Hội thoại cần hỗ trợ", page: "Hội thoại cần hỗ trợ" },
      { id: "ai-chatbot-analytics", permissions: ["ai.chatbot.analytics.read", "ai.chatbot.read"], icon: "📡", label: "Báo cáo trợ lý AI", page: "Báo cáo trợ lý AI" },
      { id: "ai-chatbot-settings", permissions: ["ai.chatbot.write"], icon: "⚙️", label: "Cài đặt trợ lý AI", page: "Cài đặt trợ lý AI" },
      {
        id: "ai-chatbot-knowledge",
        permissions: ["ai.chatbot.read", "ai.chatbot.write", "ai.chatbot.moderate", "ai.chatbot.evaluate"],
        icon: "📚",
        label: "Tri thức trợ lý AI",
        page: "Tri thức trợ lý AI",
      },
      { id: "reviews", permissions: ["review.read", "report.read"], icon: "⭐", label: "Đánh giá", page: "Đánh giá" },
    ],
  },
  {
    title: "Tài chính & báo cáo",
    items: [
      { id: "reports", permissions: ["report.read"], icon: "📊", label: "Báo cáo tổng hợp", page: "Báo cáo" },
      { id: "finance", permissions: ["payment.read"], icon: "💳", label: "Tài chính", page: "Tài chính" },
      { id: "transactions", permissions: ["transaction.read", "finance.read", "payment.read"], icon: "🧾", label: "Giao dịch", page: "Giao dịch" },
      { id: "transfer-review", permissions: ["payment.read"], icon: "🏦", label: "Duyệt chuyển khoản", page: "Duyệt chuyển khoản" },
      { id: "payment-settings", permissions: ["payment.read", "payment.write"], icon: "🔐", label: "Cổng thanh toán", page: "Cổng thanh toán" },
      { id: "wallet", permissions: ["payment.read", "payment.write", "refund.write"], icon: "👛", label: "Ví khách hàng", page: "Ví khách hàng" },
    ],
  },
  {
    title: "Hệ thống",
    items: [
      { id: "settings", permissions: ["system.manage"], icon: "⚙️", label: "Cài đặt hệ thống", page: "Cài đặt hệ thống" },
      { id: "system-users", roles: ["admin"], icon: "👤", label: "Người dùng hệ thống", page: "Người dùng hệ thống" },
      { id: "logs", permissions: LOG_PERMISSIONS, icon: "🧾", label: "Check log", page: "Check log" },
      { id: "print-management", permissions: ["print.read"], icon: "🖨️", label: "In ấn", page: "In ấn" },
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
  const canAccessStaffPortal = canAccessRoute(user, "/staff/dashboard");

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
    const content = document.querySelector(".manager-layout__content");
    if (content) {
      if (typeof content.scrollTo === "function") {
        content.scrollTo({ top: 0, left: 0, behavior: "auto" });
      } else {
        content.scrollTop = 0;
      }
    }
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
        {isOpen ? <ChevronLeft aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
      </button>

      <div className="sidebar-header">
        <button
          className="manager-sidebar-brand"
          type="button"
          onClick={onToggle}
          aria-label={isOpen ? "Thu gọn menu quản lý" : "Mở menu quản lý"}
          aria-expanded={isOpen}
          title="Cohan"
        >
          <img className="manager-sidebar-brand__icon" src="/cohan_logo_icon.svg" alt="" />
          <img className="manager-sidebar-brand__wordmark" src="/cohan_wordmark.svg" alt="" />
        </button>
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
        <nav className="sidebar-portal-actions" aria-label="Chuyển khu vực">
          <a className="sidebar-portal-action" href="/" aria-label="Chuyển đến trang chủ">
            <Home aria-hidden="true" />
            <span>Trang chủ</span>
          </a>
          {canAccessStaffPortal && (
            <a className="sidebar-portal-action" href="/staff/dashboard" aria-label="Chuyển đến khu nhân viên">
              <UsersRound aria-hidden="true" />
              <span>Khu nhân viên</span>
            </a>
          )}
        </nav>
      </div>
    </aside>
  );
};

export default Sidebar;
