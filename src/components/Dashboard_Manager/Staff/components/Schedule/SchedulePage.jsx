import React, { useState, useMemo } from "react";
import "./SchedulePage.scss";

// --- MOCK DATA: NHÂN VIÊN ---
const EMPLOYEES = [
  {
    id: 1,
    name: "Nguyễn Nhật Minh",
    role: "Cửa hàng trưởng",
    avatar: "https://i.pravatar.cc/150?img=11",
  },
  {
    id: 2,
    name: "Trần Thị Thu Hà",
    role: "Bếp chính",
    avatar: "https://i.pravatar.cc/150?img=5",
  },
  { id: 3, name: "Lê Văn Cường", role: "Phục vụ", avatar: null },
  {
    id: 4,
    name: "Phạm Hoàng Yến",
    role: "Thu ngân",
    avatar: "https://i.pravatar.cc/150?img=9",
  },
  { id: 5, name: "Đỗ Minh Tuấn", role: "Phụ bếp", avatar: null },
  {
    id: 6,
    name: "Vũ Thị Mai",
    role: "Tạp vụ",
    avatar: "https://i.pravatar.cc/150?img=24",
  },
];

// --- MOCK DATA: CA LÀM VIỆC (Giả lập dữ liệu tuần này) ---
// Type: 'morning' | 'afternoon' | 'evening' | 'full'
const SHIFTS = [
  { empId: 1, date: "2024-05-20", type: "full", start: "08:00", end: "17:00" },
  { empId: 1, date: "2024-05-21", type: "full", start: "08:00", end: "17:00" },
  { empId: 1, date: "2024-05-22", type: "full", start: "08:00", end: "17:00" },
  { empId: 1, date: "2024-05-24", type: "full", start: "08:00", end: "17:00" },

  {
    empId: 2,
    date: "2024-05-20",
    type: "morning",
    start: "06:00",
    end: "14:00",
  },
  {
    empId: 2,
    date: "2024-05-21",
    type: "morning",
    start: "06:00",
    end: "14:00",
  },
  { empId: 2, date: "2024-05-22", type: "off", start: "", end: "" }, // Nghỉ phép
  {
    empId: 2,
    date: "2024-05-23",
    type: "morning",
    start: "06:00",
    end: "14:00",
  },

  {
    empId: 3,
    date: "2024-05-20",
    type: "afternoon",
    start: "14:00",
    end: "22:00",
  },
  {
    empId: 3,
    date: "2024-05-21",
    type: "afternoon",
    start: "14:00",
    end: "22:00",
  },

  { empId: 4, date: "2024-05-20", type: "full", start: "09:00", end: "18:00" },
  {
    empId: 4,
    date: "2024-05-22",
    type: "morning",
    start: "08:00",
    end: "12:00",
  },
];

