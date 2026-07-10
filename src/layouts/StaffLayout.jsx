import React, { useContext, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AuthContext } from "@/context/AuthContext";
import useCommunication from "@/hooks/useCommunication";
import StaffQrOrderRealtimeNotice from "@/components/Staff/StaffQrOrderRealtimeNotice";
import PosIncomingTableOrderQueue from "@/components/Dashboard_Manager/POS/components/pos/PosIncomingTableOrderQueue";
import "./StaffLayout.scss";
import "./StaffWorkspaceOverrides.scss";
import {
  resolveUserRoleName,
  STAFF_KITCHEN_ROLES,
  STAFF_ORDER_ROLES,
} from "@/utils/frontendRoleAccess";
import { hasAnyPermission } from "@/utils/frontendPermissionAccess";
import { getStaffRoleDisplayLabel } from "@/utils/staffRoleOptions";

const HANDOFF_PERMISSIONS = ["ai.chatbot.handoff", "ai.chatbot.moderate"];
const ORDER_NOTICE_PERMISSIONS = ["order.read", "order.update"];

const getDisplayName = (user) => {
  if (!user || typeof user !== "object") return null;
  return user.fullName || user.name || user.displayName || user.username || null;
};

const roleLabelFallbacks = {
  admin: "Quản trị viên",
  manager: "Quản lý",
  hr: "Nhân sự",
  accountant: "Kế toán",
  staff: "Nhân viên",
};

const getRoleLabel = (user, normalizedRole) => {
  if (!user || typeof user !== "object") {
    return roleLabelFallbacks[normalizedRole] || normalizedRole;
  }
  return (
    roleLabelFallbacks[normalizedRole] ||
    getStaffRoleDisplayLabel(user.role || user.roleName || user.roleSlug || normalizedRole) ||
    normalizedRole
  );
};

const isActivePath = (location, target) =>
  location.pathname === target ||
  (target !== "/staff/dashboard" && location.pathname.startsWith(`${target}/`));

const StaffHandoffUnreadCount = ({ restaurantId }) => {
  const { notifications = [] } = useCommunication({
    restaurantId,
    notificationsEnabled: Boolean(restaurantId),
  });
  const unreadCount = notifications.filter(
    (notification) =>
      String(notification?.type || "").toLowerCase() === "ai_chatbot_handoff" &&
      !notification?.readAt,
  ).length;

  if (!unreadCount) return null;
  return (
    <span
      className="staff-shell__nav-count"
      aria-label={`${unreadCount} yêu cầu hỗ trợ chưa đọc`}
    >
      {unreadCount}
    </span>
  );
};

const navGroups = [
  {
    label: "Công việc",
    keys: [
      "/staff/dashboard",
      "/staff/schedule",
      "/staff/attendance",
      "/staff/leave",
      "/staff/performance",
      "/staff/orders",
      "/staff/reservation-changes",
      "/staff/kitchen",
      "/staff/contacts",
    ],
  },
  {
    label: "Tài khoản",
    keys: [
      "/staff/profile",
      "/staff/notifications",
      "/staff/payslips",
      "/staff/settings",
    ],
  },
  { label: "Hỗ trợ", keys: ["/staff/ai-handoff"] },
];

