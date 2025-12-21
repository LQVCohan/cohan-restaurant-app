import React, { useState, useMemo } from "react";
import {
  format,
  startOfWeek,
  endOfWeek,
  addDays,
  addWeeks,
  subDays,
  subWeeks,
  isSameDay,
} from "date-fns";
import { vi } from "date-fns/locale"; // Locale Tiếng Việt
import { ChevronLeft, ChevronRight, Zap } from "lucide-react"; // Import icon điều hướng

import "./ScheduleManagement.scss";
import { shiftTypes } from "./utils/scheduleHelpers";

// Component Con
import ShiftCard from "./components/ShiftCard";
import AddShiftModal from "./components/AddShiftModal";
import ShiftDetailModal from "./components/ShiftDetailModal";
import AutoScheduleModal from "./components/AutoScheduleModal";
import DailyView from "./DailyView"; // Component mới

const ScheduleManagement = () => {
  // --- 1. STATE & MOCK DATA ---

  // Khởi tạo ngày mặc định là 09/12/2024 để khớp với Mock Data demo
  // Trong thực tế, bạn sẽ dùng new Date()
  const [currentDate, setCurrentDate] = useState(new Date("2024-12-09"));
  const [viewMode, setViewMode] = useState("week"); // 'week' | 'day'

  const [staff, setStaff] = useState([
    {
      id: 1,
      name: "Nguyễn Văn An",
      job: "chef",
      status: "active",
      salary: 50000,
    },
    {
      id: 2,
      name: "Trần Thị Bình",
      job: "waiter",
      status: "active",
      salary: 25000,
    },
    {
      id: 3,
      name: "Lê Văn Cường",
      job: "cashier",
      status: "active",
      salary: 28000,
    },
    {
      id: 4,
      name: "Phạm Thị Dung",
      job: "cleaner",
      status: "active",
      salary: 20000,
    },
    {
      id: 5,
      name: "Hoàng Văn Em",
      job: "cook",
      status: "active",
      salary: 30000,
    },
    {
      id: 6,
      name: "Vũ Thị Phương",
      job: "waiter",
      status: "off",
      salary: 25000,
    },
    {
      id: 7,
      name: "Đỗ Văn Giang",
      job: "bartender",
      status: "active",
      salary: 35000,
    },
    {
      id: 8,
      name: "Ngô Thị Hoa",
      job: "host",
      status: "active",
      salary: 26000,
    },
  ]);

  const [shifts, setShifts] = useState([
    {
      id: 1,
      date: "2024-12-09",
      day: "monday",
      shiftType: "morning",
      startTime: "06:00",
      endTime: "14:00",
      essentialJobs: ["chef", "cook", "waiter"],
      staffIds: [1, 5, 2],
      notes: "Ca sáng đầu tuần",
    },
    {
      id: 2,
      date: "2024-12-09",
      day: "monday",
      shiftType: "afternoon",
      startTime: "14:00",
      endTime: "22:00",
      essentialJobs: ["waiter", "cashier", "bartender"],
      staffIds: [3, 7],
      notes: "Thiếu phục vụ",
    },
  ]);

  const [isPublished, setIsPublished] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addModalContext, setAddModalContext] = useState({
    date: "",
    shiftType: "",
  });
  const [selectedShift, setSelectedShift] = useState(null);
  const [isAutoModalOpen, setIsAutoModalOpen] = useState(false);

  // --- 2. DATE NAVIGATION LOGIC ---

  const handleNavigate = (direction) => {
    if (viewMode === "week") {
      setCurrentDate((prev) =>
        direction === "next" ? addWeeks(prev, 1) : subWeeks(prev, 1)
      );
    } else {
      setCurrentDate((prev) =>
        direction === "next" ? addDays(prev, 1) : subDays(prev, 1)
      );
    }
  };

  const handleToday = () => setCurrentDate(new Date("2024-12-09")); // Reset về ngày demo

  // Tính toán nhãn hiển thị ngày tháng
  const dateLabel = useMemo(() => {
    if (viewMode === "week") {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 }); // Thứ 2 là đầu tuần
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `Tuần ${format(start, "w")}, ${format(start, "yyyy")} (${format(
        start,
        "dd/MM"
      )} - ${format(end, "dd/MM")})`;
    } else {
      return format(currentDate, "EEEE, dd/MM/yyyy", { locale: vi });
    }
  }, [currentDate, viewMode]);

  // Tạo danh sách các ngày trong tuần để render Header Bảng
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [currentDate]);

  // --- 3. BUSINESS LOGIC ---
  const kpis = useMemo(() => {
    const totalShifts = shifts.length;
    const alertShifts = shifts.filter(
      (s) => s.staffIds.length < s.essentialJobs.length
    ).length;
    const totalCost = shifts.reduce((acc, shift) => {
      const shiftCost = shift.staffIds.reduce((sum, staffId) => {
        const person = staff.find((s) => s.id === staffId);
        return sum + (person ? person.salary * 8 : 0);
      }, 0);
      return acc + shiftCost;
    }, 0);
    return { totalShifts, alertShifts, totalCost };
  }, [shifts, staff]);

  // --- 4. HANDLERS ---
  const openAddShiftModal = (dateObj, shiftType) => {
    setAddModalContext({
      date: format(dateObj, "yyyy-MM-dd"),
      shiftType: shiftType,
    });
    setIsAddModalOpen(true);
  };

  const handleCreateShift = (newShiftData) => {
    // Logic tạo ca giữ nguyên...
    // (Lược bớt để tập trung vào logic view, bạn copy lại phần create shift cũ vào đây nếu cần)
    const typeConfig = shiftTypes[newShiftData.shiftType];
    const newShift = {
      id: Date.now(),
      ...newShiftData,
      startTime: typeConfig.startTime,
      endTime: typeConfig.endTime,
      day: format(new Date(newShiftData.date), "EEEE").toLowerCase(),
    };
    setShifts([...shifts, newShift]);
    setIsAddModalOpen(false);
  };

  const handleAutoSchedule = (config) => {
    // Giữ nguyên logic Auto Schedule của bạn
    alert("Đã chạy xếp lịch tự động! (Demo)");
    setIsAutoModalOpen(false);
  };

  const handleRemoveStaff = (shiftId, staffId) => {
    setShifts((prev) =>
      prev.map((s) =>
        s.id === shiftId
          ? { ...s, staffIds: s.staffIds.filter((id) => id !== staffId) }
          : s
      )
    );
    if (selectedShift?.id === shiftId)
      setSelectedShift((prev) => ({
        ...prev,
        staffIds: prev.staffIds.filter((id) => id !== staffId),
      }));
  };

  const handleAddStaff = (shiftId, staffId) => {
    setShifts((prev) =>
      prev.map((s) =>
        s.id === shiftId ? { ...s, staffIds: [...s.staffIds, staffId] } : s
      )
    );
    if (selectedShift?.id === shiftId)
      setSelectedShift((prev) => ({
        ...prev,
        staffIds: [...prev.staffIds, staffId],
      }));
  };

  const handleDeleteShift = (shiftId) => {
    setShifts((prev) => prev.filter((s) => s.id !== shiftId));
    setSelectedShift(null);
  };

  // --- 5. RENDER ---
  return (
    <div className="schedule-container">
      {/* HEADER */}
      <header className="schedule-header">
        <div className="header-top">
          <div className="title-group">
            <h1>Quản Lý Lịch Làm Việc</h1>
            <p className="subtitle">Lên lịch nhân sự & theo dõi chi phí</p>
          </div>
          <div className="user-profile">
            <div className="user-info">
              <span className="name">Admin Manager</span>
              <span className="role">Quản trị viên</span>
            </div>
            <img
              src="https://ui-avatars.com/api/?name=Admin&background=4f46e5&color=fff"
              alt="Admin"
            />
          </div>
        </div>

        {/* KPI DASHBOARD */}
        <div className="kpi-grid">
          <div className="kpi-card money">
            <div className="kpi-icon">💰</div>
            <div className="kpi-content">
              <span className="label">Chi phí tuần</span>
              <span className="value">{kpis.totalCost.toLocaleString()} đ</span>
              <span className="trend positive">Trong ngân sách</span>
            </div>
          </div>
          <div className="kpi-card shifts">
            <div className="kpi-icon">📅</div>
            <div className="kpi-content">
              <span className="label">Tổng số ca</span>
              <span className="value">{kpis.totalShifts}</span>
              <span className="trend neutral">Hoạt động</span>
            </div>
          </div>
          <div
            className={`kpi-card alerts ${
              kpis.alertShifts > 0 ? "has-alert" : ""
            }`}
          >
            <div className="kpi-icon">⚠️</div>
            <div className="kpi-content">
              <span className="label">Cảnh báo nhân sự</span>
              <span className="value">{kpis.alertShifts}</span>
              <span className="trend">
                {kpis.alertShifts > 0 ? "Cần xử lý ngay" : "Ổn định"}
              </span>
            </div>
          </div>
          <div className="kpi-card status">
            <div className="kpi-icon">{isPublished ? "✅" : "📝"}</div>
            <div className="kpi-content">
              <span className="label">Trạng thái</span>
              <span className={`value ${isPublished ? "published" : "draft"}`}>
                {isPublished ? "Đã Xuất Bản" : "Bản Nháp"}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* TOOLBAR */}
      <div className="schedule-toolbar">
        <div className="toolbar-left">
          {/* 1. Nút Chuyển Mode */}
          <div className="view-toggles">
            <button
              className={viewMode === "week" ? "active" : ""}
              onClick={() => setViewMode("week")}
            >
              Theo Tuần
            </button>
            <button
              className={viewMode === "day" ? "active" : ""}
              onClick={() => setViewMode("day")}
            >
              Theo Ngày
            </button>
          </div>

          {/* 2. Điều hướng ngày */}
          <div
            className="date-navigation"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginLeft: "16px",
            }}
          >
            <button onClick={() => handleNavigate("prev")} className="nav-btn">
              <ChevronLeft size={20} />
            </button>
            <span
              className="week-label"
              style={{
                minWidth: "220px",
                textAlign: "center",
                cursor: "pointer",
              }}
              onClick={handleToday}
            >
              {dateLabel}
            </span>
            <button onClick={() => handleNavigate("next")} className="nav-btn">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <div className="toolbar-right">
          <button
            className="btn-auto-schedule"
            onClick={() => setIsAutoModalOpen(true)}
            style={{
              marginRight: "1rem",
              backgroundColor: "white",
              color: "#4f46e5",
              border: "1px solid #e0e7ff",
              padding: "0.6rem 1rem",
              borderRadius: "0.5rem",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <Zap size={16} fill="currentColor" /> Chia Ca Tự Động
          </button>
          <button
            className={`btn-publish ${isPublished ? "published" : ""}`}
            onClick={() => setIsPublished(!isPublished)}
          >
            {isPublished ? "Đang công khai" : "Xuất bản lịch"}
          </button>
        </div>
      </div>

      {/* MAIN CONTENT AREA: SWITCH BETWEEN WEEK & DAY */}
      <main className="calendar-area">
        {viewMode === "week" ? (
          /* --- VIEW TUẦN --- */
          <table>
            <thead>
              <tr>
                <th className="corner-th">Ca / Thứ</th>
                {weekDays.map((date, idx) => (
                  <th key={idx}>
                    <div className="date-col">
                      <span className="day-name">
                        {format(date, "EEEE", { locale: vi })}
                      </span>
                      <span className="date-num">{format(date, "dd/MM")}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(shiftTypes).map(([shiftTypeKey, shiftConfig]) => (
                <tr key={shiftTypeKey}>
                  <td className="shift-header-cell">
                    <div className={`shift-type-badge ${shiftTypeKey}`}>
                      <span className="icon">{shiftConfig.icon}</span>
                      <div className="shift-info">
                        <span className="label">{shiftConfig.label}</span>
                        <span className="time">{shiftConfig.time}</span>
                      </div>
                    </div>
                  </td>
                  {weekDays.map((date) => {
                    const dateStr = format(date, "yyyy-MM-dd");
                    const dayShifts = shifts.filter(
                      (s) => s.date === dateStr && s.shiftType === shiftTypeKey
                    );
                    return (
                      <td key={dateStr} className="shift-cell">
                        {dayShifts.map((shift) => (
                          <ShiftCard
                            key={shift.id}
                            shift={shift}
                            staffList={staff}
                            onClick={setSelectedShift}
                          />
                        ))}
                        <div
                          className="add-slot-trigger"
                          onClick={() => openAddShiftModal(date, shiftTypeKey)}
                        >
                          <span>+</span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          /* --- VIEW NGÀY (COMPONENT MỚI) --- */
          <DailyView
            currentDate={currentDate}
            shifts={shifts}
            staffList={staff}
          />
        )}
      </main>

      {/* MODALS */}
      <AddShiftModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        selectedDate={addModalContext.date}
        selectedShiftType={addModalContext.shiftType}
        staffList={staff}
        onConfirm={handleCreateShift}
      />
      <ShiftDetailModal
        isOpen={!!selectedShift}
        onClose={() => setSelectedShift(null)}
        shift={selectedShift}
        staffList={staff}
        onRemoveStaff={handleRemoveStaff}
        onAddStaff={handleAddStaff}
        onDeleteShift={handleDeleteShift}
      />
      <AutoScheduleModal
        isOpen={isAutoModalOpen}
        onClose={() => setIsAutoModalOpen(false)}
        onConfirm={handleAutoSchedule}
      />
    </div>
  );
};

export default ScheduleManagement;
