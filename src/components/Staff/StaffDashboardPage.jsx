import React, { useContext, useMemo } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "@/context/AuthContext";
import {
  resolveUserRoleName,
  STAFF_ORDER_ROLES,
  STAFF_KITCHEN_ROLES,
} from "@/utils/frontendRoleAccess";
import "./StaffDashboardPage.scss";

const STAFF_ORDER_ROLE_SET = new Set(STAFF_ORDER_ROLES);
const STAFF_KITCHEN_ROLE_SET = new Set(STAFF_KITCHEN_ROLES);

const getDisplayName = (user) => {
  if (!user || typeof user !== "object") return null;
  return user.fullName || user.name || user.displayName || user.username || null;
};

const getRawRoleLabel = (user) => {
  if (!user || typeof user !== "object") return null;
  return user.roleName || user.roleSlug || user.role?.slug || user.role?.name || null;
};

const getRestaurantLabel = (restaurantForStaff) => {
  if (!restaurantForStaff) return "—";
  if (typeof restaurantForStaff === "string") return restaurantForStaff;
  if (typeof restaurantForStaff === "object") {
    return (
      restaurantForStaff.name ||
      restaurantForStaff.restaurantName ||
      restaurantForStaff.code ||
      restaurantForStaff.id ||
      restaurantForStaff._id ||
      "—"
    );
  }
  return "—";
};

const StaffStatusBadge = ({ tone = "muted", children }) => (
  <span className={`staff-dashboard-badge staff-dashboard-badge--${tone}`}>{children}</span>
);

const StaffActionCard = ({ to, title, description, cta, tone = "neutral", primary = false }) => (
  <Link className={`staff-action-card staff-action-card--${tone} ${primary ? "staff-action-card--primary" : ""}`} to={to}>
    <span className="staff-action-card__content">
      <strong>{title}</strong>
      <span>{description}</span>
    </span>
    <span className="staff-action-card__cta">{cta}</span>
  </Link>
);

const StaffEmptyState = ({ title, description, action }) => (
  <div className="staff-dashboard-empty" role="status">
    <div className="staff-dashboard-empty__mark">•</div>
    <div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action ? action : null}
    </div>
  </div>
);

const StaffMetricTile = ({ label, value, hint, tone = "neutral" }) => (
  <div className={`staff-metric-tile staff-metric-tile--${tone}`}>
    <span>{label}</span>
    <strong>{value}</strong>
    {hint ? <small>{hint}</small> : null}
  </div>
);