const staffPageMeta = [
  {
    path: "/staff/dashboard",
    eyebrow: "Khu vực nhân viên",
    title: "Trung tâm ca làm",
    description: "Mở nhanh lịch, chấm công, nghỉ phép và các việc cần xử lý trong ca.",
  },
  {
    path: "/staff/schedule",
    eyebrow: "Lịch cá nhân",
    title: "Vận hành ca làm",
    description:
      "Xem ca được phân, phản hồi lịch và thực hiện check-in/check-out đúng thời điểm.",
  },
  {
    path: "/staff/attendance",
    eyebrow: "Chỉnh công & tăng ca",
    title: "Yêu cầu công cá nhân",
    description:
      "Xem công trong ngày, gửi chỉnh công hoặc yêu cầu tăng ca cho quản lý duyệt.",
  },
  {
    path: "/staff/leave",
    eyebrow: "Nghỉ phép nhân viên",
    title: "Tạo và theo dõi đơn nghỉ phép",
    description:
      "Gửi đơn xin nghỉ phép, xem trạng thái duyệt và lịch sử đơn ngay trong khu vực nhân viên.",
  },
  {
    path: "/staff/performance",
    eyebrow: "Hiệu suất",
    title: "Hiệu suất cá nhân",
    description: "Xem điểm làm việc, sự cố liên quan và phản hồi hiệu suất của bạn.",
  },
  {
    path: "/staff/orders",
    eyebrow: "Vận hành đơn",
    title: "Order nội bộ",
    description:
      "Tiếp nhận đơn, cập nhật trạng thái phục vụ và phối hợp với bếp theo quyền được cấp.",
  },
  {
    path: "/staff/reservation-changes",
    eyebrow: "Đặt bàn",
    title: "Duyệt yêu cầu đổi đặt bàn",
    description: "Kiểm tra yêu cầu đổi giờ hoặc đổi bàn trước khi cập nhật chính thức.",
  },
  {
    path: "/staff/kitchen",
    eyebrow: "Bếp / Quầy bar",
    title: "Điều phối khu chế biến",
    description:
      "Theo dõi món mới, món đang làm và món đã hoàn tất tại bếp chính hoặc quầy bar.",
  },
  {
    path: "/staff/profile",
    eyebrow: "Tài khoản",
    title: "Hồ sơ nhân viên",
    description: "Kiểm tra thông tin cá nhân, vai trò, liên hệ và dữ liệu làm việc.",
  },
  {
    path: "/staff/notifications",
    eyebrow: "Nhắc việc",
    title: "Thông báo nhân viên",
    description:
      "Theo dõi lịch mới, yêu cầu phản hồi và các cập nhật quan trọng từ quản lý.",
  },
  {
    path: "/staff/contacts",
    eyebrow: "Liên lạc",
    title: "Trao đổi nội bộ",
    description: "Mở kênh liên lạc với quản lý, hỗ trợ và các bộ phận liên quan.",
  },
  {
    path: "/staff/ai-handoff",
    eyebrow: "Hỗ trợ",
    title: "Bàn giao hỗ trợ",
    description: "Theo dõi các hội thoại cần nhân viên tiếp nhận sau khi AI chuyển giao.",
  },
  {
    path: "/staff/payslips",
    eyebrow: "Phiếu lương",
    title: "Lương cá nhân",
    description: "Xem kỳ lương, khoản thanh toán và ghi chú liên quan đến lương.",
  },
  {
    path: "/staff/settings",
    eyebrow: "Thiết lập",
    title: "Cài đặt nhân viên",
    description: "Điều chỉnh các tuỳ chọn tài khoản và trải nghiệm trong khu vực nhân viên.",
  },
];

const getStaffPageMeta = (pathname) =>
  staffPageMeta.find(
    (item) => pathname === item.path || pathname.startsWith(`${item.path}/`),
  ) || staffPageMeta[0];

