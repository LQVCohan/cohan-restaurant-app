import React, { useContext, useMemo } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "@/context/AuthContext";
import {
  hasStaffKitchenAccess,
  hasStaffOrderAccess,
  resolveUserRoleName,
} from "@/utils/frontendRoleAccess";
import "./StaffDashboardPage.scss";

const getDisplayName = (user) =>
  user?.fullName || user?.name || user?.displayName || user?.username || "Nhân viên";

const getInitials = (name) => {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "NV";
  return parts.slice(-2).map((part) => part.charAt(0).toUpperCase()).join("");
};

const StatusBadge = ({ tone = "muted", children }) => (
  <span className={`staff-status-badge staff-status-badge--${tone}`}>{children}</span>
);

const ActionCard = ({ to, title, description, cta, tone = "neutral", disabled = false }) => {
  if (disabled) {
    return (
      <article className={`staff-action-card staff-action-card--${tone} staff-action-card--disabled`} aria-disabled="true">
        <span className="staff-action-card__content">
          <strong>{title}</strong>
          <span>{description}</span>
        </span>
        <span className="staff-action-card__cta">Chờ hỗ trợ</span>
      </article>
    );
  }

  return (
    <Link className={`staff-action-card staff-action-card--${tone}`} to={to}>
      <span className="staff-action-card__content">
        <strong>{title}</strong>
        <span>{description}</span>
      </span>
      <span className="staff-action-card__cta">{cta}</span>
    </Link>
  );
};

const taskItems = [
  { label: "Trước ca", title: "Kiểm tra lịch và phản hồi ca mới", to: "/staff/schedule" },
  { label: "Trong ca", title: "Chấm công vào/ra đúng thời điểm", to: "/staff/schedule" },
  { label: "Sau ca", title: "Gửi chỉnh công hoặc tăng ca nếu phát sinh", to: "/staff/attendance" },
  { label: "Khi cần nghỉ", title: "Gửi đơn nghỉ phép để quản lý duyệt", to: "/staff/leave" },
  { label: "Sau ca", title: "Theo dõi nhắc việc và phản hồi quản lý", to: "/staff/notifications" },
];

const baseActions = [
  {
    to: "/staff/schedule",
    title: "Lịch cá nhân",
    description: "Xem ca tuần này, xác nhận lịch và theo dõi trạng thái công bố.",
    cta: "Mở lịch",
    tone: "success",
  },
  {
    to: "/staff/schedule",
    title: "Chấm công vào/ra",
    description: "Vào trang lịch để chấm công ca đang diễn ra hoặc sắp bắt đầu.",
    cta: "Chấm công",
    tone: "success",
  },
  {
    to: "/staff/attendance",
    title: "Chỉnh công / tăng ca",
    description: "Xem công trong ngày, gửi yêu cầu chỉnh công hoặc tăng ca cho quản lý duyệt.",
    cta: "Mở yêu cầu",
    tone: "warm",
  },
  {
    to: "/staff/schedule",
    title: "Đăng ký lịch rảnh/bận",
    description: "Gửi lịch rảnh/bận, báo ca không thể làm hoặc yêu cầu thay đổi muộn.",
    cta: "Đăng ký",
    tone: "warm",
  },
  {
    to: "/staff/leave",
    title: "Nghỉ phép",
    description: "Tạo đơn nghỉ phép và theo dõi trạng thái duyệt ngay trong khu vực nhân viên.",
    cta: "Tạo đơn",
    tone: "warm",
  },
  {
    to: "/staff/profile",
    title: "Hồ sơ cá nhân",
    description: "Xem thông tin liên hệ, tài khoản, quyền truy cập và tóm tắt công việc.",
    cta: "Xem hồ sơ",
    tone: "neutral",
  },
  {
    to: "/staff/notifications",
    title: "Thông báo / nhắc việc",
    description: "Theo dõi lịch làm, chấm công, phản hồi quản lý và yêu cầu cần xử lý.",
    cta: "Xem thông báo",
    tone: "warm",
  },
  {
    to: "/staff/payslips",
    title: "Phiếu lương",
    description: "Kiểm tra kỳ lương đã công bố, khoản thanh toán và ghi chú lương.",
    cta: "Xem phiếu",
    tone: "neutral",
  },
  {
    to: "/staff/performance",
    title: "Hiệu suất",
    description: "Xem chỉ số làm việc và phản hồi hiệu suất cá nhân.",
    cta: "Xem hiệu suất",
    tone: "success",
  },
];

