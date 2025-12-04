import React, { useState, useEffect } from "react";
import Modal from "../../../components/common/Modal"; // Adjust path as needed
import "./ScheduleManagement.scss"; // Import file SCSS

const ScheduleManagement = () => {
  // ===================== State (Giữ nguyên) =====================
  const [staff, setStaff] = useState([
    {
      id: 1,
      name: "Nguyễn Văn An",
      job: "chef",
      status: "active",
      salary: 35000,
    },
    {
      id: 2,
      name: "Trần Thị Bình",
      job: "waiter",
      status: "active",
      salary: 22000,
    },
    {
      id: 3,
      name: "Lê Văn Cường",
      job: "cashier",
      status: "active",
      salary: 25000,
    },
    {
      id: 4,
      name: "Phạm Thị Dung",
      job: "cleaner",
      status: "active",
      salary: 18000,
    },
    {
      id: 5,
      name: "Hoàng Văn Em",
      job: "cook",
      status: "active",
      salary: 28000,
    },
    {
      id: 6,
      name: "Vũ Thị Phương",
      job: "waiter",
      status: "off",
      salary: 22000,
    },
    {
      id: 7,
      name: "Đỗ Văn Giang",
      job: "bartender",
      status: "active",
      salary: 30000,
    },
    {
      id: 8,
      name: "Ngô Thị Hoa",
      job: "host",
      status: "active",
      salary: 24000,
    },
    { id: 9, name: "Lý Văn Khánh", job: "chef", status: "sick", salary: 35000 },
    {
      id: 10,
      name: "Trương Thị Lan",
      job: "waiter",
      status: "active",
      salary: 22000,
    },
  ]);

  const [shifts, setShifts] = useState([
    {
      id: 1,
      date: "2024-12-02",
      day: "monday",
      shiftType: "morning",
      startTime: "06:00",
      endTime: "14:00",
      essentialJobs: ["chef", "cook", "waiter"],
      staffIds: [1, 5, 2],
      notes: "Ca sáng - chuẩn bị bữa sáng và trưa",
    },
    {
      id: 2,
      date: "2024-12-02",
      day: "monday",
      shiftType: "afternoon",
      startTime: "14:00",
      endTime: "22:00",
      essentialJobs: ["waiter", "cashier", "host"],
      staffIds: [8, 3, 10],
      notes: "Ca chiều - phục vụ khách hàng",
    },
    {
      id: 3,
      date: "2024-12-03",
      day: "tuesday",
      shiftType: "morning",
      startTime: "06:00",
      endTime: "14:00",
      essentialJobs: ["chef", "waiter", "bartender"],
      staffIds: [1, 2, 7],
      notes: "Ca sáng - giờ cao điểm",
    },
  ]);

  // Predefined shift types
  const shiftTypes = {
    morning: {
      label: "Ca Sáng",
      time: "06:00-14:00",
      startTime: "06:00",
      endTime: "14:00",
      icon: "🌅",
    },
    afternoon: {
      label: "Ca Chiều",
      time: "14:00-22:00",
      startTime: "14:00",
      endTime: "22:00",
      icon: "☀️",
    },
    night: {
      label: "Ca Đêm",
      time: "22:00-06:00",
      startTime: "22:00",
      endTime: "06:00",
      icon: "🌙",
    },
  };

  const [selectedShift, setSelectedShift] = useState(null);
  const [expandedShifts, setExpandedShifts] = useState(new Set());
  const [isAddShiftModalOpen, setIsAddShiftModalOpen] = useState(false);
  const [isShiftDetailModalOpen, setIsShiftDetailModalOpen] = useState(false);
  const [isAutoScheduling, setIsAutoScheduling] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedShiftType, setSelectedShiftType] = useState("");
  const [filters, setFilters] = useState({ week: "", department: "" });

  // --------- Search & filter controls for ADD modal ---------
  const [addStaffSearch, setAddStaffSearch] = useState("");
  const [addStaffJobFilter, setAddStaffJobFilter] = useState("");
  const [addStaffStatusFilter, setAddStaffStatusFilter] = useState("active");
  const resetAddStaffFilters = () => {
    setAddStaffSearch("");
    setAddStaffJobFilter("");
    setAddStaffStatusFilter("active");
  };

  // --------- Search & filter controls for EDIT modal ---------
  const [editStaffSearch, setEditStaffSearch] = useState("");
  const [editStaffJobFilter, setEditStaffJobFilter] = useState("");
  const [editStaffStatusFilter, setEditStaffStatusFilter] = useState("active");
  const resetEditStaffFilters = () => {
    setEditStaffSearch("");
    setEditStaffJobFilter("");
    setEditStaffStatusFilter("active");
  };

  // Form state for new shift
  const [newShift, setNewShift] = useState({
    shiftType: "",
    essentialJobs: [],
    staffIds: [],
    notes: "",
  });

  // ===================== Utils =====================
  const getJobName = (job) =>
    ({
      chef: "Đầu bếp",
      cook: "Phụ bếp",
      waiter: "Phục vụ",
      cashier: "Thu ngân",
      cleaner: "Vệ sinh",
      host: "Tiếp tân",
      bartender: "Pha chế",
    }[job] || job);

  const getJobEmoji = (job) =>
    ({
      chef: "👨‍🍳",
      cook: "🍳",
      waiter: "🍽️",
      cashier: "💰",
      cleaner: "🧹",
      host: "🎯",
      bartender: "🍹",
    }[job] || "👤");

  const getStatusText = (status) =>
    ({ active: "Hoạt động", off: "Nghỉ phép", sick: "Nghỉ ốm" }[status] ||
    status);

  const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString("vi-VN");

  const getDayName = (day) =>
    ({
      monday: "Thứ 2",
      tuesday: "Thứ 3",
      wednesday: "Thứ 4",
      thursday: "Thứ 5",
      friday: "Thứ 6",
      saturday: "Thứ 7",
      sunday: "Chủ nhật",
    }[day] || day);

  const filterStaffByControls = (
    list,
    { search = "", job = "", status = "" }
  ) => {
    const q = search.trim().toLowerCase();
    return list.filter((p) => {
      if (status && p.status !== status) return false;
      if (job && p.job !== job) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        getJobName(p.job).toLowerCase().includes(q)
      );
    });
  };

  // ===================== Actions =====================
  const openAddShiftModal = (day, shiftType) => {
    const today = new Date();
    const dayIndex = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ].indexOf(day);
    const currentDayIndex = today.getDay();
    const daysUntilTarget = (dayIndex - currentDayIndex + 7) % 7;
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + daysUntilTarget);

    setSelectedDate(targetDate.toISOString().split("T")[0]);
    setSelectedShiftType(shiftType);
    setNewShift({
      shiftType: shiftType,
      essentialJobs: [],
      staffIds: [],
      notes: "",
    });
    resetAddStaffFilters();
    setIsAddShiftModalOpen(true);
  };

  const openShiftDetailModal = (shift) => {
    setSelectedShift(shift);
    resetEditStaffFilters();
    setIsShiftDetailModalOpen(true);
  };

  const toggleShiftExpand = (shiftId) => {
    const s = new Set(expandedShifts);
    s.has(shiftId) ? s.delete(shiftId) : s.add(shiftId);
    setExpandedShifts(s);
  };

  const handleAutoSchedule = async () => {
    setIsAutoScheduling(true);
    setTimeout(() => {
      setIsAutoScheduling(false);
      alert("Đã hoàn thành phân ca tự động!");
    }, 1500);
  };

  const handleAddShift = (e) => {
    e.preventDefault();
    const dayOfWeek = new Date(selectedDate).getDay();
    const dayNames = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    const shiftTypeData = shiftTypes[newShift.shiftType];

    const shiftToAdd = {
      id: shifts.length + 1,
      date: selectedDate,
      day: dayNames[dayOfWeek],
      shiftType: newShift.shiftType,
      startTime: shiftTypeData?.startTime || "",
      endTime: shiftTypeData?.endTime || "",
      essentialJobs: newShift.essentialJobs,
      staffIds: newShift.staffIds,
      notes: newShift.notes,
    };

    setShifts([...shifts, shiftToAdd]);
    setIsAddShiftModalOpen(false);
    setNewShift({ shiftType: "", essentialJobs: [], staffIds: [], notes: "" });
    alert("Đã tạo ca làm việc thành công!");
  };

  const removeStaffFromShift = (shiftId, staffId) => {
    setShifts((prev) =>
      prev.map((shift) =>
        shift.id === shiftId
          ? {
              ...shift,
              staffIds: shift.staffIds.filter((id) => id !== staffId),
            }
          : shift
      )
    );
    if (selectedShift && selectedShift.id === shiftId) {
      setSelectedShift({
        ...selectedShift,
        staffIds: selectedShift.staffIds.filter((id) => id !== staffId),
      });
    }
  };

  const addStaffToShift = (shiftId, staffId) => {
    setShifts((prev) =>
      prev.map((shift) =>
        shift.id === shiftId
          ? { ...shift, staffIds: [...shift.staffIds, staffId] }
          : shift
      )
    );
    if (selectedShift && selectedShift.id === shiftId) {
      setSelectedShift({
        ...selectedShift,
        staffIds: [...selectedShift.staffIds, staffId],
      });
    }
  };

  useEffect(() => {
    const today = new Date();
    const year = today.getFullYear();
    const week = Math.ceil((today.getDate() - today.getDay() + 1) / 7);
    setFilters((prev) => ({
      ...prev,
      week: `${year}-W${week.toString().padStart(2, "0")}`,
    }));
  }, []);

  // ===================== Components =====================
  const ShiftCard = ({ shift }) => {
    const missingJobs = shift.essentialJobs.filter(
      (job) =>
        !shift.staffIds.some((staffId) => {
          const person = staff.find((s) => s.id === staffId);
          return person && person.job === job;
        })
    );

    const isIncomplete = missingJobs.length > 0;
    const isExpanded = expandedShifts.has(shift.id);

    return (
      <div
        className={`shift-card ${isIncomplete ? "incomplete" : "complete"}`}
        onClick={() => openShiftDetailModal(shift)}
      >
        <div className="card-header">
          <div className="time-info">
            <span>{shiftTypes[shift.shiftType]?.icon}</span>
            <span>
              {shift.startTime}-{shift.endTime}
            </span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleShiftExpand(shift.id);
            }}
            className="toggle-btn"
          >
            {isExpanded ? "🔽" : "👁️"}
          </button>
        </div>

        <div className="card-body">
          <div className="jobs">
            {shift.essentialJobs.slice(0, 4).map((job, index) => (
              <span key={index} title={getJobName(job)}>
                {getJobEmoji(job)}
              </span>
            ))}
            {shift.essentialJobs.length > 4 && (
              <span className="text-gray-400">
                +{shift.essentialJobs.length - 4}
              </span>
            )}
          </div>
          <div>
            <span className="status-badge">
              {shift.staffIds.length}/{shift.essentialJobs.length}
            </span>
          </div>
        </div>

        {isExpanded && (
          <div className="card-details">
            <div className="space-y-1">
              {shift.staffIds.length > 0 ? (
                shift.staffIds.map((staffId) => {
                  const person = staff.find((s) => s.id === staffId);
                  return person ? (
                    <div key={staffId} className="staff-row">
                      <span>{getJobEmoji(person.job)}</span>
                      <span className="name">{person.name}</span>
                      <span className="job">{getJobName(person.job)}</span>
                    </div>
                  ) : null;
                })
              ) : (
                <div className="text-gray-400 text-center py-2">
                  Chưa có nhân viên
                </div>
              )}
              {missingJobs.length > 0 && (
                <div className="missing-alert">
                  <strong>Thiếu:</strong>{" "}
                  {missingJobs.map((job) => getJobName(job)).join(", ")}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ===================== Render =====================
  return (
    <div className="schedule-container">
      {/* Header */}
      <header className="schedule-header">
        <div className="header-content">
          <div>
            <h1>📅 Quản Lý Lịch Làm Việc</h1>
            <p>Phân ca và theo dõi nhân viên</p>
          </div>
          <div>
            <button
              onClick={handleAutoSchedule}
              disabled={isAutoScheduling}
              className="btn-auto-schedule"
            >
              <span>{isAutoScheduling ? "⏳" : "🤖"}</span>
              <span>
                {isAutoScheduling ? "Đang phân ca..." : "Phân Ca Tự Động"}
              </span>
            </button>
          </div>
        </div>
      </header>

      <main className="schedule-main">
        {/* Top Filters */}
        <div className="filter-bar">
          <div className="filter-content">
            <div className="controls">
              <input
                type="week"
                value={filters.week}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, week: e.target.value }))
                }
              />
              <select
                value={filters.department}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    department: e.target.value,
                  }))
                }
              >
                <option value="">Tất cả bộ phận</option>
                <option value="kitchen">Bếp</option>
                <option value="service">Phục vụ</option>
                <option value="cashier">Thu ngân</option>
                <option value="cleaning">Vệ sinh</option>
              </select>
            </div>
            <div className="stats">
              <div className="stat-item">
                <span>Ca thiếu người:</span>
                <span className="badge red">
                  {
                    shifts.filter(
                      (s) => s.staffIds.length < s.essentialJobs.length
                    ).length
                  }
                </span>
              </div>
              <div className="stat-item">
                <span>Tổng ca:</span>
                <span className="badge blue">{shifts.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Weekly calendar */}
        <div className="calendar-wrapper">
          <div className="">
            <h3>Lịch Làm Việc Tuần</h3>
          </div>
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Ca Làm</th>
                  {"t234567cn".split("").map((_, idx) => (
                    <th key={idx}>
                      {idx === 0
                        ? "T2"
                        : idx === 1
                        ? "T3"
                        : idx === 2
                        ? "T4"
                        : idx === 3
                        ? "T5"
                        : idx === 4
                        ? "T6"
                        : idx === 5
                        ? "T7"
                        : "CN"}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(shiftTypes).map(([shiftType, shiftData]) => (
                  <tr key={shiftType}>
                    <td>
                      <div className="shift-type-header">
                        <span className="icon">{shiftData.icon}</span>
                        <div>
                          <div className="label">{shiftData.label}</div>
                          <div className="time">{shiftData.time}</div>
                        </div>
                      </div>
                    </td>
                    {[
                      "monday",
                      "tuesday",
                      "wednesday",
                      "thursday",
                      "friday",
                      "saturday",
                      "sunday",
                    ].map((day) => {
                      const dayShifts = shifts.filter(
                        (shift) =>
                          shift.day === day && shift.shiftType === shiftType
                      );
                      return (
                        <td key={day}>
                          {dayShifts.length > 0 ? (
                            dayShifts.map((shift) => (
                              <ShiftCard key={shift.id} shift={shift} />
                            ))
                          ) : (
                            <div
                              className="add-slot-btn"
                              onClick={() => openAddShiftModal(day, shiftType)}
                            >
                              <div className="text-center">
                                <div className="plus">+</div>
                                <span className="text">Tạo ca</span>
                              </div>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* ===================== Add Shift Modal ===================== */}
      <Modal
        isOpen={isAddShiftModalOpen}
        onClose={() => setIsAddShiftModalOpen(false)}
        title={`Tạo ${shiftTypes[selectedShiftType]?.label || "ca"} - ${
          selectedDate ? formatDate(selectedDate) : ""
        }`}
      >
        <form onSubmit={handleAddShift}>
          {/* Shift Info */}
          <div className="shift-summary-box">
            <div className="header">
              <span className="icon">
                {shiftTypes[selectedShiftType]?.icon}
              </span>
              <div>
                <h4>{shiftTypes[selectedShiftType]?.label}</h4>
                <p>{shiftTypes[selectedShiftType]?.time}</p>
              </div>
            </div>
            <div className="date">
              <strong>Ngày:</strong>{" "}
              {selectedDate ? formatDate(selectedDate) : ""}
            </div>
          </div>

          {/* Essential Jobs Selection */}
          <div className="form-section">
            <label>Vị trí cần thiết cho ca này</label>
            <div className="job-selection-grid">
              {[
                { value: "chef", label: "Đầu bếp", emoji: "👨‍🍳" },
                { value: "cook", label: "Phụ bếp", emoji: "🍳" },
                { value: "waiter", label: "Phục vụ", emoji: "🍽️" },
                { value: "cashier", label: "Thu ngân", emoji: "💰" },
                { value: "cleaner", label: "Vệ sinh", emoji: "🧹" },
                { value: "host", label: "Tiếp tân", emoji: "🎯" },
                { value: "bartender", label: "Pha chế", emoji: "🍹" },
              ].map((job) => (
                <label
                  key={job.value}
                  className={`job-checkbox ${
                    newShift.essentialJobs.includes(job.value) ? "selected" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    value={job.value}
                    checked={newShift.essentialJobs.includes(job.value)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setNewShift((prev) => ({
                          ...prev,
                          essentialJobs: [...prev.essentialJobs, job.value],
                        }));
                      } else {
                        setNewShift((prev) => ({
                          ...prev,
                          essentialJobs: prev.essentialJobs.filter(
                            (j) => j !== job.value
                          ),
                        }));
                      }
                    }}
                    className="sr-only"
                  />
                  <span className="emoji">{job.emoji}</span>
                  <span className="label">{job.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Staff Selection with Search & Filters (ADD) */}
          <div className="form-section">
            <label>Chọn nhân viên cho ca này</label>

            {/* Search & Filters */}
            <div className="search-filter-box">
              <div className="search-input-wrapper">
                <input
                  type="text"
                  placeholder="Tìm kiếm theo tên hoặc vị trí..."
                  value={addStaffSearch}
                  onChange={(e) => setAddStaffSearch(e.target.value)}
                />
                <div className="icon-search">🔍</div>
                {addStaffSearch && (
                  <button
                    onClick={() => setAddStaffSearch("")}
                    className="btn-clear"
                    type="button"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="filters-row">
                <select
                  value={addStaffJobFilter}
                  onChange={(e) => setAddStaffJobFilter(e.target.value)}
                >
                  <option value="">Tất cả vị trí</option>
                  <option value="chef">👨‍🍳 Đầu bếp</option>
                  <option value="cook">🍳 Phụ bếp</option>
                  <option value="waiter">🍽️ Phục vụ</option>
                  <option value="cashier">💰 Thu ngân</option>
                  <option value="cleaner">🧹 Vệ sinh</option>
                  <option value="host">🎯 Tiếp tân</option>
                  <option value="bartender">🍹 Pha chế</option>
                </select>
                <select
                  value={addStaffStatusFilter}
                  onChange={(e) => setAddStaffStatusFilter(e.target.value)}
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value="active">✅ Hoạt động</option>
                  <option value="off">🏖️ Nghỉ phép</option>
                  <option value="sick">🤒 Nghỉ ốm</option>
                </select>
              </div>

              <div className="tags-row">
                <button
                  onClick={() => {
                    setAddStaffJobFilter("");
                    setAddStaffStatusFilter("active");
                    setAddStaffSearch("");
                  }}
                  type="button"
                  className="tag-blue"
                >
                  Tất cả nhân viên
                </button>
                {newShift.essentialJobs.map((job) => (
                  <button
                    key={job}
                    type="button"
                    onClick={() => {
                      setAddStaffJobFilter(job);
                      setAddStaffStatusFilter("active");
                    }}
                    className="tag-green"
                  >
                    <span>{getJobEmoji(job)}</span>
                    <span>{getJobName(job)}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Filtered list with checkboxes */}
            <div className="staff-list-container">
              {(() => {
                const filtered = filterStaffByControls(staff, {
                  search: addStaffSearch,
                  job: addStaffJobFilter,
                  status: addStaffStatusFilter,
                });

                if (filtered.length === 0) {
                  return (
                    <div className="empty-state">
                      <div className="icon">🔍</div>
                      <p>
                        {addStaffSearch ||
                        addStaffJobFilter ||
                        (addStaffStatusFilter &&
                          addStaffStatusFilter !== "active")
                          ? "Không tìm thấy nhân viên phù hợp"
                          : "Không có nhân viên để hiển thị"}
                      </p>
                      {(addStaffSearch ||
                        addStaffJobFilter ||
                        (addStaffStatusFilter &&
                          addStaffStatusFilter !== "active")) && (
                        <button
                          onClick={resetAddStaffFilters}
                          type="button"
                          className="reset-link"
                        >
                          Xóa bộ lọc
                        </button>
                      )}
                    </div>
                  );
                }

                return filtered.map((person) => (
                  <label
                    key={person.id}
                    className={`staff-item ${
                      newShift.staffIds.includes(person.id) ? "selected" : ""
                    }`}
                  >
                    <div className="info-left">
                      <input
                        type="checkbox"
                        value={person.id}
                        checked={newShift.staffIds.includes(person.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewShift((prev) => ({
                              ...prev,
                              staffIds: [...prev.staffIds, person.id],
                            }));
                          } else {
                            setNewShift((prev) => ({
                              ...prev,
                              staffIds: prev.staffIds.filter(
                                (id) => id !== person.id
                              ),
                            }));
                          }
                        }}
                      />
                      <span className="text-lg">{getJobEmoji(person.job)}</span>
                      <div>
                        <div className="font-medium text-gray-900">
                          {person.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {getJobName(person.job)}
                        </div>
                      </div>
                    </div>
                    <div className="info-right">
                      <div className="salary">
                        {person.salary?.toLocaleString()}đ/h
                      </div>
                      <span className={`status ${person.status}`}>
                        {getStatusText(person.status)}
                      </span>
                    </div>
                  </label>
                ));
              })()}
            </div>

            {/* Summary */}
            <div className="mt-3 text-xs text-gray-500 flex items-center justify-between">
              <span>
                Hiển thị{" "}
                {
                  filterStaffByControls(staff, {
                    search: addStaffSearch,
                    job: addStaffJobFilter,
                    status: addStaffStatusFilter,
                  }).length
                }{" "}
                nhân viên
              </span>
              {newShift.essentialJobs.length > 0 && (
                <span className="text-blue-600">
                  Cần:{" "}
                  {newShift.essentialJobs
                    .map((job) => getJobEmoji(job))
                    .join(" ")}
                </span>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="form-section">
            <label>Ghi chú (tùy chọn)</label>
            <textarea
              value={newShift.notes}
              onChange={(e) =>
                setNewShift((prev) => ({ ...prev, notes: e.target.value }))
              }
              rows={3}
              className="notes-textarea"
              placeholder="Thêm ghi chú về ca làm việc này..."
            />
          </div>

          {/* Action Buttons */}
          <div className="modal-actions">
            <button
              type="button"
              onClick={() => setIsAddShiftModalOpen(false)}
              className="btn-cancel"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={newShift.essentialJobs.length === 0}
              className="btn-confirm"
            >
              Tạo Ca Làm Việc
            </button>
          </div>
        </form>
      </Modal>

      {/* ===================== Shift Detail Modal (EDIT) ===================== */}
      <Modal
        isOpen={isShiftDetailModalOpen}
        onClose={() => setIsShiftDetailModalOpen(false)}
        title={
          selectedShift
            ? `${shiftTypes[selectedShift.shiftType]?.label} - ${formatDate(
                selectedShift.date
              )}`
            : ""
        }
      >
        {selectedShift && (
          <div>
            {/* Shift Overview */}
            <div
              className="shift-summary-box"
              style={{ background: "#f9fafb", borderColor: "#e5e7eb" }}
            >
              <div className="header">
                <span className="icon">
                  {shiftTypes[selectedShift.shiftType]?.icon}
                </span>
                <div>
                  <h4 style={{ color: "#111827" }}>
                    {shiftTypes[selectedShift.shiftType]?.label}
                  </h4>
                  <p style={{ color: "#4b5563" }}>
                    {selectedShift.startTime} - {selectedShift.endTime}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Ngày:</span>
                  <span className="ml-2 font-medium">
                    {formatDate(selectedShift.date)} (
                    {getDayName(selectedShift.day)})
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Trạng thái:</span>
                  <span
                    className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                      selectedShift.staffIds.length <
                      selectedShift.essentialJobs.length
                        ? "bg-red-100 text-red-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {selectedShift.staffIds.length <
                    selectedShift.essentialJobs.length
                      ? "⚠️ Thiếu nhân viên"
                      : "✅ Đầy đủ"}
                  </span>
                </div>
              </div>
            </div>

            {/* Current Staff */}
            <div className="form-section">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-gray-900">
                  Nhân viên trong ca ({selectedShift.staffIds.length}/
                  {selectedShift.essentialJobs.length})
                </h4>
              </div>

              <div className="space-y-2 mb-6">
                {selectedShift.staffIds.length > 0 ? (
                  selectedShift.staffIds.map((staffId) => {
                    const person = staff.find((s) => s.id === staffId);
                    return person ? (
                      <div key={staffId} className="edit-staff-row">
                        <div className="info-left">
                          <span className="text-lg">
                            {getJobEmoji(person.job)}
                          </span>
                          <div>
                            <div className="font-medium text-gray-900">
                              {person.name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {getJobName(person.job)}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            removeStaffFromShift(selectedShift.id, staffId)
                          }
                          className="btn-remove"
                          title="Xóa khỏi ca"
                        >
                          🗑️
                        </button>
                      </div>
                    ) : null;
                  })
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <div className="text-3xl mb-2">👥</div>
                    <p>Chưa có nhân viên nào trong ca này</p>
                  </div>
                )}
              </div>

              {/* Available Staff to Add (with Search & Filters) */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h5 className="font-medium text-gray-900">
                    Thêm nhân viên vào ca
                  </h5>
                  <button
                    onClick={resetEditStaffFilters}
                    className="text-sm text-blue-600 hover:text-blue-800"
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    Xóa bộ lọc
                  </button>
                </div>

                {/* Search & Filter Controls */}
                <div className="search-filter-box">
                  <div className="search-input-wrapper">
                    <input
                      type="text"
                      placeholder="Tìm kiếm theo tên hoặc vị trí..."
                      value={editStaffSearch}
                      onChange={(e) => setEditStaffSearch(e.target.value)}
                    />
                    <div className="icon-search">🔍</div>
                    {editStaffSearch && (
                      <button
                        onClick={() => setEditStaffSearch("")}
                        className="btn-clear"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <div className="filters-row">
                    <select
                      value={editStaffJobFilter}
                      onChange={(e) => setEditStaffJobFilter(e.target.value)}
                    >
                      <option value="">Tất cả vị trí</option>
                      <option value="chef">👨‍🍳 Đầu bếp</option>
                      <option value="cook">🍳 Phụ bếp</option>
                      <option value="waiter">🍽️ Phục vụ</option>
                      <option value="cashier">💰 Thu ngân</option>
                      <option value="cleaner">🧹 Vệ sinh</option>
                      <option value="host">🎯 Tiếp tân</option>
                      <option value="bartender">🍹 Pha chế</option>
                    </select>

                    <select
                      value={editStaffStatusFilter}
                      onChange={(e) => setEditStaffStatusFilter(e.target.value)}
                    >
                      <option value="">Tất cả trạng thái</option>
                      <option value="active">✅ Hoạt động</option>
                      <option value="off">🏖️ Nghỉ phép</option>
                      <option value="sick">🤒 Nghỉ ốm</option>
                    </select>
                  </div>

                  <div className="tags-row">
                    <button
                      onClick={() => {
                        setEditStaffJobFilter("");
                        setEditStaffStatusFilter("active");
                        setEditStaffSearch("");
                      }}
                      className="tag-blue"
                    >
                      Tất cả nhân viên
                    </button>
                    {selectedShift.essentialJobs.map((job) => (
                      <button
                        key={job}
                        onClick={() => {
                          setEditStaffJobFilter(job);
                          setEditStaffStatusFilter("active");
                        }}
                        className="tag-green"
                      >
                        <span>{getJobEmoji(job)}</span>
                        <span>{getJobName(job)}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Filtered Staff List */}
                <div className="staff-list-container">
                  {(() => {
                    const candidates = staff.filter(
                      (s) => !selectedShift.staffIds.includes(s.id)
                    );
                    const filtered = filterStaffByControls(candidates, {
                      search: editStaffSearch,
                      job: editStaffJobFilter,
                      status: editStaffStatusFilter,
                    });

                    if (filtered.length === 0) {
                      return (
                        <div className="empty-state">
                          <div className="icon">🔍</div>
                          <p>
                            {editStaffSearch ||
                            editStaffJobFilter ||
                            (editStaffStatusFilter &&
                              editStaffStatusFilter !== "active")
                              ? "Không tìm thấy nhân viên phù hợp"
                              : "Tất cả nhân viên đã được phân công"}
                          </p>
                          {(editStaffSearch ||
                            editStaffJobFilter ||
                            (editStaffStatusFilter &&
                              editStaffStatusFilter !== "active")) && (
                            <button
                              onClick={resetEditStaffFilters}
                              className="reset-link"
                            >
                              Xóa bộ lọc
                            </button>
                          )}
                        </div>
                      );
                    }

                    return filtered.map((person) => (
                      <div
                        key={person.id}
                        className="edit-staff-row hover:bg-gray-50"
                      >
                        <div className="info-left">
                          <span className="text-lg">
                            {getJobEmoji(person.job)}
                          </span>
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">
                              {person.name}
                            </div>
                            <div className="text-sm text-gray-500 flex items-center gap-2">
                              <span>{getJobName(person.job)}</span>
                              <span className="text-gray-300">•</span>
                              <span className={`status ${person.status}`}>
                                {getStatusText(person.status)}
                              </span>
                            </div>
                          </div>
                          <div className="text-right text-sm">
                            <div className="font-medium text-gray-900">
                              {person.salary?.toLocaleString()}đ/h
                            </div>
                            {selectedShift.essentialJobs.includes(
                              person.job
                            ) && (
                              <div className="text-xs text-green-600 font-medium">
                                ⭐ Cần thiết
                              </div>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            addStaffToShift(selectedShift.id, person.id)
                          }
                          className="btn-add"
                          title="Thêm vào ca"
                        >
                          ➕
                        </button>
                      </div>
                    ));
                  })()}
                </div>

                <div className="mt-3 text-xs text-gray-500 flex items-center justify-between">
                  <span>
                    Hiển thị{" "}
                    {
                      filterStaffByControls(
                        staff.filter(
                          (s) => !selectedShift.staffIds.includes(s.id)
                        ),
                        {
                          search: editStaffSearch,
                          job: editStaffJobFilter,
                          status: editStaffStatusFilter,
                        }
                      ).length
                    }{" "}
                    nhân viên
                  </span>
                  {selectedShift.essentialJobs.length > 0 && (
                    <span className="text-blue-600">
                      Cần:{" "}
                      {selectedShift.essentialJobs
                        .map((job) => getJobEmoji(job))
                        .join(" ")}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Notes */}
            {selectedShift.notes && (
              <div className="shift-summary-box mt-4">
                <h5
                  style={{
                    fontWeight: 500,
                    color: "#1e3a8a",
                    marginBottom: "0.5rem",
                  }}
                >
                  Ghi chú
                </h5>
                <p
                  style={{ fontSize: "0.875rem", color: "#1e40af", margin: 0 }}
                >
                  {selectedShift.notes}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="modal-actions">
              <button
                onClick={() => setIsShiftDetailModalOpen(false)}
                className="btn-cancel"
              >
                Đóng
              </button>
              <button
                onClick={() => {
                  if (
                    window.confirm("Bạn có chắc chắn muốn xóa ca làm việc này?")
                  ) {
                    setShifts(shifts.filter((s) => s.id !== selectedShift.id));
                    setIsShiftDetailModalOpen(false);
                    alert("Đã xóa ca làm việc!");
                  }
                }}
                className="btn-delete"
              >
                Xóa Ca
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ScheduleManagement;
