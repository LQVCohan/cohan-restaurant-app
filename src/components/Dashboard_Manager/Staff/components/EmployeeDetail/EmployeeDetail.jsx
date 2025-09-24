import React from "react";
import "./EmployeeDetail.scss";

const EmployeeDetail = ({
  employee,
  onEdit,
  onViewHistory,
  onCalculateSalary,
  onDelete,
}) => {
  if (!employee) {
    return (
      <div className="employee-detail-card">
        <div className="no-selection">
          <div className="no-selection-icon">👤</div>
          <div className="no-selection-text">
            Chọn một nhân viên để xem thông tin chi tiết
          </div>
        </div>
      </div>
    );
  }

  const getStatusClass = (status) => {
    switch (status) {
      case "active":
        return "status-active";
      case "break":
        return "status-break";
      case "inactive":
        return "status-inactive";
      default:
        return "status-active";
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case "active":
        return "Đang làm việc";
      case "break":
        return "Nghỉ giải lao";
      case "inactive":
        return "Vắng mặt";
      default:
        return "Đang làm việc";
    }
  };

  const handleDelete = () => {
    if (
      window.confirm(
        "⚠️ Bạn có chắc chắn muốn xóa nhân viên này?\nHành động này không thể hoàn tác!"
      )
    ) {
      onDelete(employee.id);
    }
  };

  return (
    <div className="employee-detail-card">
      <div className="detail-header">
        <div className="detail-avatar">
          {employee.avatar || employee.name.charAt(0).toUpperCase()}
        </div>
        <div className="detail-name">{employee.name}</div>
        <div className="detail-role">{employee.role}</div>
        <span className={`employee-status ${getStatusClass(employee.status)}`}>
          {getStatusText(employee.status)}
        </span>
      </div>

      <div className="detail-info">
        <div className="info-item">
          <span className="info-label">📞 Số điện thoại</span>
          <span className="info-value">{employee.phone}</span>
        </div>
        <div className="info-item">
          <span className="info-label">📧 Email</span>
          <span className="info-value">{employee.email}</span>
        </div>
        <div className="info-item">
          <span className="info-label">🏠 Địa chỉ</span>
          <span className="info-value">{employee.address}</span>
        </div>
        <div className="info-item">
          <span className="info-label">📅 Ngày vào làm</span>
          <span className="info-value">{employee.startDate}</span>
        </div>
        <div className="info-item">
          <span className="info-label">💰 Lương cơ bản</span>
          <span className="info-value">{employee.salary}</span>
        </div>
        <div className="info-item">
          <span className="info-label">⏰ Ca làm việc</span>
          <span className="info-value">{employee.shift}</span>
        </div>
        <div className="info-item">
          <span className="info-label">📊 Hiệu suất</span>
          <span className="info-value">{employee.performance}</span>
        </div>
      </div>

      <div className="detail-actions">
        <button className="btn btn-primary btn-small" onClick={onEdit}>
          ✏️ Chỉnh Sửa
        </button>
        <button className="btn btn-secondary btn-small" onClick={onViewHistory}>
          📊 Lịch Sử Làm Việc
        </button>
        <button
          className="btn btn-secondary btn-small"
          onClick={onCalculateSalary}
        >
          💰 Tính Lương Tháng
        </button>
        <button className="btn btn-danger btn-small" onClick={handleDelete}>
          🗑️ Xóa Nhân Viên
        </button>
      </div>
    </div>
  );
};

export default EmployeeDetail;