export default function StaffLayout({ children }) {
  const { user, activeRestaurant, activeRestaurantId } = useContext(AuthContext);
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const normalizedRole = useMemo(() => resolveUserRoleName(user), [user]);
  const displayName = getDisplayName(user);
  const roleLabel = getRoleLabel(user, normalizedRole);
  const restaurantLabel = activeRestaurant?.name || "Chưa xác định cơ sở làm việc";
  const pageMeta = useMemo(() => getStaffPageMeta(location.pathname), [location.pathname]);
  const orderNoticeRestaurantId =
    activeRestaurantId || user?.restaurantForStaff || activeRestaurant?.id || null;
  const canReceiveOrderNotice =
    STAFF_ORDER_ROLES.includes(normalizedRole) ||
    hasAnyPermission(user, ORDER_NOTICE_PERMISSIONS);
  const showIncomingOrderQueue =
    location.pathname.startsWith("/staff/orders") &&
    canReceiveOrderNotice &&
    Boolean(orderNoticeRestaurantId);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const navItems = useMemo(
    () => [
      { label: "Tổng quan", to: "/staff/dashboard" },
      { label: "Lịch cá nhân", to: "/staff/schedule" },
      { label: "Chỉnh công / tăng ca", to: "/staff/attendance" },
      { label: "Nghỉ phép", to: "/staff/leave" },
      { label: "Hiệu suất", to: "/staff/performance" },
      { label: "Hồ sơ", to: "/staff/profile" },
      { label: "Thông báo", to: "/staff/notifications" },
      { label: "Liên lạc", to: "/staff/contacts" },
      {
        label: "Bàn giao hỗ trợ",
        to: "/staff/ai-handoff",
        permissions: HANDOFF_PERMISSIONS,
      },
      { label: "Phiếu lương", to: "/staff/payslips" },
      { label: "Order nội bộ", to: "/staff/orders", roles: STAFF_ORDER_ROLES },
      {
        label: "Đổi đặt bàn",
        to: "/staff/reservation-changes",
        roles: STAFF_ORDER_ROLES,
      },
      { label: "Bếp / Quầy bar", to: "/staff/kitchen", roles: STAFF_KITCHEN_ROLES },
      { label: "Cài đặt", to: "/staff/settings" },
    ],
    [],
  );

  const visibleNavItems = useMemo(
    () =>
      navItems.filter((item) => {
        if (
          Array.isArray(item.permissions) &&
          !hasAnyPermission(user, item.permissions)
        ) {
          return false;
        }
        if (!Array.isArray(item.roles)) return true;
        return item.roles.includes(normalizedRole);
      }),
    [navItems, normalizedRole, user],
  );

  return (
    <div className="staff-shell">
      <StaffQrOrderRealtimeNotice
        restaurantId={orderNoticeRestaurantId}
        enabled={canReceiveOrderNotice}
      />
      <header className="staff-shell__header">
        <div className="staff-shell__inner">
          <div className="staff-shell__topbar">
            <div className="staff-shell__heading">
              <p className="staff-shell__eyebrow">{pageMeta.eyebrow}</p>
              <h1 className="staff-shell__title">{pageMeta.title}</h1>
              <p className="staff-shell__subtitle">{pageMeta.description}</p>
            </div>
            <div className="staff-shell__identity">
              <div className="staff-shell__identity-avatar" aria-hidden="true">
                {(displayName || "NV").slice(0, 2).toUpperCase()}
              </div>
              <div className="staff-shell__identity-copy">
                <div>{displayName || "Nhân viên"}</div>
                <span>{roleLabel || "Chưa xác định vai trò"}</span>
                <small>{restaurantLabel} • Sẵn sàng</small>
              </div>
            </div>
            <button
              type="button"
              className="staff-shell__menu-button"
              aria-label={menuOpen ? "Đóng menu nhân viên" : "Mở menu nhân viên"}
              aria-expanded={menuOpen}
              aria-controls="staff-shell-navigation"
              onClick={() => setMenuOpen((value) => !value)}
            >
              <span />
              <span />
              <span />
            </button>
          </div>

          <nav
            id="staff-shell-navigation"
            className={`staff-shell__nav ${menuOpen ? "is-open" : ""}`}
            aria-label="Điều hướng khu vực nhân viên"
          >
            {navGroups.map((group) => {
              const groupItems = visibleNavItems.filter((item) =>
                group.keys.includes(item.to),
              );
              if (!groupItems.length) return null;
              return (
                <div className="staff-shell__nav-group" key={group.label}>
                  <span>{group.label}</span>
                  {groupItems.map((item) => {
                    const active = isActivePath(location, item.to);
                    return (
                      <Link
                        key={item.to}
                        className={`staff-shell__nav-link ${active ? "is-active" : ""}`}
                        to={item.to}
                        onClick={() => setMenuOpen(false)}
                        aria-current={active ? "page" : undefined}
                      >
                        {item.label}
                        {item.to === "/staff/ai-handoff" ? (
                          <StaffHandoffUnreadCount restaurantId={activeRestaurantId} />
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </nav>
        </div>
      </header>

      <main id="staff-main-content" className="staff-shell__main">
        <div className="staff-shell__content">
          {showIncomingOrderQueue ? (
            <PosIncomingTableOrderQueue restaurantId={orderNoticeRestaurantId} />
          ) : null}
          {children}
        </div>
      </main>
    </div>
  );
}
