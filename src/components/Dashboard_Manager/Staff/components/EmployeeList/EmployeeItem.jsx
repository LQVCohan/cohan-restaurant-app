import React from "react";

const EmployeeItem = ({ employee, isSelected, onClick, onAction }) => {
  // 1. Helper: Lấy màu nền cố định cho Avatar dựa trên tên
  const getAvatarColor = (name) => {
    const colors = [
      "#3b82f6",
      "#10b981",
      "#f59e0b",
      "#ef4444",
      "#8b5cf6",
      "#ec4899",
      "#6366f1",
    ];
    // Lấy mã màu dựa trên độ dài tên để màu không bị đổi mỗi lần render
    return colors[name.length % colors.length];
  };

  // 2. Helper: Config hiển thị Trạng thái
  const statusConfig = {
    active: { label: "Đang làm", class: "status-active" },
    break: { label: "Nghỉ ngơi", class: "status-break" },
    inactive: { label: "Vắng mặt", class: "status-inactive" },
  };
  const statusInfo = statusConfig[employee.status] || statusConfig.active;

  // 3. Helper: Config hiển thị Bộ phận
  const getDeptLabel = (dept) => {
    const map = {
      kitchen: "Bếp",
      service: "Phục vụ",
      cashier: "Thu ngân",
      management: "Quản lý",
      cleaning: "Vệ sinh",
    };
    return map[dept] || "Khác";
  };

  // 4. Xử lý click nút hành động (Edit/Delete)
  // Cần stopPropagation để không kích hoạt sự kiện chọn dòng (onClick của row)
  const handleActionClick = (e, type) => {
    e.stopPropagation();
    if (onAction) {
      onAction(e, type);
    }
  };

  return (
    <div
      className={`employee-row-item ${isSelected ? "selected" : ""}`}
      onClick={onClick}
    >
      {/* --- CỘT 1: THÔNG TIN CHÍNH --- */}
      <div className="col col-info">
        <div
          className="avatar-circle"
          style={{
            backgroundImage: employee.avatar
              ? `url(${employee.avatar})`
              : "none",
            backgroundColor: !employee.avatar
              ? getAvatarColor(employee.name)
              : "transparent",
            // Style inline để hỗ trợ fallback khi không có ảnh
            color: "#fff",
            fontSize: "1.1rem",
            fontWeight: "600",
            border: "2px solid #fff",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          }}
        >
          {/* Nếu không có ảnh thì hiện chữ cái đầu */}
          {!employee.avatar && employee.name.charAt(0).toUpperCase()}
        </div>

        <div className="info-text">
          <div className="name" title={employee.name}>
            {employee.name}
          </div>
          <div className="code-role">
            <span className="code">{employee.code || "N/A"}</span>
            <span className="role" title={employee.role}>
              {employee.role}
            </span>
          </div>
        </div>
      </div>

      {/* --- CỘT 2: LIÊN HỆ --- */}
      <div className="col col-contact">
        <div className="email" title={employee.email}>
          {employee.email}
        </div>
        <div className="phone">{employee.phone}</div>
      </div>

      {/* --- CỘT 3: BỘ PHẬN --- */}
      <div className="col col-dept">
        <span className={`dept-badge dept-${employee.department}`}>
          {getDeptLabel(employee.department)}
        </span>
      </div>

      {/* --- CỘT 4: TRẠNG THÁI --- */}
      <div className="col col-status">
        <span className={`status-pill ${statusInfo.class}`}>
          <span className="dot"></span>
          {statusInfo.label}
        </span>
      </div>

      {/* --- CỘT 5: HÀNH ĐỘNG (Hover mới hiện) --- */}
      <div className="col col-actions">
        <button
          className="action-btn edit"
          onClick={(e) => handleActionClick(e, "edit")}
          title="Chỉnh sửa"
        >
          ✏️
        </button>
        <button
          className="action-btn delete"
          onClick={(e) => handleActionClick(e, "delete")}
          title="Xóa nhân viên"
        >
          🗑️
        </button>
      </div>
    </div>
  );
};

export default EmployeeItem;
