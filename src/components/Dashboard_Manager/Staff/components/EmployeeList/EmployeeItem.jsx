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
import "./EmployeeItem.scss";

const EmployeeItem = ({
  employee,
  isSelected,
  isFocusedFromSchedule = false,
  onClick,
  onAction,
}) => {
  // --- HELPERS ---
  const getAvatarColor = (name) => {
    const colors = [
      "#3b82f6",
      "#10b981",
      "#f59e0b",
      "#ef4444",
      "#8b5cf6",
      "#ec4899",
    ];
    return colors[(name?.length || 0) % colors.length];
  };

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

  const handleActionClick = (e, type) => {
    e.stopPropagation();
    if (onAction) onAction(e, type);
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
      role="button"
      tabIndex={0}
      title={employeeName}
    >
      {/* 1. INFO COLUMN */}
      <div className="col-main">
        <div className="avatar-wrapper">
          {employee.avatar ? (
            <img
              src={employee.avatar}
              alt={employeeName}
              className="avatar-img"
            />
          ) : (
            <div
              className="avatar-placeholder"
              style={{ backgroundColor: getAvatarColor(employeeName) }}
            >
              {employeeName.charAt(0).toUpperCase()}
            </div>
          )}
          {/* Status Indicator Dot */}
          <span className={`status-dot ${employee.status}`} />
        </div>

        <div className="info-content">
          <h4 className="name" title={employeeName}>{employeeName}</h4>
          <span className={`code ${employee.code ? "" : "is-missing"}`}>{employeeCode}</span>
        </div>
      </div>

      {/* 2. ROLE & DEPT COLUMN */}
      <div className="col-role">
        <div className="role-text" title={employeeRole}>
          <Briefcase size={12} className="icon" />
          <span>{employeeRole}</span>
        </div>
        <span className={`dept-badge ${deptInfo.color}`}>{deptInfo.label}</span>
      </div>

      {/* 3. CONTACT COLUMN (Desktop mostly) */}
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

      {/* 4. ACTIONS COLUMN */}
      <div className="col-actions">
        <div className="action-buttons">
          <button
            className="btn-icon edit"
            onClick={(e) => handleActionClick(e, "edit")}
            title="Chỉnh sửa nhân viên"
            aria-label="Chỉnh sửa nhân viên"
            type="button"
          >
            <Edit size={16} />
          </button>
          <button
            className="btn-icon delete"
            onClick={(e) => handleActionClick(e, "delete")}
            title="Xóa nhân viên"
            aria-label="Xóa nhân viên"
            type="button"
          >
            <Trash2 size={16} />
          </button>
        </div>
        {/* Mobile menu trigger (optional) */}
        <button className="btn-icon mobile-menu" title="Mở thao tác" aria-label="Mở thao tác" type="button">
          <MoreHorizontal size={18} />
        </button>
      </div>
    </div>
  );
};

export default EmployeeItem;
