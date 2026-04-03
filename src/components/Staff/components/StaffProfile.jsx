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
} from "lucide-react";

import "./StaffProfile.scss";
import { AuthContext } from "../../../context/AuthContext";

// Import 3 components con
import StaffPersonalInfo from "./StaffPersonalInfo";
import StaffSalarySummary from "./StaffSalarySummary";
import StaffShiftHistory from "./StaffShiftHistory";

// --- GRAPHQL QUERIES ---
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
      insuranceSocial
      insuranceHealth
      insuranceUnemployment
      insuranceTotal
      overtimeNormal
      overtimeWeekend
      overtimeHoliday
      nightShiftExtra
      insuranceEligible
      policyCode
      policyEffectiveFrom
      warningMessages
      coefficient
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

export default function StaffProfile() {
  const { user, logout } = useContext(AuthContext) || {};

  // States quản lý cài đặt
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  // State quản lý luồng màn hình (Navigation)
  // Các giá trị: "home", "profile", "salary", "shifts"
  const [view, setView] = useState("home");

  // --- FETCH DATA ---
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

  // --- XỬ LÝ HIỂN THỊ THÔNG TIN CHUNG ---
  const displayName =
    overview?.fullName || user?.fullName || user?.username || "Nhân viên";
  const roleLabel =
    overview?.positionTitle ||
    overview?.roleName ||
    user?.roleName ||
    "Nhân viên Order";
  const contactPhone = overview?.phone || user?.phone || "—";
  const contactEmail = overview?.email || user?.email || "—";

  const shiftSummaryLabel = useMemo(() => {
    if (overview?.currentShift)
      return String(overview.currentShift).toUpperCase();
    if (overview?.lastShift) return String(overview.lastShift).toUpperCase();
    return "Chưa có ca";
  }, [overview?.currentShift, overview?.lastShift]);

  const profileClass = `staff-pos-profile ${darkMode ? "theme-dark" : "theme-light"}`;

  // Hàm quay lại trang chủ profile
  const handleBack = () => setView("home");

  return (
    <div className={profileClass}>
      {/* --- MÀN HÌNH CHÍNH (HOME) --- */}
      {view === "home" && (
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
              <p className="contact-info">
                {contactPhone} • {contactEmail}
              </p>
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

          <div className="settings-container">
            {/* Group 1: Công việc & Tài khoản */}
            <div className="menu-group">
              <h4 className="group-title">Công việc & Tài khoản</h4>
              <div className="menu-list">
                <button
                  className="menu-item"
                  onClick={() => setView("profile")}
                >
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

            {/* Group 2: Cài đặt ứng dụng */}
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

            {/* Group 3: Khác */}
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
      )}

      {/* --- CÁC MÀN HÌNH CON ĐƯỢC RENDER NẾU VIEW THAY ĐỔI --- */}
      {view === "profile" && (
        <StaffPersonalInfo data={overview} user={user} onBack={handleBack} />
      )}

      {view === "salary" && (
        <StaffSalarySummary data={salary} onBack={handleBack} />
      )}

      {view === "shifts" && (
        <StaffShiftHistory shifts={shifts} onBack={handleBack} />
      )}
    </div>
  );
}
