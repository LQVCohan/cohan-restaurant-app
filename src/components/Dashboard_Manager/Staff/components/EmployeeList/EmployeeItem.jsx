import React from "react";
import {
  Phone,
  Mail,
  MoreHorizontal,
  Edit,
  Trash2,
  Briefcase,
} from "lucide-react";
import { DEPARTMENT_OPTIONS } from "../../../../../utils/staffRoleOptions";
import StaffAvatarMedia from "../StaffAvatarMedia";
import "./EmployeeItem.scss";

const EmployeeItem = ({
  employee,
  isSelected,
  isFocusedFromSchedule = false,
  onClick,
  onAction,
}) => {
  const getDeptConfig = (dept) => {
    const option = DEPARTMENT_OPTIONS.find((item) => item.value === dept);
    const map = {
      kitchen: { label: "Bếp", color: "orange" },
      service: { label: "Phục vụ", color: "blue" },
      cashier: { label: "Thu ngân", color: "green" },
      management: { label: "Quản lý", color: "purple" },
      cleaning: { label: "Vệ sinh", color: "gray" },
      delivery: { label: "Giao hàng", color: "blue" },
      inventory: { label: "Kho", color: "gray" },
      bar: { label: "Quầy bar", color: "purple" },
    };
    const mapped = map[dept] || { label: "Khác", color: "gray" };
    return option ? { ...mapped, label: option.label.replace(/^\S+\s*/, "") } : mapped;
  };

  const handleActionClick = (event, type) => {
    event.stopPropagation();
    onAction?.(employee, type);
  };

  const handleKeyDown = (event) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick?.();
    }
  };

  const deptInfo = getDeptConfig(employee.department);
  const isInactive = employee.status === "inactive";
  const employeeName = employee.name || "Chưa có tên";
  const employeeCode = employee.code || "Chưa có mã";
  const employeeRole = employee.role || "Chưa gán vị trí";
  const employeeEmail = employee.email || "Chưa có email";
  const employeePhone = employee.phone || "Chưa có SĐT";

  return (
    <div
      className={`employee-row-item ${isSelected ? "selected" : ""} ${isInactive ? "dimmed" : ""} ${isFocusedFromSchedule ? "is-focused-from-schedule" : ""}`}
      data-employee-id={employee.id}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-pressed={Boolean(isSelected)}
      aria-label={`Xem hồ sơ ${employeeName}`}
      title={employeeName}
    >
      <div className="col-main">
        <div className="avatar-wrapper">
          <StaffAvatarMedia
            employee={employee}
            name={employeeName}
            className="avatar-img"
            eager={Boolean(isSelected)}
          />
          <span
            className={`status-dot ${employee.status}`}
            title={employee.status === "active" ? "Đang hoạt động" : "Không hoạt động"}
          />
        </div>

        <div className="info-content">
          <h4 className="name" title={employeeName}>{employeeName}</h4>
          <span className={`code ${employee.code ? "" : "is-missing"}`}>{employeeCode}</span>
        </div>
      </div>

      <div className="col-role">
        <div className="role-text" title={employeeRole}>
          <Briefcase size={12} className="icon" />
          <span>{employeeRole}</span>
        </div>
        <span className={`dept-badge ${deptInfo.color}`}>{deptInfo.label}</span>
      </div>

      <div className="col-contact">
        <div className={`contact-row ${employee.email ? "" : "is-missing"}`} title={employeeEmail}>
          <Mail size={12} />
          <span>{employeeEmail}</span>
        </div>
        <div className={`contact-row ${employee.phone ? "" : "is-missing"}`} title={employeePhone}>
          <Phone size={12} />
          <span>{employeePhone}</span>
        </div>
      </div>

      <div className="col-actions">
        <div className="action-buttons">
          <button
            className="btn-icon edit"
            onClick={(event) => handleActionClick(event, "edit")}
            title="Chỉnh sửa nhân viên"
            aria-label={`Chỉnh sửa ${employeeName}`}
            type="button"
          >
            <Edit size={16} />
          </button>
          <button
            className="btn-icon delete"
            onClick={(event) => handleActionClick(event, "delete")}
            title="Ngừng hiển thị nhân viên"
            aria-label={`Ngừng hiển thị ${employeeName}`}
            type="button"
          >
            <Trash2 size={16} />
          </button>
        </div>
        <button
          className="btn-icon mobile-menu"
          title="Mở thao tác"
          aria-label={`Mở thao tác cho ${employeeName}`}
          type="button"
          onClick={(event) => handleActionClick(event, "edit")}
        >
          <MoreHorizontal size={18} />
        </button>
      </div>
    </div>
  );
};

export default EmployeeItem;
