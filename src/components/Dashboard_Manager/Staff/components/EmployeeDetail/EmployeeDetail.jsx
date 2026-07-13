import React, { useEffect, useState } from "react";
import {
  User,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  CalendarDays,
  DollarSign,
  Clock,
  Trash2,
  Edit,
  History,
  ShieldCheck,
  Camera,
  Umbrella,
  CircleCheck,
  LogOut,
  Lock,
  Unlock,
} from "lucide-react";
import {
  getStaffActionAvailability,
  getStaffDetailStatusInfo,
} from "../../staffStatus";
import { DEPARTMENT_OPTIONS } from "../../../../../utils/staffRoleOptions";
import StaffAvatarMedia from "../StaffAvatarMedia";
import "./EmployeeDetail.scss";

const getDepartmentLabel = (department) => {
  const option = DEPARTMENT_OPTIONS.find((item) => item.value === department);
  return option?.label?.replace(/^\S+\s*/, "") || "Khác";
};

const EMPLOYMENT_STATUS_LABELS = {
  WORKING: "Đang làm việc",
  ON_LEAVE: "Đang nghỉ phép",
  RESIGNED: "Đã nghỉ việc",
  SUSPENDED: "Tạm đình chỉ",
};

const ACCOUNT_STATUS_LABELS = {
  active: "Đang hoạt động",
  inactive: "Ngừng hoạt động",
  blocked: "Đã khóa",
  pending: "Chờ xác minh",
};

const DETAIL_TABS = [
  { id: "contact", label: "Liên hệ", icon: User },
  { id: "work", label: "Công việc", icon: Briefcase },
  { id: "account", label: "Tài khoản", icon: ShieldCheck },
];