const SchedulePage = () => {
  const [currentDate, setCurrentDate] = useState(new Date("2024-05-20")); // Giả định ngày bắt đầu tuần
  const [deptFilter, setDeptFilter] = useState("all");

  // --- HELPER: Lấy 7 ngày trong tuần hiện tại ---
  const weekDays = useMemo(() => {
    const days = [];
    const startOfWeek = new Date(currentDate);
    // Điều chỉnh về thứ 2 đầu tuần (nếu cần)
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);

    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      days.push(d);
    }
    return days;
  }, [currentDate]);

  // --- HELPER: Format Date ---
  const formatDateKey = (date) => date.toISOString().split("T")[0];

  // --- HELPER: Lấy ca làm việc của nhân viên vào ngày cụ thể ---
  const getShift = (empId, date) => {
    const dateKey = formatDateKey(date);
    return SHIFTS.find((s) => s.empId === empId && s.date === dateKey);
  };

  // --- HANDLERS ---
  const nextWeek = () => {
    const next = new Date(currentDate);
    next.setDate(currentDate.getDate() + 7);
    setCurrentDate(next);
  };

  const prevWeek = () => {
    const prev = new Date(currentDate);
    prev.setDate(currentDate.getDate() - 7);
    setCurrentDate(prev);
  };

  const goToToday = () => setCurrentDate(new Date("2024-05-20")); // Demo set cứng, thực tế là new Date()

  // --- RENDER SHIFT PILL ---
  const renderShiftPill = (shift) => {
    if (!shift) return <div className="empty-slot"></div>;

    if (shift.type === "off") {
      return <div className="shift-pill off">OFF</div>;
    }

    const typeLabels = {
      morning: "Ca Sáng",
      afternoon: "Ca Chiều",
      evening: "Ca Tối",
      full: "Full-time",
    };

    return (
      <div
        className={`shift-pill ${shift.type}`}
        title={`${shift.start} - ${shift.end}`}
      >
        <span className="time">
          {shift.start} - {shift.end}
        </span>
        <span className="label">{typeLabels[shift.type]}</span>
      </div>
    );
  };

  return (
    <div className="schedule-page-container">
      {/* 1. HEADER CONTROLS */}
      <div className="schedule-header">
        <div className="header-left">
          <h2 className="page-title">📅 Lịch Làm Việc</h2>
          <div className="date-nav">
            <button className="nav-btn" onClick={prevWeek}>
              ‹
            </button>
            <span className="current-range">
              Tuần{" "}
              {weekDays[0].toLocaleDateString("vi-VN", {
                day: "2-digit",
                month: "2-digit",
              })}{" "}
              -{" "}
              {weekDays[6].toLocaleDateString("vi-VN", {
                day: "2-digit",
                month: "2-digit",
              })}
            </span>
            <button className="nav-btn" onClick={nextWeek}>
              ›
            </button>
            <button className="btn-today" onClick={goToToday}>
              Hôm nay
            </button>
          </div>
        </div>

        <div className="header-right">
          <select
            className="filter-select"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
          >
            <option value="all">Tất cả bộ phận</option>
            <option value="kitchen">Bếp</option>
            <option value="service">Phục vụ</option>
          </select>
          <div className="legend">
            <span className="legend-item morning">
              <span className="dot"></span>Sáng
            </span>
            <span className="legend-item afternoon">
              <span className="dot"></span>Chiều
            </span>
            <span className="legend-item full">
              <span className="dot"></span>Full
            </span>
          </div>
        </div>
      </div>

      {/* 2. SCHEDULE GRID TABLE */}
      <div className="schedule-grid-wrapper">
        <div className="schedule-grid">
          {/* Header Row: Dates */}
          <div className="grid-header-row">
            <div className="col-employee-header">Nhân viên</div>
            {weekDays.map((day, index) => (
              <div
                key={index}
                className={`col-day-header ${
                  formatDateKey(day) === "2024-05-20" ? "today" : ""
                }`}
              >
                <div className="day-name">
                  {day.toLocaleDateString("vi-VN", { weekday: "short" })}
                </div>
                <div className="day-date">{day.getDate()}</div>
              </div>
            ))}
          </div>

          {/* Body Rows: Employees */}
          {EMPLOYEES.map((emp) => (
            <div className="grid-row" key={emp.id}>
              {/* Cột cố định: Tên NV */}
              <div className="col-employee">
                <div className="avatar">
                  {emp.avatar ? (
                    <img src={emp.avatar} alt="" />
                  ) : (
                    emp.name.charAt(0)
                  )}
                </div>
                <div className="info">
                  <div className="name">{emp.name}</div>
                  <div className="role">{emp.role}</div>
                </div>
              </div>

              {/* 7 Cột ngày */}
              {weekDays.map((day, index) => (
                <div
                  key={index}
                  className={`col-day-cell ${
                    formatDateKey(day) === "2024-05-20" ? "today" : ""
                  }`}
                >
                  {renderShiftPill(getShift(emp.id, day))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SchedulePage;
