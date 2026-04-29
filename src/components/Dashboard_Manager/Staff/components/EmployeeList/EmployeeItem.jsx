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

  return (
    <div
      className={`employee-row-item ${isSelected ? "selected" : ""} ${isInactive ? "dimmed" : ""} ${isFocusedFromSchedule ? "is-focused-from-schedule" : ""}`}
      data-employee-id={employee.id}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      {/* 1. INFO COLUMN */}
      <div className="col-main">
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
          {/* Status Indicator Dot */}
          <span className={`status-dot ${employee.status}`} />
        </div>

        <div className="info-content">
          <h4 className="name">{employee.name}</h4>
          <span className="code">{employee.code || "---"}</span>
        </div>
      </div>

      {/* 2. ROLE & DEPT COLUMN */}
      <div className="col-role">
        <div className="role-text">
          <Briefcase size={12} className="icon" />
          <span>{employee.role}</span>
        </div>
        <span className={`dept-badge ${deptInfo.color}`}>{deptInfo.label}</span>
      </div>

      {/* 3. CONTACT COLUMN (Desktop mostly) */}
      <div className="col-contact">
        <div className="contact-row" title={employee.email}>
          <Mail size={12} />
          <span>{employee.email}</span>
        </div>
        <div className="contact-row">
          <Phone size={12} />
          <span>{employee.phone}</span>
        </div>
      </div>

      {/* 4. ACTIONS COLUMN */}
      <div className="col-actions">
        <div className="action-buttons">
          <button
            className="btn-icon edit"
            onClick={(e) => handleActionClick(e, "edit")}
            title="Chỉnh sửa"
          >
            <Edit size={16} />
          </button>
          <button
            className="btn-icon delete"
            onClick={(e) => handleActionClick(e, "delete")}
            title="Xóa"
          >
            <Trash2 size={16} />
          </button>
        </div>
        {/* Mobile menu trigger (optional) */}
        <button className="btn-icon mobile-menu">
          <MoreHorizontal size={18} />
        </button>
      </div>
    </div>
  );
};

export default EmployeeItem;
