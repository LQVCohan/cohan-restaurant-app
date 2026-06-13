import React, { useContext, useMemo, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import { Link } from "react-router-dom";
import {
  Banknote,
  Bell,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  IdCard,
  Mail,
  Phone,
  ShieldCheck,
  Store,
  UserRound,
} from "lucide-react";
import { AuthContext } from "@/context/AuthContext";
import {
  hasStaffKitchenAccess,
  hasStaffOrderAccess,
  resolveUserRoleName,
} from "@/utils/frontendRoleAccess";
import {
  DEPARTMENT_OPTIONS,
  getStaffRoleDisplayLabel,
  getStaffRoleOption,
} from "@/utils/staffRoleOptions";
import "./StaffProfilePage.scss";

const STAFF_ACCOUNT_OVERVIEW = gql`
  query StaffAccountOverview($staffId: ID) {
    staffAccountOverview(staffId: $staffId) {
      staffId
      fullName
      email
      phone
      avatarUrl
      roleName
      positionTitle
      employeeCode
      employmentType
      employmentStatus
      floorAssigned
      floorCount
      tableCount
      categoryCount
      promotionCount
      tableList
      ordersServedCount
      shiftsWorkedCount
      currentShift
      lastShift
    }
  }
`;

const STAFF_SALARY_SUMMARY = gql`
  query StaffSalarySummary($staffId: ID) {
    staffSalarySummary(staffId: $staffId) {
      staffId
      baseSalary
      totalHours
      totalWage
      totalAmount
      bonusAmount
      grossIncome
      totalDeduction
      netSalary
      timesheetCount
      warningMessages
    }
  }
`;

const STAFF_SHIFT_HISTORY = gql`
  query StaffShiftHistory($staffId: ID, $limit: Int) {
    staffShiftHistory(staffId: $staffId, limit: $limit) {
      id
      shiftType
      startTime
      endTime
      status
      notes
      restaurant {
        id
        name
      }
    }
  }
`;

const EMPLOYMENT_TYPE_LABELS = {
  full_time: "Toàn thời gian",
  part_time: "Bán thời gian",
  seasonal: "Thời vụ",
  contract: "Hợp đồng",
  probation: "Thử việc",
};

const departmentLabels = DEPARTMENT_OPTIONS.reduce((acc, item) => {
  acc[item.value] = item.label.replace(/^\S+\s*/, "");
  return acc;
}, {});

const fmtMoney = (value) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const fmtDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
};

const resolveId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.id || value._id || "";
};

const getRestaurantLabel = (user, restaurants) => {
  const source = user?.restaurantForStaff || restaurants?.[0];
  if (!source) return "Chưa gán cơ sở";
  if (typeof source === "string") return source;
  return source.name || source.restaurantName || source.code || resolveId(source) || "Chưa gán cơ sở";
};

const getInitials = (name) => {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "NV";
  return parts.slice(-2).map((part) => part.charAt(0).toUpperCase()).join("");
};

const InfoRow = ({ icon: Icon, label, value, muted = false }) => (
  <div className="staff-profile__info-row">
    <span className="staff-profile__info-icon" aria-hidden="true"><Icon size={17} /></span>
    <span>{label}</span>
    <strong className={muted ? "is-muted" : ""}>{value || "—"}</strong>
  </div>
);

const AccessPill = ({ enabled, children }) => (
  <span className={`staff-profile__access-pill ${enabled ? "is-enabled" : "is-disabled"}`}>
    {enabled ? <CheckCircle2 size={14} /> : <ShieldCheck size={14} />}
    {children}
  </span>
);

