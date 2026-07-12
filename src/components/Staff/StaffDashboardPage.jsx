import React, { useContext, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  BellRing,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CookingPot,
  FileText,
  Fingerprint,
  Gauge,
  MessageSquare,
  Settings2,
  ShoppingBag,
  UserRound,
  WalletCards,
} from "lucide-react";
import { AuthContext } from "@/context/AuthContext";
import {
  hasStaffKitchenAccess,
  hasStaffOrderAccess,
  resolveUserRoleName,
} from "@/utils/frontendRoleAccess";
import "./StaffDashboardPage.scss";

const primaryActions = [
  {
    to: "/staff/schedule",
    title: "Lịch cá nhân",
    description: "Xem ca và phản hồi lịch",
    icon: CalendarDays,
  },
  {
    to: "/staff/attendance",
    title: "Chấm công & chỉnh công",
    description: "Xử lý công phát sinh",
    icon: Fingerprint,
  },
  {
    to: "/staff/leave",
    title: "Nghỉ phép",
    description: "Tạo và theo dõi đơn",
    icon: FileText,
  },
  {
    to: "/staff/notifications",
    title: "Thông báo",
    description: "Xem nhắc việc mới",
    icon: BellRing,
  },
];

const secondaryActions = [
  { to: "/staff/profile", title: "Hồ sơ cá nhân", icon: UserRound },
  { to: "/staff/payslips", title: "Phiếu lương", icon: WalletCards },
  { to: "/staff/performance", title: "Hiệu suất", icon: Gauge },
  { to: "/staff/contacts", title: "Liên lạc", icon: MessageSquare },
  { to: "/staff/settings", title: "Cài đặt", icon: Settings2 },
];

const DashboardAction = ({ to, title, description, icon: Icon, emphasis = false }) => (
  <Link
    className={`staff-dashboard-action ${emphasis ? "is-emphasis" : ""}`}
    to={to}
  >
    <span className="staff-dashboard-action__icon" aria-hidden="true">
      <Icon size={20} />
    </span>
    <span className="staff-dashboard-action__copy">
      <strong>{title}</strong>
      {description ? <small>{description}</small> : null}
    </span>
    <ChevronRight className="staff-dashboard-action__arrow" size={18} aria-hidden="true" />
  </Link>
);

const StaffDashboardPage = () => {
  const { user } = useContext(AuthContext) || {};
  const normalizedRole = useMemo(() => resolveUserRoleName(user), [user]);
  const canOrder = hasStaffOrderAccess(normalizedRole);
  const canKitchen = hasStaffKitchenAccess(normalizedRole);

  const roleActions = useMemo(() => {
    const actions = [];

    if (canOrder) {
      actions.push({
        to: "/staff/orders",
        title: "Đơn nội bộ",
        description: "Bàn, món và thanh toán",
        icon: ShoppingBag,
      });
    }

    if (canKitchen) {
      actions.push({
        to: "/staff/kitchen",
        title: "Bếp / Quầy bar",
        description: "Theo dõi món cần xử lý",
        icon: CookingPot,
      });
    }

    return actions;
  }, [canKitchen, canOrder]);

  return (
    <div className="staff-dashboard-page staff-page">
      <section className="staff-dashboard-command" aria-labelledby="staff-shift-command-title">
        <div className="staff-dashboard-command__copy">
          <span className="staff-dashboard-command__eyebrow">Ca làm của bạn</span>
          <h2 id="staff-shift-command-title">Kiểm tra lịch trước khi bắt đầu</h2>
          <p>Xem ca được phân, phản hồi lịch và chấm công đúng thời điểm.</p>
          <div className="staff-dashboard-command__actions">
            <Link className="staff-dashboard-primary" to="/staff/schedule">
              <CalendarDays size={18} aria-hidden="true" />
              Mở lịch cá nhân
            </Link>
            <Link className="staff-dashboard-secondary" to="/staff/attendance">
              Chỉnh công / tăng ca
            </Link>
          </div>
        </div>

        <ol className="staff-dashboard-command__steps" aria-label="Ba bước trong ca làm">
          <li><span>1</span><strong>Xem ca</strong></li>
          <li><span>2</span><strong>Chấm công</strong></li>
          <li><span>3</span><strong>Phản hồi</strong></li>
        </ol>
      </section>

      <section className="staff-dashboard-block" aria-labelledby="staff-primary-actions-title">
        <div className="staff-dashboard-block__header">
          <div>
            <span>Truy cập nhanh</span>
            <h2 id="staff-primary-actions-title">Thao tác thường dùng</h2>
          </div>
        </div>
        <div className="staff-dashboard-action-grid">
          {primaryActions.map((action, index) => (
            <DashboardAction key={action.to} {...action} emphasis={index === 0} />
          ))}
        </div>
      </section>

      {roleActions.length ? (
        <section className="staff-dashboard-block" aria-labelledby="staff-role-actions-title">
          <div className="staff-dashboard-block__header">
            <div>
              <span>Theo vai trò</span>
              <h2 id="staff-role-actions-title">Công cụ trong ca</h2>
            </div>
          </div>
          <div className="staff-dashboard-role-grid">
            {roleActions.map((action) => (
              <DashboardAction key={action.to} {...action} />
            ))}
          </div>
        </section>
      ) : null}

      <details className="staff-dashboard-more">
        <summary>
          <span>
            <strong>Tiện ích khác</strong>
            <small>Hồ sơ, lương, hiệu suất và cài đặt</small>
          </span>
          <ChevronDown size={20} aria-hidden="true" />
        </summary>
        <div className="staff-dashboard-more__grid">
          {secondaryActions.map((action) => (
            <DashboardAction key={action.to} {...action} />
          ))}
        </div>
      </details>
    </div>
  );
};

export default StaffDashboardPage;
