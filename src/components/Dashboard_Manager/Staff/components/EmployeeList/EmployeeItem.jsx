import React from "react";

const EmployeeItem = ({ employee, isSelected, onClick }) => {
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
        return "Đang làm";
      case "break":
        return "Nghỉ giải lao";
      case "inactive":
        return "Vắng mặt";
      default:
        return "Đang làm";
    }
  };

  return (
    <div
      className={`employee-item ${isSelected ? "selected" : ""}`}
      onClick={onClick}
    >
      <div className="employee-avatar">
        {employee.avatar || employee.name.charAt(0).toUpperCase()}
      </div>

      <div className="employee-info">
        <div className="employee-name">{employee.name}</div>
        <div className="employee-role">{employee.role}</div>
        <span className={`employee-status ${getStatusClass(employee.status)}`}>
          {getStatusText(employee.status)}
        </span>
      </div>
    </div>
  );
};

export default EmployeeItem;
