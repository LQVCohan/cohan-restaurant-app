import React from "react";
import "./EmployeeDetail.scss";

const EmployeeDetail = ({
  employee,
  onEdit,
  onViewHistory,
  onCalculateSalary,
  onDelete,
}) => {
  // EMPTY STATE (Giữ nguyên)
  if (!employee) {
    return (
      <div className="employee-detail-card empty">
        <div className="empty-content">
          <div className="empty-icon">👋</div>
          <h3>Chưa chọn nhân viên</h3>
          <p>
            Vui lòng chọn một nhân sự từ danh sách bên trái để xem hồ sơ chi
            tiết.
          </p>
        </div>
      </div>
    );
  }

  // Helpers (Giữ nguyên)
  const getAvatarColor = (name) => {
    const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
    return colors[name?.length % colors.length] || "#3b82f6";
  };

  const getStatusBadge = (status) => {
    const config = {
      active: { label: "Đang làm việc", class: "success" },
      break: { label: "Nghỉ giải lao", class: "warning" },
      inactive: { label: "Vắng mặt", class: "danger" },
    };
    const curr = config[status] || config.active;
    return <span className={`status-badge ${curr.class}`}>{curr.label}</span>;
  };

  return (
    <div className="employee-detail-card">
      {/* 1. HEADER MỚI (Căn trái, gọn hơn) */}
      <div className="profile-header">
        <div className="cover-bg"></div>
        <div className="profile-wrapper">
          <div
            className="avatar-xl"
            style={{
              backgroundImage: employee.avatar
                ? `url(${employee.avatar})`
                : "none",
              backgroundColor: !employee.avatar
                ? getAvatarColor(employee.name)
                : "transparent",
            }}
          >
            {!employee.avatar && employee.name.charAt(0).toUpperCase()}
          </div>
          <div className="profile-info">
            <h2 className="name">{employee.name}</h2>
            <div className="meta">
              <span className="role-tag">💼 {employee.role}</span>
              {getStatusBadge(employee.status)}
            </div>
          </div>
        </div>
      </div>

      {/* 2. BODY (Scrollable) - Giữ nguyên */}
      <div className="detail-body">
        <div className="info-group">
          <h4 className="group-title">Thông tin cá nhân</h4>
          <div className="info-grid">
            <InfoItem icon="🆔" label="Mã NV" value={employee.code || "---"} />
            <InfoItem icon="📞" label="Điện thoại" value={employee.phone} />
            <InfoItem icon="📧" label="Email" value={employee.email} isLink />
            <InfoItem
              icon="🏠"
              label="Địa chỉ"
              value={employee.address}
              fullWidth
            />
          </div>
        </div>
        <div className="divider"></div>
        <div className="info-group">
          <h4 className="group-title">Công việc & Lương</h4>
          <div className="info-grid">
            <InfoItem
              icon="🏢"
              label="Bộ phận"
              value={
                employee.department === "kitchen"
                  ? "Bếp"
                  : employee.department === "service"
                  ? "Phục vụ"
                  : "Khác"
              }
            />
            <InfoItem icon="📅" label="Ngày vào" value={employee.startDate} />
            <InfoItem
              icon="💰"
              label="Lương cơ bản"
              value={
                employee.salary
                  ? `${employee.salary.toLocaleString()} đ`
                  : "---"
              }
              highlight
            />
            <InfoItem
              icon="⏰"
              label="Ca làm việc"
              value={employee.shift || "Full-time"}
            />
          </div>
        </div>
        <div className="performance-card">
          <div className="perf-row">
            <span className="label">Hiệu suất tháng</span>
            <span className="score">98/100</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: "98%" }}></div>
          </div>
        </div>
      </div>

      {/* 3. FOOTER (Fixed) - Giữ nguyên */}
      <div className="detail-footer">
        <div className="action-row">
          <button className="btn btn-primary" onClick={onEdit}>
            ✏️ Sửa
          </button>
          <button className="btn btn-secondary" onClick={onViewHistory}>
            📜 Lịch sử
          </button>
          <button className="btn btn-secondary" onClick={onCalculateSalary}>
            💵 Lương
          </button>
        </div>
        <button
          className="btn btn-danger-icon"
          onClick={() => onDelete(employee.id)}
          title="Xóa"
        >
          🗑️
        </button>
      </div>
    </div>
  );
};

// InfoItem Component (Giữ nguyên)
const InfoItem = ({ icon, label, value, isLink, highlight, fullWidth }) => (
  <div className={`info-item ${fullWidth ? "full" : ""}`}>
    <div className="icon-box">{icon}</div>
    <div className="content-box">
      <span className="label">{label}</span>
      {isLink ? (
        <a href={`mailto:${value}`} className="value link">
          {value}
        </a>
      ) : (
        <span className={`value ${highlight ? "highlight" : ""}`}>
          {value || "---"}
        </span>
      )}
    </div>
  </div>
);

export default EmployeeDetail;