const StaffDashboardPage = () => {
  const { user } = useContext(AuthContext);

  const normalizedRole = useMemo(() => resolveUserRoleName(user), [user]);
  const staffName = getDisplayName(user);
  const roleLabel = getRawRoleLabel(user) || normalizedRole;
  const staffRestaurantLabel = getRestaurantLabel(user?.restaurantForStaff);

  const workAreaActions = useMemo(() => {
    const actions = [];

    if (STAFF_ORDER_ROLE_SET.has(normalizedRole)) {
      actions.push({
        to: "/staff/orders",
        title: "Order nội bộ",
        label: "Đi tới khu vực xử lý order nội bộ",
        description: "Xử lý bàn, order nội bộ và thanh toán theo quyền vai trò.",
        cta: "Mở order",
        tone: "success",
      });
    }

    if (STAFF_KITCHEN_ROLE_SET.has(normalizedRole)) {
      actions.push({
        to: "/staff/kitchen",
        title: "Khu vực bếp",
        label: "Xem món cần chuẩn bị",
        description: "Theo dõi món chờ nhận, đang làm và sẵn sàng.",
        cta: "Mở bếp",
        tone: "warning",
      });
    }


    actions.push({
      to: "/staff/payslips",
      title: "Phiếu lương của tôi",
      label: "Xem phiếu lương cá nhân",
      description: "Theo dõi thực lĩnh, số đã thanh toán và chi tiết breakdown lương của các kỳ đã công bố.",
      cta: "Xem phiếu lương",
      tone: "neutral",
    });

    return actions;
  }, [normalizedRole]);

  return (
    <div className="staff-dashboard-page" aria-labelledby="staff-dashboard-title">
      <section className="staff-dashboard-hero">
        <div className="staff-dashboard-hero__copy">
          <StaffStatusBadge tone="accent">Khu vực nhân viên</StaffStatusBadge>
          <h1 id="staff-dashboard-title">Hôm nay cần làm gì?</h1>
          <p>
            Xem ca làm, chấm công, xác nhận ca và các yêu cầu cá nhân từ một màn hình dễ thao tác trong ca.
          </p>
        </div>
        <div className="staff-identity-card" aria-label="Thông tin nhân viên">
          <span>Đang đăng nhập</span>
          <strong>{staffName || "Nhân viên"}</strong>
          <small>{roleLabel || "Chưa xác định vai trò"}</small>
          <small>{staffRestaurantLabel}</small>
        </div>
      </section>

      <section className="staff-dashboard-grid" aria-label="Tổng quan thao tác nhân viên">
        <article className="staff-shift-command-card">
          <div className="staff-shift-command-card__header">
            <StaffStatusBadge tone="muted">Ca hôm nay</StaffStatusBadge>
            <span className="staff-shift-command-card__time">Lịch</span>
          </div>
          <h2>Kiểm tra ca hôm nay</h2>
          <p>
            Mở lịch cá nhân để xem ca hiện tại, check-in/check-out và cảnh báo chấm công theo dữ liệu đã công bố.
          </p>
          <div className="staff-shift-command-card__actions">
            <Link className="staff-primary-dashboard-button" to="/staff/schedule">
              Xem lịch tuần
            </Link>
            <Link className="staff-secondary-dashboard-button" to="/staff/schedule">
              Đăng ký lịch
            </Link>
          </div>
        </article>

        <aside className="staff-task-panel" aria-label="Việc cần xử lý">
          <div className="staff-task-panel__header">
            <h2>Việc cần xử lý</h2>
            <StaffStatusBadge tone="warning">Theo ca</StaffStatusBadge>
          </div>
          <div className="staff-task-list">
            <Link to="/staff/schedule" className="staff-task-item">
              <span>Ca cần xác nhận</span>
              <strong>Kiểm tra lịch</strong>
            </Link>
            <Link to="/staff/schedule" className="staff-task-item">
              <span>Chấm công thiếu</span>
              <strong>Gửi chỉnh công nếu cần</strong>
            </Link>
            <Link to="/notifications" className="staff-task-item">
              <span>Thông báo mới</span>
              <strong>Xem nhắc việc</strong>
            </Link>
          </div>
        </aside>
      </section>

      <section className="staff-metric-row" aria-label="Trạng thái vận hành cá nhân">
        <StaffMetricTile label="Trạng thái" value="Xem lịch" hint="Theo ca đã công bố" tone="muted" />
        <StaffMetricTile label="Chấm công" value="Trong lịch" hint="Check-in / check-out" tone="success" />
        <StaffMetricTile label="Yêu cầu" value="Theo dõi" hint="Nghỉ phép / tăng ca / chỉnh công" tone="warning" />
      </section>

      <section className="staff-dashboard-section" aria-labelledby="staff-fast-actions-title">
        <div className="staff-dashboard-section__header">
          <div>
            <StaffStatusBadge tone="accent">Thao tác nhanh</StaffStatusBadge>
            <h2 id="staff-fast-actions-title">Đi thẳng tới việc cần làm</h2>
          </div>
          <p>Ưu tiên các thao tác nhân viên dùng nhiều nhất trên điện thoại hoặc tablet.</p>
        </div>

        <div className="staff-action-grid">
          <StaffActionCard
            to="/staff/schedule"
            title="Lịch cá nhân"
            description="Xem ca hôm nay, ca tuần này, xác nhận ca và chấm công."
            cta="Mở lịch"
            tone="accent"
            primary
          />
          <StaffActionCard
            to="/staff/schedule"
            title="Đăng ký lịch rảnh/bận"
            description="Chọn ca có thể làm hoặc báo ca không khả dụng."
            cta="Đăng ký"
            tone="neutral"
          />
          <StaffActionCard
            to="/staff/schedule"
            title="Nghỉ phép / tăng ca / chỉnh công"
            description="Theo dõi trạng thái chờ duyệt, đã duyệt hoặc từ chối."
            cta="Xem yêu cầu"
            tone="warning"
          />
          <StaffActionCard
            to="/profile"
            title="Hồ sơ cá nhân"
            description="Kiểm tra thông tin liên hệ và trạng thái tài khoản."
            cta="Mở hồ sơ"
            tone="neutral"
          />
          <StaffActionCard
            to="/notifications"
            title="Thông báo / nhắc việc"
            description="Xem cập nhật lịch, nhắc check-out và phản hồi từ quản lý."
            cta="Xem thông báo"
            tone="neutral"
          />
          <StaffActionCard
            to="/staff/performance"
            title="Phản hồi hiệu suất"
            description="Xem điểm hiện tại theo hướng cải thiện và gửi phản hồi khi cần."
            cta="Xem phản hồi"
            tone="success"
          />
        </div>
      </section>

      <section className="staff-dashboard-section staff-dashboard-section--work-area" aria-labelledby="staff-work-area-title">
        <div className="staff-dashboard-section__header">
          <div>
            <StaffStatusBadge tone="success">Khu vực chuyên môn</StaffStatusBadge>
            <h2 id="staff-work-area-title">Khu vực làm việc của bạn</h2>
          </div>
          <p>Chỉ hiển thị khu vực phù hợp với quyền hiện tại.</p>
        </div>

        {workAreaActions.length > 0 ? (
          <div className="staff-work-area-list">
            {workAreaActions.map((action) => (
              <StaffActionCard
                key={action.to}
                to={action.to}
                title={action.title}
                description={action.description}
                cta={action.cta}
                tone={action.tone}
              />
            ))}
          </div>
        ) : (
          <StaffEmptyState
            title="Chưa có khu vực chuyên môn riêng"
            description="Bạn vẫn có thể xem lịch, xác nhận ca, cập nhật hồ sơ và theo dõi thông báo."
            action={<Link className="staff-text-dashboard-link" to="/staff/schedule">Mở lịch cá nhân</Link>}
          />
        )}
      </section>
    </div>
  );
};

export default StaffDashboardPage;