const notificationPreview = [
  { type: "Lịch làm", title: "Kiểm tra lịch tuần và phản hồi ca mới nếu có." },
  { type: "Chấm công", title: "Chấm công vào trước ca và chấm công ra khi kết thúc ca." },
  { type: "Công phát sinh", title: "Gửi chỉnh công hoặc tăng ca ngay khi phát hiện lệch dữ liệu." },
  { type: "Nghỉ phép", title: "Gửi đơn nghỉ phép sớm để quản lý kịp xếp ca thay thế." },
];

const StaffDashboardPage = () => {
  const { user } = useContext(AuthContext);
  const normalizedRole = useMemo(() => resolveUserRoleName(user), [user]);
  const staffName = getDisplayName(user);
  const departmentCopy = "Các khu vực được mở theo quyền truy cập của tài khoản để nhân viên xử lý nhanh trong ca.";
  const initials = getInitials(staffName);
  const canOrder = hasStaffOrderAccess(normalizedRole);
  const canKitchen = hasStaffKitchenAccess(normalizedRole);

  const specialtyActions = useMemo(() => {
    const actions = [];
    if (canOrder) {
      actions.push({
        to: "/staff/orders",
        title: "Đơn nội bộ",
        description: "Xử lý đơn, bàn, thanh toán và điều phối phục vụ theo quyền được cấp.",
        cta: "Mở đơn",
        tone: "success",
      });
    }
    if (canKitchen) {
      actions.push({
        to: "/staff/kitchen",
        title: "Khu vực bếp",
        description: "Theo dõi món chờ nhận, đang làm, hoàn tất và nhịp phối hợp với sảnh.",
        cta: "Mở bếp",
        tone: "warm",
      });
    }
    return actions;
  }, [canKitchen, canOrder]);

  return (
    <div className="staff-dashboard-page staff-page" aria-labelledby="staff-dashboard-title">
      <section className="staff-dashboard-hero" aria-label="Tổng quan ca làm">
        <div className="staff-dashboard-hero__copy">
          <StatusBadge tone="success">Trung tâm ca làm</StatusBadge>
          <h1 id="staff-dashboard-title">Xin chào, {staffName}</h1>
          <p>
            Khu vực làm việc của nhân viên: kiểm tra lịch, chấm công, xem nhắc việc và mở nhanh đúng phần việc trong ca.
          </p>
          <div className="staff-hero-links" aria-label="Lối tắt ca làm">
            <Link className="staff-hero-link" to="/staff/schedule"><span>Ca hôm nay</span><strong>Xem lịch</strong></Link>
            <Link className="staff-hero-link" to="/staff/attendance"><span>Công phát sinh</span><strong>Chỉnh công</strong></Link>
            <Link className="staff-hero-link" to="/staff/leave"><span>Nghỉ phép</span><strong>Tạo đơn</strong></Link>
            <Link className="staff-hero-link" to="/staff/notifications"><span>Nhắc việc</span><strong>Thông báo</strong></Link>
          </div>
        </div>

        <aside className="staff-identity-card" aria-label="Danh tính nhân viên">
          <div className="staff-identity-card__avatar" aria-hidden="true">{initials}</div>
          <span>Đang đăng nhập</span>
          <strong>{staffName}</strong>
          <div className="staff-identity-card__status">Sẵn sàng / Theo lịch</div>
        </aside>
      </section>

      <section className="staff-dashboard-grid" aria-label="Thao tác nhanh trong ca">
        <article className="staff-shift-command-card staff-card">
          <div className="staff-shift-command-card__header">
            <StatusBadge tone="muted">Ca hôm nay</StatusBadge>
            <span className="staff-shift-command-card__time">Sẵn sàng</span>
          </div>
          <h2>Kiểm tra ca trước khi bắt đầu</h2>
          <p>Vào lịch cá nhân để xem ca được phân, xác nhận lịch, chấm công và gửi lịch rảnh/bận đúng kỳ.</p>
          <div className="staff-shift-command-card__checklist" aria-label="Các bước trong ca">
            <span>Xem lịch tuần</span>
            <span>Chấm công</span>
            <span>Phản hồi ca</span>
          </div>
          <div className="staff-shift-command-card__actions">
            <Link className="staff-primary-dashboard-button" to="/staff/schedule">Xem lịch tuần</Link>
            <Link className="staff-secondary-dashboard-button" to="/staff/attendance">Chỉnh công / tăng ca</Link>
          </div>
        </article>

        <aside className="staff-task-panel staff-card" aria-label="Việc cần xử lý">
          <div className="staff-task-panel__header">
            <h2>Việc cần xử lý</h2>
            <StatusBadge tone="warning">Theo ca</StatusBadge>
          </div>
          <div className="staff-task-list">
            {taskItems.map((item) => (
              <Link className="staff-task-item" to={item.to} key={item.title}>
                <span>{item.label}</span>
                <strong>{item.title}</strong>
              </Link>
            ))}
          </div>
        </aside>
      </section>

      <section className="staff-dashboard-section staff-card" aria-labelledby="staff-actions-title">
        <div className="staff-dashboard-section__header">
          <div>
            <StatusBadge tone="success">Thao tác nhanh</StatusBadge>
            <h2 id="staff-actions-title">Thao tác nhân viên</h2>
          </div>
          <p>Các thao tác thường dùng được gom lại để nhân viên xử lý nhanh trong ca.</p>
        </div>
        <div className="staff-action-grid">
          {baseActions.map((action) => <ActionCard key={action.title} {...action} />)}
        </div>
      </section>

      <section className="staff-dashboard-section staff-dashboard-section--work-area staff-card" aria-labelledby="staff-work-area-title">
        <div className="staff-dashboard-section__header">
          <div>
            <StatusBadge tone="warm">Công cụ ca làm</StatusBadge>
            <h2 id="staff-work-area-title">Khu vực thao tác trong ca</h2>
          </div>
          <p>{departmentCopy}</p>
        </div>
        {specialtyActions.length ? (
          <div className="staff-work-area-list">
            {specialtyActions.map((action) => <ActionCard key={action.title} {...action} />)}
          </div>
        ) : (
          <div className="staff-dashboard-empty" role="status">
            <div className="staff-dashboard-empty__mark">•</div>
            <div>
              <h3>Tài khoản này chưa có khu vực đơn nội bộ hoặc bếp riêng</h3>
              <p>Bạn vẫn có thể sử dụng lịch cá nhân, hồ sơ, thông báo, phiếu lương và phản hồi hiệu suất.</p>
            </div>
          </div>
        )}
      </section>

      <section className="staff-dashboard-embedded-grid" aria-label="Hồ sơ và thông báo tóm tắt">
        <article className="staff-dashboard-section staff-card" aria-labelledby="staff-profile-preview-title">
          <div className="staff-dashboard-section__header">
            <div>
              <StatusBadge tone="muted">Hồ sơ</StatusBadge>
              <h2 id="staff-profile-preview-title">Hồ sơ nhân viên</h2>
            </div>
            <Link className="staff-text-dashboard-link" to="/staff/profile">Mở hồ sơ</Link>
          </div>
          <div className="staff-embedded-profile-card">
            <div className="staff-embedded-profile-card__avatar" aria-hidden="true">{initials}</div>
            <div><span>Nhân viên</span><strong>{staffName}</strong><small>Chi tiết trong hồ sơ</small></div>
            <div className="staff-embedded-profile-card__meta"><span>Email</span><strong>{user?.email || "Chưa cập nhật"}</strong></div>
            <div className="staff-embedded-profile-card__meta"><span>Điện thoại</span><strong>{user?.phone || "Chưa cập nhật"}</strong></div>
          </div>
        </article>

        <article className="staff-dashboard-section staff-card" aria-labelledby="staff-notification-preview-title">
          <div className="staff-dashboard-section__header">
            <div>
              <StatusBadge tone="warning">Thông báo</StatusBadge>
              <h2 id="staff-notification-preview-title">Nhắc việc quan trọng</h2>
            </div>
            <Link className="staff-text-dashboard-link" to="/staff/notifications">Xem tất cả</Link>
          </div>
          <div className="staff-embedded-notification-list" role="list">
            {notificationPreview.map((item) => (
              <div className="staff-embedded-notification" role="listitem" key={item.title}>
                <span>{item.type}</span>
                <strong>{item.title}</strong>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
};

export default StaffDashboardPage;