const StaffProfilePage = () => {
  const { user, restaurants } = useContext(AuthContext) || {};
  const [requestOpen, setRequestOpen] = useState(false);
  const normalizedRole = useMemo(() => resolveUserRoleName(user), [user]);
  const roleOption = getStaffRoleOption(normalizedRole);
  const canOrder = hasStaffOrderAccess(normalizedRole);
  const canKitchen = hasStaffKitchenAccess(normalizedRole);
  const canManage = ["admin", "manager", "hr"].includes(normalizedRole);

  const { data: overviewData, loading: overviewLoading, error: overviewError } = useQuery(STAFF_ACCOUNT_OVERVIEW, {
    variables: { staffId: user?.id || null },
    skip: !user?.id,
    fetchPolicy: "network-only",
  });
  const { data: salaryData, loading: salaryLoading } = useQuery(STAFF_SALARY_SUMMARY, {
    variables: { staffId: user?.id || null },
    skip: !user?.id,
    fetchPolicy: "network-only",
  });
  const { data: shiftData, loading: shiftsLoading } = useQuery(STAFF_SHIFT_HISTORY, {
    variables: { staffId: user?.id || null, limit: 5 },
    skip: !user?.id,
    fetchPolicy: "network-only",
  });

  const overview = overviewData?.staffAccountOverview || {};
  const salary = salaryData?.staffSalarySummary || null;
  const shifts = shiftData?.staffShiftHistory || [];
  const displayName = overview.fullName || user?.fullName || user?.name || user?.username || "Nhân viên";
  const roleLabel = overview.positionTitle || getStaffRoleDisplayLabel(overview.roleName || user?.roleName || normalizedRole) || "Nhân viên";
  const departmentLabel = roleOption?.department ? departmentLabels[roleOption.department] : "Vận hành";
  const employmentType = overview.employmentType || user?.employmentType || "";
  const employmentLabel = EMPLOYMENT_TYPE_LABELS[String(employmentType).toLowerCase()] || employmentType || "Chưa cập nhật";
  const restaurantLabel = getRestaurantLabel(user, restaurants);
  const initials = getInitials(displayName);

  return (
    <div className="staff-profile staff-page" aria-labelledby="staff-profile-title">
      <section className="staff-profile__hero">
        <div className="staff-profile__avatar" aria-hidden="true">
          {overview.avatarUrl ? <img src={overview.avatarUrl} alt="" /> : initials}
        </div>
        <div className="staff-profile__hero-copy">
          <span className="staff-profile__eyebrow">Hồ sơ nhân viên nhà hàng</span>
          <h1 id="staff-profile-title">{displayName}</h1>
          <p>{roleLabel} • {departmentLabel} • {restaurantLabel}</p>
          <div className="staff-profile__hero-badges">
            <span>{employmentLabel}</span>
            <span>{overview.employmentStatus || "Đang làm việc"}</span>
            <span>Tài khoản hoạt động</span>
          </div>
        </div>
        <Link className="staff-profile__hero-action" to="/staff/schedule">Xem lịch cá nhân</Link>
      </section>

      {overviewError ? (
        <div className="staff-profile__alert" role="alert">
          Không tải được một phần hồ sơ. Đang hiển thị dữ liệu tài khoản hiện có.
        </div>
      ) : null}

      <div className="staff-profile__layout">
        <div className="staff-profile__column">
          <section className="staff-profile__card" aria-labelledby="staff-contact-title">
            <div className="staff-profile__card-header">
              <div>
                <span>Thông tin tài khoản</span>
                <h2 id="staff-contact-title">Thông tin liên hệ</h2>
              </div>
              <button type="button" className="staff-profile__ghost-button" onClick={() => setRequestOpen((value) => !value)}>
                Yêu cầu cập nhật
              </button>
            </div>
            {overviewLoading ? <div className="staff-profile__skeleton" aria-live="polite">Đang tải hồ sơ...</div> : null}
            <InfoRow icon={Mail} label="Email" value={overview.email || user?.email || "Chưa cập nhật"} />
            <InfoRow icon={Phone} label="Phone" value={overview.phone || user?.phone || "Chưa cập nhật"} />
            <InfoRow icon={IdCard} label="Employee code" value={overview.employeeCode || user?.employeeCode || user?.id} />
            <InfoRow icon={UserRound} label="Username" value={user?.username || "—"} muted />
            <InfoRow icon={ShieldCheck} label="Role slug/name" value={overview.roleName || user?.roleName || normalizedRole} />
            <InfoRow icon={Building2} label="Position title" value={overview.positionTitle || roleLabel} />
            <InfoRow icon={Store} label="Cơ sở làm việc" value={restaurantLabel} />
            {requestOpen ? (
              <div className="staff-profile__request-panel">
                <strong>Thông tin hồ sơ đang ở chế độ đọc</strong>
                <p>Liên hệ quản lý hoặc HR để cập nhật thông tin này. Màn hình hiện không ghi dữ liệu lên server.</p>
              </div>
            ) : null}
          </section>

          <section className="staff-profile__card" aria-labelledby="staff-access-title">
            <div className="staff-profile__card-header">
              <div>
                <span>Quyền truy cập</span>
                <h2 id="staff-access-title">Workspace được mở</h2>
              </div>
            </div>
            <div className="staff-profile__access-list">
              <AccessPill enabled={canOrder}>Order nội bộ {canOrder ? "được mở" : "không khả dụng"}</AccessPill>
              <AccessPill enabled={canKitchen}>Khu vực bếp {canKitchen ? "được mở" : "không khả dụng"}</AccessPill>
              <AccessPill enabled={canManage}>Dashboard quản lý {canManage ? "được mở" : "không khả dụng"}</AccessPill>
            </div>
          </section>
        </div>

        <div className="staff-profile__column">
          <section className="staff-profile__card" aria-labelledby="staff-work-title">
            <div className="staff-profile__card-header">
              <div>
                <span>Tóm tắt công việc</span>
                <h2 id="staff-work-title">Tóm tắt công việc</h2>
              </div>
            </div>
            <div className="staff-profile__summary-grid">
              <article><span>Current shift</span><strong>{overview.currentShift || "Chưa có ca"}</strong></article>
              <article><span>Last shift</span><strong>{overview.lastShift || "—"}</strong></article>
              <article><span>Orders served</span><strong>{overview.ordersServedCount ?? 0}</strong></article>
              <article><span>Shifts worked</span><strong>{overview.shiftsWorkedCount ?? 0}</strong></article>
              <article><span>Bàn / tầng</span><strong>{overview.tableCount ?? 0} / {overview.floorCount ?? 0}</strong></article>
              <article><span>Danh mục / KM</span><strong>{overview.categoryCount ?? 0} / {overview.promotionCount ?? 0}</strong></article>
            </div>
          </section>

          <section className="staff-profile__card" aria-labelledby="staff-salary-title">
            <div className="staff-profile__card-header">
              <div>
                <span>Lương & thưởng</span>
                <h2 id="staff-salary-title">Preview thu nhập</h2>
              </div>
              <Link className="staff-profile__text-link" to="/staff/payslips">Xem phiếu lương</Link>
            </div>
            {salaryLoading ? <div className="staff-profile__skeleton" aria-live="polite">Đang tải lương...</div> : (
              <div className="staff-profile__salary-preview">
                <Banknote size={22} />
                <div><span>Thực lĩnh tạm tính</span><strong>{fmtMoney(salary?.netSalary)}</strong></div>
                <small>{salary?.timesheetCount ?? 0} bảng công • thưởng {fmtMoney(salary?.bonusAmount)}</small>
              </div>
            )}
          </section>

          <section className="staff-profile__card" aria-labelledby="staff-shifts-title">
            <div className="staff-profile__card-header">
              <div>
                <span>Lịch sử ca làm</span>
                <h2 id="staff-shifts-title">Ca gần đây</h2>
              </div>
              <Link className="staff-profile__text-link" to="/staff/schedule">Xem lịch cá nhân</Link>
            </div>
            {shiftsLoading ? <div className="staff-profile__skeleton" aria-live="polite">Đang tải ca...</div> : null}
            <div className="staff-profile__shift-list">
              {shifts.length ? shifts.slice(0, 4).map((shift) => (
                <article key={shift.id} className="staff-profile__shift-item">
                  <CalendarClock size={17} />
                  <div><strong>{shift.shiftType || "Ca làm"}</strong><span>{fmtDateTime(shift.startTime)} - {fmtDateTime(shift.endTime)}</span></div>
                  <em>{shift.status || "—"}</em>
                </article>
              )) : <p className="staff-profile__empty">Chưa có dữ liệu ca làm gần đây.</p>}
            </div>
          </section>

          <nav className="staff-profile__quick-actions" aria-label="Lối tắt hồ sơ">
            <Link to="/staff/notifications"><Bell size={17} /> Thông báo</Link>
            <Link to="/staff/performance"><ClipboardList size={17} /> Hiệu suất</Link>
            <Link to="/staff/payslips"><Banknote size={17} /> Phiếu lương</Link>
          </nav>
        </div>
      </div>
    </div>
  );
};

export default StaffProfilePage;
