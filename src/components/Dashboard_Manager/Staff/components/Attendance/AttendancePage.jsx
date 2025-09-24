import React, { useState } from "react";
import "./Attendance.scss";

const AttendancePage = ({ currentTime, currentDate }) => {
  const [attendanceStatus, setAttendanceStatus] = useState("out"); // 'in' or 'out'
  const [todayHours, setTodayHours] = useState(0);

  const handleCheckIn = () => {
    setAttendanceStatus("in");
    alert(`✅ Đã chấm công vào ca lúc ${currentTime}\n(Tính năng demo)`);
  };

  const handleCheckOut = () => {
    setAttendanceStatus("out");
    setTodayHours(8); // Demo: set 8 hours worked
    alert(`🔴 Đã chấm công tan ca lúc ${currentTime}\n(Tính năng demo)`);
  };

  const monthlyStats = {
    workDays: 22,
    totalDays: 24,
    totalHours: 176,
    onTimeCount: 20,
    lateCount: 2,
    earlyLeaveCount: 0,
    performance: 91,
  };

  return (
    <div className="attendance-page">
      <div className="attendance-grid">
        {/* Time Clock Card */}
        <div className="attendance-card">
          <h3 className="card-title">⏰ Chấm Công Hôm Nay</h3>

          <div className="time-display-staff">
            <div className="current-time">{currentTime}</div>
            <div className="current-date">{currentDate}</div>
          </div>

          <div className="attendance-actions">
            <button
              className={`attendance-btn check-in ${
                attendanceStatus === "in" ? "disabled" : ""
              }`}
              onClick={handleCheckIn}
              disabled={attendanceStatus === "in"}
            >
              <div className="attendance-icon">🟢</div>
              <div>Vào Ca</div>
              <div className="btn-subtitle">Check In</div>
            </button>

            <button
              className={`attendance-btn check-out ${
                attendanceStatus === "out" ? "disabled" : ""
              }`}
              onClick={handleCheckOut}
              disabled={attendanceStatus === "out"}
            >
              <div className="attendance-icon">🔴</div>
              <div>Tan Ca</div>
              <div className="btn-subtitle">Check Out</div>
            </button>
          </div>

          <div className="today-info">
            <div className="info-item">
              <span className="info-label">🕐 Giờ vào ca</span>
              <span className="info-value">08:00</span>
            </div>
            <div className="info-item">
              <span className="info-label">🕕 Giờ tan ca</span>
              <span className="info-value">17:00</span>
            </div>
            <div className="info-item">
              <span className="info-label">⏱️ Tổng giờ làm</span>
              <span className="info-value">{todayHours} giờ</span>
            </div>
          </div>
        </div>

        {/* Statistics Card */}
        <div className="attendance-card">
          <h3 className="card-title">📊 Thống Kê Chấm Công</h3>

          <div className="stats-info">
            <div className="info-item">
              <span className="info-label">📅 Tháng này</span>
              <span className="info-value">
                {monthlyStats.workDays}/{monthlyStats.totalDays} ngày
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">⏰ Tổng giờ làm</span>
              <span className="info-value">{monthlyStats.totalHours} giờ</span>
            </div>
            <div className="info-item">
              <span className="info-label">🎯 Đúng giờ</span>
              <span className="info-value">
                {monthlyStats.onTimeCount}/{monthlyStats.workDays} lần
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">⏰ Đi muộn</span>
              <span className="info-value">{monthlyStats.lateCount} lần</span>
            </div>
            <div className="info-item">
              <span className="info-label">🏃 Về sớm</span>
              <span className="info-value">
                {monthlyStats.earlyLeaveCount} lần
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">📈 Hiệu suất</span>
              <span className="info-value">{monthlyStats.performance}%</span>
            </div>
          </div>

          <div className="stats-actions">
            <button className="btn btn-secondary btn-small">
              📊 Xem Chi Tiết
            </button>
            <button className="btn btn-primary btn-small">
              📄 Xuất Báo Cáo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendancePage;