const EmployeeDetail = ({
  employee,
  onEdit,
  onEditAvatar,
  onViewHistory,
  onDelete,
  onSetOnLeave,
  onSetWorking,
  onSetResigned,
  onLockAccount,
  onUnlockAccount,
  onResendVerification,
}) => {
  const [verificationChannel, setVerificationChannel] = useState("AUTO");
  const [activeTab, setActiveTab] = useState("contact");

  useEffect(() => {
    setActiveTab("contact");
  }, [employee?.id]);

  if (!employee) {
    return (
      <div className="employee-detail-card empty">
        <div className="empty-content">
          <div className="icon-circle">
            <User size={40} />
          </div>
          <h3>Chưa chọn nhân viên</h3>
          <p>Chọn một nhân sự từ danh sách để xem thông tin chi tiết.</p>
        </div>
      </div>
    );
  }

  const statusInfo = getStaffDetailStatusInfo(employee);
  const { canSetOnLeave, canSetWorking, canSetResigned, canLock, canUnlock } =
    getStaffActionAvailability(employee);
  const resolvedBaseSalary =
    employee?.raw?.baseSalary ?? employee?.baseSalary ?? employee?.salary ?? null;

  const salaryDisplay =
    Number(resolvedBaseSalary) > 0
      ? `${Number(resolvedBaseSalary).toLocaleString("vi-VN")} đ`
      : "Chưa thiết lập";

  const employmentStatusLabel =
    EMPLOYMENT_STATUS_LABELS[employee.employmentStatus] ||
    employee.employmentStatus ||
    "Đang làm việc";
  const accountStatusLabel =
    ACCOUNT_STATUS_LABELS[String(employee.accountStatus || "").toLowerCase()] ||
    employee.accountStatus ||
    "Đang hoạt động";

  const handleTabKeyDown = (event, index) => {
    let nextIndex = index;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % DETAIL_TABS.length;
    else if (event.key === "ArrowLeft") nextIndex = (index - 1 + DETAIL_TABS.length) % DETAIL_TABS.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = DETAIL_TABS.length - 1;
    else return;

    event.preventDefault();
    const nextTab = DETAIL_TABS[nextIndex];
    setActiveTab(nextTab.id);
    event.currentTarget.parentElement
      ?.querySelector(`#employee-detail-tab-${nextTab.id}`)
      ?.focus();
  };

  return (
    <div className="employee-detail-card fade-in">
      <div className="detail-header">
        <div className="cover-image" />
        <div className="header-content">
          <div className="avatar-wrapper">
            <StaffAvatarMedia
              employee={employee}
              name={employee.name}
              className="avatar-img"
              eager
              iconSize={30}
            />
            <span
              className={`status-dot ${statusInfo.color}`}
              title={statusInfo.label}
            />
          </div>

          <div className="text-info">
            <h2 className="name">{employee.name}</h2>
            <p className="role">{employee.role}</p>
            <div className={`status-badge ${statusInfo.color}`}>
              {statusInfo.label}
            </div>
          </div>
        </div>
      </div>

      <div className="detail-body custom-scrollbar">
        <div
          className="employee-detail-tabs"
          role="tablist"
          aria-label="Nhóm thông tin nhân viên"
        >
          {DETAIL_TABS.map((tab, index) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`employee-detail-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`employee-detail-panel-${tab.id}`}
                tabIndex={isActive ? 0 : -1}
                className={isActive ? "is-active" : ""}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
              >
                <Icon size={15} aria-hidden="true" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === "contact" && (
          <section
            id="employee-detail-panel-contact"
            className="section employee-detail-panel"
            role="tabpanel"
            aria-labelledby="employee-detail-tab-contact"
          >
            <h4 className="section-title">Thông tin liên hệ</h4>
            <div className="info-list">
              <InfoRow icon={User} label="Mã NV" value={employee.code} />
              <InfoRow
                icon={Phone}
                label="Điện thoại"
                value={employee.phone}
                linkType="tel"
              />
              <InfoRow
                icon={Mail}
                label="Email"
                value={employee.email}
                linkType="mailto"
              />
              <InfoRow
                icon={User}
                label="Xác minh"
                value={employee.verificationLabel || "Chưa xác minh"}
              />
              <InfoRow icon={MapPin} label="Địa chỉ" value={employee.address} />
            </div>
          </section>
        )}

        {activeTab === "work" && (
          <section
            id="employee-detail-panel-work"
            className="section employee-detail-panel"
            role="tabpanel"
            aria-labelledby="employee-detail-tab-work"
          >
            <h4 className="section-title">Vai trò & hồ sơ lao động</h4>
            <div className="info-list">
              <InfoRow
                icon={Briefcase}
                label="Vai trò hệ thống"
                value={employee.roleName || employee.roleSlug || "Chưa gán"}
              />
              <InfoRow
                icon={Briefcase}
                label="Chức danh"
                value={employee.positionTitle || employee.role}
              />
              <InfoRow
                icon={Briefcase}
                label="Bộ phận"
                value={getDepartmentLabel(employee.department)}
              />
              <InfoRow
                icon={CalendarDays}
                label="Ngày vào làm"
                value={employee.startDate}
              />
              <InfoRow
                icon={Clock}
                label="Loại ca"
                value={employee.shift || "Ca xoay"}
              />
              <InfoRow
                icon={DollarSign}
                label="Lương cơ bản"
                value={salaryDisplay}
                isHighlight
              />
            </div>
          </section>
        )}

        {activeTab === "account" && (
          <section
            id="employee-detail-panel-account"
            className="account-status-panel employee-detail-panel"
            role="tabpanel"
            aria-labelledby="employee-detail-tab-account"
          >
            <div className="widget-header">
              <div className="title-box">
                <ShieldCheck size={18} className="icon-award" />
                <span>Trạng thái & xác minh tài khoản</span>
              </div>
              <span className={`status-chip ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
            </div>
            <div className="account-status-grid">
              <InfoRow
                icon={User}
                label="Trạng thái lao động"
                value={employmentStatusLabel}
              />
              <InfoRow
                icon={User}
                label="Trạng thái tài khoản"
                value={accountStatusLabel}
              />
              <InfoRow
                icon={Mail}
                label="Email"
                value={employee.emailVerified ? "Đã xác minh" : "Chưa xác minh"}
              />
              <InfoRow
                icon={Phone}
                label="SĐT"
                value={employee.phoneVerified ? "Đã xác minh" : "Chưa xác minh"}
              />
            </div>
            <div className="verification-action-row">
              <select
                value={verificationChannel}
                onChange={(event) => setVerificationChannel(event.target.value)}
                disabled={!employee.canResendVerification}
                aria-label="Kênh gửi xác minh"
              >
                <option value="AUTO">Tự động</option>
                <option value="EMAIL">Email</option>
                <option value="SMS">SMS</option>
              </select>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  onResendVerification?.(employee, verificationChannel)
                }
                disabled={
                  !employee.canResendVerification || !onResendVerification
                }
              >
                <Mail size={16} />
                <span>Gửi lại xác minh</span>
              </button>
            </div>
          </section>
        )}
      </div>

      <div className="detail-footer">
        <div className="main-actions">
          <button
            type="button"
            className="btn btn-primary-soft"
            onClick={onEdit}
            disabled={!onEdit}
            title="Chỉnh sửa"
          >
            <Edit size={18} />
            <span>Sửa</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onEditAvatar}
            disabled={!onEditAvatar}
            title="Cập nhật ảnh đại diện"
          >
            <Camera size={18} />
            <span>Ảnh</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onViewHistory}
            disabled={!onViewHistory}
            title="Lịch sử"
            aria-label="Xem lịch sử nhân viên"
          >
            <History size={18} />
          </button>
        </div>

        <div className="main-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onSetOnLeave?.(employee.id)}
            disabled={!canSetOnLeave || !onSetOnLeave}
            title="Chuyển sang tạm nghỉ"
            aria-label="Chuyển nhân viên sang tạm nghỉ"
          >
            <Umbrella size={17} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onSetWorking?.(employee.id)}
            disabled={!canSetWorking || !onSetWorking}
            title="Chuyển sang đang làm việc"
            aria-label="Chuyển nhân viên sang đang làm việc"
          >
            <CircleCheck size={17} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onSetResigned?.(employee.id)}
            disabled={!canSetResigned || !onSetResigned}
            title="Chuyển sang nghỉ việc"
            aria-label="Chuyển nhân viên sang nghỉ việc"
          >
            <LogOut size={17} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onLockAccount?.(employee.id)}
            disabled={!canLock || !onLockAccount}
            title="Khóa tài khoản"
            aria-label="Khóa tài khoản nhân viên"
          >
            <Lock size={17} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onUnlockAccount?.(employee.id)}
            disabled={!canUnlock || !onUnlockAccount}
            title="Mở khóa tài khoản"
            aria-label="Mở khóa tài khoản nhân viên"
          >
            <Unlock size={17} aria-hidden="true" />
          </button>
        </div>

        <div className="danger-actions">
          <button
            type="button"
            className="btn btn-danger-ghost"
            onClick={() => onDelete?.(employee.id)}
            disabled={!onDelete}
            title="Ngừng hiển thị nhân viên"
            aria-label={`Ngừng hiển thị ${employee.name}`}
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

const InfoRow = ({ icon, label, value, linkType, isHighlight }) => {
  const IconComponent = icon;
  const displayValue = value || "---";
  const href = value && linkType ? `${linkType}:${value}` : "";

  return (
    <div className="info-row">
      <div className="icon-box">
        <IconComponent size={16} />
      </div>
      <div className="info-content">
        <span className="info-label">{label}</span>
        {href ? (
          <a href={href} className="info-value link">
            {displayValue}
          </a>
        ) : (
          <span className={`info-value ${isHighlight ? "highlight" : ""}`}>
            {displayValue}
          </span>
        )}
      </div>
    </div>
  );
};

export default EmployeeDetail;
