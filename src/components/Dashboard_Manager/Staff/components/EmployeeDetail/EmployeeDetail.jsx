import React from "react";
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
  Calculator,
  Award,
} from "lucide-react";
import "./EmployeeDetail.scss";

const EmployeeDetail = ({
  employee,
  onEdit,
  onViewHistory,
  onCalculateSalary,
  onDelete,
  onSetOnLeave,
  onSetWorking,
  onLockAccount,
  onUnlockAccount,
  onRate,
}) => {
  // --- EMPTY STATE ---
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

  // --- HELPERS ---
  const getAvatarColor = (name) => {
    const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
    return colors[(name?.length || 0) % colors.length];
  };

  const getStatusInfo = (status) => {
    const map = {
      active: { label: "Đang làm việc", color: "success" },
      break: { label: "Nghỉ phép", color: "warning" },
      inactive: { label: "Đã nghỉ/Khoá", color: "danger" },
    };
    return map[status] || map.active;
  };

  const statusInfo = getStatusInfo(employee.status);

  const canSetOnLeave = employee.status === "active";
  const canSetWorking = employee.status === "break";
  const canLock = employee.status !== "inactive";
  const canUnlock = employee.status === "inactive";

  return (
    <div className="employee-detail-card fade-in">
      {/* 1. PROFILE HEADER */}
      <div className="detail-header">
        <div className="cover-image"></div>
        <div className="header-content">
          <div className="avatar-wrapper">
            {employee.avatar ? (
              <img
                src={employee.avatar}
                alt={employee.name}
                className="avatar-img"
              />
            ) : (
              <div
                className="avatar-placeholder"
                style={{ backgroundColor: getAvatarColor(employee.name) }}
              >
                {employee.name.charAt(0).toUpperCase()}
              </div>
            )}
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

      {/* 2. SCROLLABLE CONTENT */}
      <div className="detail-body custom-scrollbar">
        {/* Contact Section */}
        <div className="section">
          <h4 className="section-title">Thông tin liên hệ</h4>
          <div className="info-list">
            <InfoRow icon={User} label="Mã NV" value={employee.code} />
            <InfoRow icon={Phone} label="Điện thoại" value={employee.phone} />
            <InfoRow icon={Mail} label="Email" value={employee.email} isLink />
            <InfoRow icon={MapPin} label="Địa chỉ" value={employee.address} />
          </div>
        </div>

        <div className="divider" />

        {/* Job Section */}
        <div className="section">
          <h4 className="section-title">Công việc & Lương</h4>
          <div className="info-list">
            <InfoRow
              icon={Briefcase}
              label="Bộ phận"
              value={
                employee.department === "kitchen"
                  ? "Bếp"
                  : employee.department === "service"
                    ? "Phục vụ"
                    : "Khác"
              }
            />
            <InfoRow
              icon={CalendarDays}
              label="Ngày vào làm"
              value={employee.startDate}
            />
            <InfoRow
              icon={Clock}
              label="Ca làm việc"
              value={employee.shift || "Full-time"}
            />
            <InfoRow
              icon={DollarSign}
              label="Lương cơ bản"
              value={
                employee.salary
                  ? `${employee.salary.toLocaleString()} đ`
                  : "---"
              }
              isHighlight
            />
          </div>
        </div>

        {/* Performance Widget */}
        <div className="performance-widget">
          <div className="widget-header">
            <div className="title-box">
              <Award size={18} className="icon-award" />
              <span>Hiệu suất tháng</span>
            </div>
            <span className="score">98/100</span>
          </div>
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{ width: "98%" }}></div>
          </div>
          <p className="widget-note">Hoàn thành xuất sắc nhiệm vụ được giao.</p>
        </div>
      </div>

      {/* 3. FIXED FOOTER ACTIONS */}
      <div className="detail-footer">
        <div className="main-actions">
          <button
            className="btn btn-primary-soft"
            onClick={onEdit}
            title="Chỉnh sửa"
          >
            <Edit size={18} />
            <span>Sửa</span>
          </button>
          <button
            className="btn btn-secondary"
            onClick={onViewHistory}
            title="Lịch sử"
          >
            <History size={18} />
          </button>
          <button
            className="btn btn-secondary"
            onClick={onCalculateSalary}
            title="Tính lương"
          >
            <Calculator size={18} />
          </button>
        </div>

        <div className="main-actions">
          <button
            className="btn btn-secondary"
            onClick={() => onRate?.(employee.id, 5)}
            title="Đánh giá 5 sao"
          >
            <Award size={18} />
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => onSetOnLeave?.(employee.id)}
            disabled={!canSetOnLeave}
            title="Chuyển sang nghỉ phép"
          >
            <span>🏖️</span>
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => onSetWorking?.(employee.id)}
            disabled={!canSetWorking}
            title="Chuyển sang đang làm việc"
          >
            <span>✅</span>
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => onLockAccount?.(employee.id)}
            disabled={!canLock}
            title="Khoá tài khoản"
          >
            <span>🔒</span>
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => onUnlockAccount?.(employee.id)}
            disabled={!canUnlock}
            title="Mở khoá tài khoản"
          >
            <span>🔓</span>
          </button>
        </div>

        <div className="danger-actions">
          <button
            className="btn btn-danger-ghost"
            onClick={() => onDelete(employee.id)}
            title="Xóa nhân viên"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

// Reusable Info Row Component
const InfoRow = ({ icon, label, value, isLink, isHighlight }) => {
  const IconComponent = icon;

  return (
    <div className="info-row">
      <div className="icon-box">
        <IconComponent size={16} />
      </div>
      <div className="info-content">
        <span className="info-label">{label}</span>
        {isLink ? (
          <a href={`mailto:${value}`} className="info-value link">
            {value || "---"}
          </a>
        ) : (
          <span className={`info-value ${isHighlight ? "highlight" : ""}`}>
            {value || "---"}
          </span>
        )}
      </div>
    </div>
  );
};

export default EmployeeDetail;
