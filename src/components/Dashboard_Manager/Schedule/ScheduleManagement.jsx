import React, { useState, useMemo } from "react";
import "./ScheduleManagement.scss";
import { shiftTypes } from "./utils/scheduleHelpers";

// Import các Component con (Đảm bảo đường dẫn đúng với thư mục bạn tạo)
import ShiftCard from "./components/ShiftCard";
import AddShiftModal from "./components/AddShiftModal";
import ShiftDetailModal from "./components/ShiftDetailModal";

const ScheduleManagement = () => {
  // --- 1. MOCK DATA (Dữ liệu giả lập) ---
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

  // --- 2. UI STATE ---
  const [viewMode, setViewMode] = useState("week");
  const [isPublished, setIsPublished] = useState(false);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addModalContext, setAddModalContext] = useState({
    date: "",
    shiftType: "",
  });
  const [selectedShift, setSelectedShift] = useState(null);

  // --- 3. BUSINESS LOGIC & KPIs ---
  const kpis = useMemo(() => {
    const totalShifts = shifts.length;
    const alertShifts = shifts.filter(
      (s) => s.staffIds.length < s.essentialJobs.length
    ).length;

    // Tính tổng chi phí (Giả sử mỗi ca 8 tiếng)
    const totalCost = shifts.reduce((acc, shift) => {
      const shiftCost = shift.staffIds.reduce((sum, staffId) => {
        const person = staff.find((s) => s.id === staffId);
        return sum + (person ? person.salary * 8 : 0);
      }, 0);
      return acc + shiftCost;
    }, 0);

    return { totalShifts, alertShifts, totalCost };
  }, [shifts, staff]);

  // --- 4. EVENT HANDLERS ---

  // Mở modal thêm mới
  const openAddShiftModal = (dayKey, shiftType) => {
    // Logic tính ngày: Giả sử tuần này bắt đầu từ 2024-12-09 (T2)
    const dayMap = [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ];
    const baseDate = new Date("2024-12-09"); // Hardcode cho demo
    const dayIndex = dayMap.indexOf(dayKey);
    const targetDate = new Date(baseDate);
    targetDate.setDate(baseDate.getDate() + dayIndex);

    setAddModalContext({
      date: targetDate.toISOString().split("T")[0],
      shiftType: shiftType,
    });
    setIsAddModalOpen(true);
  };

  // Xử lý tạo ca mới
  const handleCreateShift = (newShiftData) => {
    const dayMap = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    const d = new Date(newShiftData.date);
    const dayName = dayMap[d.getDay()]; // Note: getDay() return 0 for Sunday
    const typeConfig = shiftTypes[newShiftData.shiftType];

    const newShift = {
      id: Date.now(), // Simple ID gen
      date: newShiftData.date,
      day: dayName === "sunday" ? "sunday" : dayMap[d.getDay()],
      shiftType: newShiftData.shiftType,
      startTime: typeConfig.startTime,
      endTime: typeConfig.endTime,
      essentialJobs: newShiftData.essentialJobs,
      staffIds: newShiftData.staffIds,
      notes: newShiftData.notes,
    };

    setShifts([...shifts, newShift]);
    setIsAddModalOpen(false);
  };

  // Xử lý xóa nhân viên khỏi ca
  const handleRemoveStaff = (shiftId, staffId) => {
    const updatedShifts = shifts.map((s) => {
      if (s.id === shiftId) {
        return { ...s, staffIds: s.staffIds.filter((id) => id !== staffId) };
      }
      return s;
    });
    setShifts(updatedShifts);

    // Cập nhật cả modal đang mở nếu có
    if (selectedShift && selectedShift.id === shiftId) {
      setSelectedShift((prev) => ({
        ...prev,
        staffIds: prev.staffIds.filter((id) => id !== staffId),
      }));
    }
  };

  // Xử lý thêm nhân viên vào ca
  const handleAddStaff = (shiftId, staffId) => {
    const updatedShifts = shifts.map((s) => {
      if (s.id === shiftId) {
        return { ...s, staffIds: [...s.staffIds, staffId] };
      }
      return s;
    });
    setShifts(updatedShifts);

    if (selectedShift && selectedShift.id === shiftId) {
      setSelectedShift((prev) => ({
        ...prev,
        staffIds: [...prev.staffIds, staffId],
      }));
    }
  };

  // Xử lý xóa ca
  const handleDeleteShift = (shiftId) => {
    setShifts(shifts.filter((s) => s.id !== shiftId));
    setSelectedShift(null);
  };

  // --- 5. RENDER ---
  const daysOfWeek = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];
  const daysLabel = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

  return (
    <div className="schedule-container">
      {/* HEADER */}
      <header className="schedule-header">
        <div className="header-top">
          <h1>
            <span>📅</span> Quản Lý Lịch Làm Việc
          </h1>
          <div className="user-profile">
            <img
              src="https://ui-avatars.com/api/?name=Admin&background=0D8ABC&color=fff"
              alt="Admin"
            />
            <span>Administrator</span>
          </div>
        </div>

        {/* KPI DASHBOARD */}
        <div className="kpi-grid">
          <div className="kpi-card">
            <span className="label">Tổng Chi Phí (Tuần)</span>
            <span className="value">{kpis.totalCost.toLocaleString()} đ</span>
            <span className="trend positive">Trong ngân sách</span>
          </div>
          <div className="kpi-card">
            <span className="label">Tổng Số Ca</span>
            <span className="value">{kpis.totalShifts}</span>
            <span className="trend neutral">Hoạt động</span>
          </div>
          <div className="kpi-card">
            <span className="label">Cảnh Báo Nhân Sự</span>
            <span
              className="value"
              style={{ color: kpis.alertShifts > 0 ? "#dc2626" : "#1f2937" }}
            >
              {kpis.alertShifts}
            </span>
            <span className="trend negative">
              {kpis.alertShifts > 0 ? "Cần xử lý ngay" : "Ổn định"}
            </span>
          </div>
          <div className="kpi-card">
            <span className="label">Trạng Thái Lịch</span>
            <span
              className="value"
              style={{ color: isPublished ? "#16a34a" : "#ea580c" }}
            >
              {isPublished ? "Đã Xuất Bản" : "Bản Nháp"}
            </span>
            <span className="trend neutral">Visible to Staff</span>
          </div>
        </div>
      </header>

      {/* TOOLBAR */}
      <div className="schedule-toolbar">
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
        <div className="actions">
          <span className="week-label">Tuần 50, 2024 (09/12 - 15/12)</span>
          <button
            className="btn-publish"
            onClick={() => setIsPublished(!isPublished)}
          >
            {isPublished ? "Gỡ Lịch" : "🚀 Xuất Bản Lịch"}
          </button>
        </div>
      </div>

      {/* CALENDAR GRID */}
      <main className="calendar-area">
        <table>
          <thead>
            <tr>
              <th>Ca / Thứ</th>
              {daysLabel.map((label, idx) => (
                <th key={idx}>
                  <div className="date-col">
                    <span className="day-name">{label}</span>
                    <span className="date-num">{9 + idx}/12</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(shiftTypes).map(([shiftTypeKey, shiftConfig]) => (
              <tr key={shiftTypeKey}>
                {/* Cột Loại Ca */}
                <td>
                  <div className="shift-type-cell">
                    <span className="icon">{shiftConfig.icon}</span>
                    <span className="label">{shiftConfig.label}</span>
                    <span className="time">{shiftConfig.time}</span>
                  </div>
                </td>

                {/* Các ô lịch theo ngày */}
                {daysOfWeek.map((day) => {
                  const dayShifts = shifts.filter(
                    (s) => s.day === day && s.shiftType === shiftTypeKey
                  );
                  return (
                    <td key={day}>
                      {dayShifts.map((shift) => (
                        <ShiftCard
                          key={shift.id}
                          shift={shift}
                          staffList={staff}
                          onClick={setSelectedShift}
                        />
                      ))}

                      {/* Nút thêm nhanh */}
                      <div
                        className="add-slot-wrapper"
                        onClick={() => openAddShiftModal(day, shiftTypeKey)}
                        title="Thêm ca mới"
                      >
                        <span className="plus">+</span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </main>

      {/* MODALS INTEGRATION */}
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
    </div>
  );
};

export default ScheduleManagement;
