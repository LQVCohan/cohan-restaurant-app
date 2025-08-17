import React, { useState } from "react";
import "./StaffAttendance.scss";

const StaffAttendance = () => {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [viewMode, setViewMode] = useState("daily"); // daily, weekly, monthly

  // Mock attendance data
  const attendanceData = [
    {
      id: 1,
      staffId: 1,
      name: "Nguyễn Văn A",
      position: "Bếp trưởng",
      avatar: "👨‍🍳",
      checkIn: "08:00",
      checkOut: "17:30",
      breakTime: "60",
      totalHours: "8.5",
      status: "present",
      overtime: "0.5",
    },
    {
      id: 2,
      staffId: 2,
      name: "Trần Thị B",
      position: "Phục vụ trưởng",
      avatar: "👩‍💼",
      checkIn: "08:15",
      checkOut: "17:45",
      breakTime: "45",
      totalHours: "8.75",
      status: "late",
      overtime: "0.75",
    },
    {
      id: 3,
      staffId: 3,
      name: "Lê Văn C",
      position: "Thu ngân",
      avatar: "👨‍💼",
      checkIn: null,
      checkOut: null,
      breakTime: null,
      totalHours: "0",
      status: "absent",
      overtime: "0",
    },
    {
      id: 4,
      staffId: 4,
      name: "Phạm Thị D",
      position: "Phục vụ",
      avatar: "👩‍🍳",
      checkIn: "07:45",
      checkOut: "16:30",
      breakTime: "60",
      totalHours: "7.75",
      status: "early",
      overtime: "0",
    },
    {
      id: 5,
      staffId: 5,
      name: "Hoàng Văn E",
      position: "Bếp phó",
      avatar: "👨‍🍳",
      checkIn: null,
      checkOut: null,
      breakTime: null,
      totalHours: "0",
      status: "leave",
      overtime: "0",
    },
  ];

  const attendanceStats = {
    total: attendanceData.length,
    present: attendanceData.filter((a) => a.status === "present").length,
    late: attendanceData.filter((a) => a.status === "late").length,
    absent: attendanceData.filter((a) => a.status === "absent").length,
    leave: attendanceData.filter((a) => a.status === "leave").length,
    early: attendanceData.filter((a) => a.status === "early").length,
  };

  const getStatusConfig = (status) => {
    const configs = {
      present: {
        label: "Có mặt",
        class: "success",
        icon: "fas fa-check-circle",
      },
      late: { label: "Đi muộn", class: "warning", icon: "fas fa-clock" },
      absent: {
        label: "Vắng mặt",
        class: "danger",
        icon: "fas fa-times-circle",
      },
      leave: {
        label: "Nghỉ phép",
        class: "info",
        icon: "fas fa-calendar-times",
      },
      early: { label: "Về sớm", class: "secondary", icon: "fas fa-arrow-left" },
    };
    return (
      configs[status] || {
        label: status,
        class: "secondary",
        icon: "fas fa-question",
      }
    );
  };

  const formatTime = (time) => {
    return time || "--:--";
  };

  const getCurrentDate = () => {
    return new Date(selectedDate).toLocaleDateString("vi-VN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="staff-attendance">
      {/* Header */}
      <div className="attendance-header">
        <div className="header-left">
          <h2>Chấm công nhân viên</h2>
          <p>Theo dõi giờ làm việc của nhân viên - {getCurrentDate()}</p>
        </div>
        <div className="header-controls">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="date-picker"
          />
          <div className="view-mode-toggle">
            {["daily", "weekly", "monthly"].map((mode) => (
              <button
                key={mode}
                className={`toggle-btn ${viewMode === mode ? "active" : ""}`}
                onClick={() => setViewMode(mode)}
              >
                {mode === "daily"
                  ? "Ngày"
                  : mode === "weekly"
                  ? "Tuần"
                  : "Tháng"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="attendance-stats">
        <div className="stat-card stat-card--total">
          <div className="stat-icon">
            <i className="fas fa-users" />
          </div>
          <div className="stat-content">
            <h3>{attendanceStats.total}</h3>
            <p>Tổng nhân viên</p>
          </div>
        </div>

        <div className="stat-card stat-card--present">
          <div className="stat-icon">
            <i className="fas fa-check-circle" />
          </div>
          <div className="stat-content">
            <h3>{attendanceStats.present}</h3>
            <p>Có mặt</p>
          </div>
        </div>

        <div className="stat-card stat-card--late">
          <div className="stat-icon">
            <i className="fas fa-clock" />
          </div>
          <div className="stat-content">
            <h3>{attendanceStats.late}</h3>
            <p>Đi muộn</p>
          </div>
        </div>

        <div className="stat-card stat-card--absent">
          <div className="stat-icon">
            <i className="fas fa-times-circle" />
          </div>
          <div className="stat-content">
            <h3>{attendanceStats.absent}</h3>
            <p>Vắng mặt</p>
          </div>
        </div>

        <div className="stat-card stat-card--leave">
          <div className="stat-icon">
            <i className="fas fa-calendar-times" />
          </div>
          <div className="stat-content">
            <h3>{attendanceStats.leave}</h3>
            <p>Nghỉ phép</p>
          </div>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="attendance-table-container">
        <div className="table-header">
          <h3>Chi tiết chấm công</h3>
          <div className="table-actions">
            <button className="btn btn--secondary">
              <i className="fas fa-download" />
              Xuất Excel
            </button>
            <button className="btn btn--primary">
              <i className="fas fa-plus" />
              Thêm chấm công
            </button>
          </div>
        </div>

        <div className="attendance-table">
          <table>
            <thead>
              <tr>
                <th>Nhân viên</th>
                <th>Vào ca</th>
                <th>Ra ca</th>
                <th>Nghỉ giải lao</th>
                <th>Tổng giờ</th>
                <th>Tăng ca</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {attendanceData.map((record) => {
                const statusConfig = getStatusConfig(record.status);
                return (
                  <tr key={record.id}>
                    <td>
                      <div className="staff-info">
                        <span className="staff-avatar">{record.avatar}</span>
                        <div className="staff-details">
                          <span className="staff-name">{record.name}</span>
                          <span className="staff-position">
                            {record.position}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="time-display">
                        {formatTime(record.checkIn)}
                      </span>
                    </td>
                    <td>
                      <span className="time-display">
                        {formatTime(record.checkOut)}
                      </span>
                    </td>
                    <td>
                      <span className="break-time">
                        {record.breakTime ? `${record.breakTime} phút` : "--"}
                      </span>
                    </td>
                    <td>
                      <span className="total-hours">{record.totalHours}h</span>
                    </td>
                    <td>
                      <span className="overtime">{record.overtime}h</span>
                    </td>
                    <td>
                      <span
                        className={`status-badge status-badge--${statusConfig.class}`}
                      >
                        <i className={statusConfig.icon} />
                        {statusConfig.label}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button className="action-btn" title="Chỉnh sửa">
                          <i className="fas fa-edit" />
                        </button>
                        <button className="action-btn" title="Xem chi tiết">
                          <i className="fas fa-eye" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <h3>Thao tác nhanh</h3>
        <div className="action-grid">
          <button className="quick-action-card">
            <i className="fas fa-user-clock" />
            <span>Chấm công thủ công</span>
          </button>
          <button className="quick-action-card">
            <i className="fas fa-calendar-check" />
            <span>Đăng ký nghỉ phép</span>
          </button>
          <button className="quick-action-card">
            <i className="fas fa-chart-line" />
            <span>Báo cáo chấm công</span>
          </button>
          <button className="quick-action-card">
            <i className="fas fa-cog" />
            <span>Cài đặt ca làm</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default StaffAttendance;
