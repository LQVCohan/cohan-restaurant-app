import React, { useState, useContext, useMemo } from "react";
import { gql, useQuery } from "@apollo/client";
import {
  ChefHat,
  Banknote,
  ChevronRight,
  LogOut,
  User,
  History,
  Bell,
  Moon,
  HelpCircle,
  Shield,
  Edit3,
  Clock,
  TrendingUp,
  ShoppingBag,
  ArrowLeft,
} from "lucide-react";
import "./StaffProfile.scss";
import { AuthContext } from "../../../context/AuthContext";

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
      employmentStatus
      primaryRestaurant {
        id
        name
      }
      floorAssigned
      tableCount
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
      timesheetCount
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

const fmtMoney = (v) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(v || 0));

const fmtDateTime = (v) =>
  v ? new Date(v).toLocaleString("vi-VN") : "—";

export default function StaffProfile() {
  const { user, logout } = useContext(AuthContext) || {};
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [view, setView] = useState("home");

  const { data: overviewData } = useQuery(STAFF_ACCOUNT_OVERVIEW, {
    variables: { staffId: user?.id || null },
    skip: !user?.id,
    fetchPolicy: "network-only",
  });

  const { data: salaryData } = useQuery(STAFF_SALARY_SUMMARY, {
    variables: { staffId: user?.id || null },
    skip: !user?.id,
    fetchPolicy: "network-only",
  });

  const { data: shiftData } = useQuery(STAFF_SHIFT_HISTORY, {
    variables: { staffId: user?.id || null, limit: 30 },
    skip: !user?.id,
    fetchPolicy: "network-only",
  });

  const overview = overviewData?.staffAccountOverview || null;
  const salary = salaryData?.staffSalarySummary || null;
  const shifts = shiftData?.staffShiftHistory || [];

  const displayName =
    overview?.fullName || user?.fullName || user?.username || "Nhân viên";
  const roleLabel =
    overview?.positionTitle || overview?.roleName || user?.roleName || "Nhân viên Order";
  const contactPhone = overview?.phone || user?.phone || "—";
  const contactEmail = overview?.email || user?.email || "—";
  const employeeCode = overview?.employeeCode || user?.employeeCode || "—";
  const restaurantName =
    overview?.primaryRestaurant?.name || user?.primaryRestaurant?.name || "—";

  const shiftSummaryLabel = useMemo(() => {
    if (overview?.currentShift) return String(overview.currentShift).toUpperCase();
    if (overview?.lastShift) return String(overview.lastShift).toUpperCase();
    return "Chưa có ca";
  }, [overview?.currentShift, overview?.lastShift]);

  const profileClass = `staff-pos-profile ${darkMode ? "theme-dark" : "theme-light"}`;

  const renderHeader = () => (
    <>
      <div className="profile-header-card">
        <button className="btn-edit-profile" aria-label="Chỉnh sửa hồ sơ">
          <Edit3 size={18} />
        </button>

        <div className="avatar-wrapper">
          <div className="avatar">
            {overview?.avatarUrl ? (
              <img src={overview.avatarUrl} alt={displayName} />
            ) : (
              <ChefHat size={40} className="text-primary" />
            )}
          </div>
          <span className="status-badge online">Đang ca làm</span>
        </div>

        <div className="user-info">
          <h2>{displayName}</h2>
          <div className="role-tags">
            <span className="tag-role">
              <Shield size={12} /> {roleLabel}
            </span>
            <span className="tag-shift">{shiftSummaryLabel}</span>
          </div>
          <p className="contact-info">{contactPhone} • {contactEmail}</p>
        </div>
      </div>

      <div className="shift-stats-grid">
        <div className="stat-card">
          <div className="icon-wrap bg-blue">
            <ShoppingBag size={20} />
          </div>
          <div className="stat-info">
            <span className="val">{overview?.ordersServedCount ?? 0}</span>
            <span className="label">Đơn đã phục vụ</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="icon-wrap bg-orange">
            <TrendingUp size={20} />
          </div>
          <div className="stat-info">
            <span className="val">{overview?.tableCount ?? 0}</span>
            <span className="label">Bàn phụ trách</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="icon-wrap bg-green">
            <Clock size={20} />
          </div>
          <div className="stat-info">
            <span className="val">{overview?.shiftsWorkedCount ?? 0}</span>
            <span className="label">Ca đã làm</span>
          </div>
        </div>
      </div>
    </>
  );

  const renderBackHeader = (title) => (
    <div className="detail-header">
      <button className="menu-item back-item" onClick={() => setView("home")}>
        <div className="item-left">
          <div className="menu-icon text-blue">
            <ArrowLeft size={20} />
          </div>
          <span>{title}</span>
        </div>
      </button>
    </div>
  );

  const renderPersonalPage = () => (
    <div className="detail-page">
      {renderBackHeader("Thông tin cá nhân")}
      <div className="menu-group">
        <div className="menu-list">
          {[
            ["Họ tên", displayName],
            ["Mã nhân viên", employeeCode],
            ["Email", contactEmail],
            ["Số điện thoại", contactPhone],
            ["Vai trò", roleLabel],
            ["Nhà hàng phụ trách", restaurantName],
            ["Tầng phụ trách", (overview?.floorAssigned || []).join(", ") || "—"],
            ["Số bàn phụ trách", String(overview?.tableCount ?? 0)],
            ["Số đơn đã phục vụ", String(overview?.ordersServedCount ?? 0)],
            ["Trạng thái làm việc", overview?.employmentStatus || "—"],
          ].map(([k, v]) => (
            <div className="menu-item key-value" key={k}>
              <div className="item-left">
                <span>{k}</span>
              </div>
              <span className="value-text">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderSalaryPage = () => (
    <div className="detail-page">
      {renderBackHeader("Lương & Thưởng")}
      <div className="menu-group">
        <div className="menu-list">
          {[
            ["Lương cơ bản", fmtMoney(salary?.baseSalary)],
            ["Tổng giờ công", `${Number(salary?.totalHours || 0).toFixed(1)} giờ`],
            ["Tổng lương giờ", fmtMoney(salary?.totalWage)],
            ["Tổng thu nhập theo timesheet", fmtMoney(salary?.totalAmount)],
            ["Số bảng công", String(salary?.timesheetCount ?? 0)],
          ].map(([k, v]) => (
            <div className="menu-item key-value" key={k}>
              <div className="item-left">
                <span>{k}</span>
              </div>
              <span className="value-text">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderShiftHistoryPage = () => (
    <div className="detail-page">
      {renderBackHeader("Lịch sử ca làm việc")}
      <div className="menu-group">
        <div className="menu-list">
          {(shifts || []).length === 0 ? (
            <div className="menu-item key-value">
              <div className="item-left">
                <span>Chưa có dữ liệu ca làm việc</span>
              </div>
            </div>
          ) : (
            shifts.map((s) => (
              <div className="menu-item shift-row" key={s.id}>
                <div className="item-left shift-left">
                  <span className="shift-title">
                    {String(s.shiftType || "ca").toUpperCase()} • {s.restaurant?.name || "—"}
                  </span>
                  <span className="shift-sub">{fmtDateTime(s.startTime)} → {fmtDateTime(s.endTime)}</span>
                  {s.notes ? <span className="shift-sub">{s.notes}</span> : null}
                </div>
                <span className="value-text">{String(s.status || "").toUpperCase()}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className={profileClass}>
      {view === "home" ? (
        <>
          {renderHeader()}

          <div className="settings-container">
            <div className="menu-group">
              <h4 className="group-title">Công việc & Tài khoản</h4>
              <div className="menu-list">
                <button className="menu-item" onClick={() => setView("profile")}>
                  <div className="item-left">
                    <div className="menu-icon text-blue">
                      <User size={20} />
                    </div>
                    <span>Thông tin cá nhân</span>
                  </div>
                  <ChevronRight size={18} className="icon-right" />
                </button>
                <button className="menu-item" onClick={() => setView("salary")}>
                  <div className="item-left">
                    <div className="menu-icon text-green">
                      <Banknote size={20} />
                    </div>
                    <span>Lương & Thưởng</span>
                  </div>
                  <ChevronRight size={18} className="icon-right" />
                </button>
                <button className="menu-item" onClick={() => setView("shifts")}>
                  <div className="item-left">
                    <div className="menu-icon text-orange">
                      <History size={20} />
                    </div>
                    <span>Lịch sử ca làm việc</span>
                  </div>
                  <ChevronRight size={18} className="icon-right" />
                </button>
              </div>
            </div>

            <div className="menu-group">
              <h4 className="group-title">Cài đặt ứng dụng</h4>
              <div className="menu-list">
                <div className="menu-item">
                  <div className="item-left">
                    <div className="menu-icon text-purple">
                      <Bell size={20} />
                    </div>
                    <span>Nhận thông báo</span>
                  </div>
                  <div
                    className={`toggle-switch ${notifications ? "on" : "off"}`}
                    onClick={() => setNotifications(!notifications)}
                  >
                    <div className="toggle-knob"></div>
                  </div>
                </div>
                <div className="menu-item">
                  <div className="item-left">
                    <div className="menu-icon text-gray">
                      <Moon size={20} />
                    </div>
                    <span>Giao diện tối (Dark mode)</span>
                  </div>
                  <div
                    className={`toggle-switch ${darkMode ? "on" : "off"}`}
                    onClick={() => setDarkMode(!darkMode)}
                  >
                    <div className="toggle-knob"></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="menu-group">
              <h4 className="group-title">Khác</h4>
              <div className="menu-list">
                <button className="menu-item">
                  <div className="item-left">
                    <div className="menu-icon text-teal">
                      <HelpCircle size={20} />
                    </div>
                    <span>Trung tâm hỗ trợ</span>
                  </div>
                  <ChevronRight size={18} className="icon-right" />
                </button>
                <button className="menu-item text-danger" onClick={logout}>
                  <div className="item-left">
                    <div className="menu-icon bg-danger-light">
                      <LogOut size={20} />
                    </div>
                    <span>Đăng xuất</span>
                  </div>
                </button>
              </div>
            </div>
          </div>

          <div className="app-version">POS System App v2.4.1</div>
        </>
      ) : null}

      {view === "profile" ? renderPersonalPage() : null}
      {view === "salary" ? renderSalaryPage() : null}
      {view === "shifts" ? renderShiftHistoryPage() : null}
    </div>
  );
}
