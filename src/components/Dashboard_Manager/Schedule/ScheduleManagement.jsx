import React, { useState, useEffect } from "react";
import Modal from "../../../components/common/Modal"; // Adjust path as needed

const ScheduleManagement = () => {
  // ===================== State =====================
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
  const resetStaffFiltersCommon = () => {
    resetAddStaffFilters();
    resetEditStaffFilters();
  };

  // Open add shift modal with pre-selected date and shift type
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

  // Open shift detail modal (EDIT)
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

  // Initialize week selector
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
        className={`mb-2 p-3 rounded-lg cursor-pointer hover:shadow-md transition-all text-xs border-l-4 ${
          isIncomplete
            ? "bg-red-50 border-red-400 hover:bg-red-100"
            : "bg-green-50 border-green-400 hover:bg-green-100"
        }`}
        onClick={() => openShiftDetailModal(shift)}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <span className="text-lg">{shiftTypes[shift.shiftType]?.icon}</span>
            <span className="font-medium text-gray-800">
              {shift.startTime}-{shift.endTime}
            </span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleShiftExpand(shift.id);
            }}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            {isExpanded ? "🔽" : "👁️"}
          </button>
        </div>

        <div className="flex items-center justify-between mb-2">
          <div className="flex space-x-1">
            {shift.essentialJobs.slice(0, 4).map((job, index) => (
              <span key={index} className="text-sm" title={getJobName(job)}>
                {getJobEmoji(job)}
              </span>
            ))}
            {shift.essentialJobs.length > 4 && (
              <span className="text-gray-400 text-xs">
                +{shift.essentialJobs.length - 4}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${
                isIncomplete
                  ? "bg-red-100 text-red-700"
                  : "bg-green-100 text-green-700"
              }`}
            >
              {shift.staffIds.length}/{shift.essentialJobs.length}
            </span>
          </div>
        </div>

        {isExpanded && (
          <div className="mt-2 pt-2 border-t border-gray-200">
            <div className="space-y-1">
              {shift.staffIds.length > 0 ? (
                shift.staffIds.map((staffId) => {
                  const person = staff.find((s) => s.id === staffId);
                  return person ? (
                    <div
                      key={staffId}
                      className="flex items-center space-x-2 text-xs bg-white p-2 rounded"
                    >
                      <span>{getJobEmoji(person.job)}</span>
                      <span className="flex-1 font-medium">{person.name}</span>
                      <span className="text-gray-500">
                        {getJobName(person.job)}
                      </span>
                    </div>
                  ) : null;
                })
              ) : (
                <div className="text-gray-400 text-center py-2">
                  Chưa có nhân viên
                </div>
              )}
              {missingJobs.length > 0 && (
                <div className="bg-red-50 p-2 rounded text-red-600 text-xs">
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
    <div className="bg-gray-50 h-full">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-blue-900">
              📅 Quản Lý Lịch Làm Việc
            </h1>
            <p className="text-sm text-gray-600">
              Phân ca và theo dõi nhân viên
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleAutoSchedule}
              disabled={isAutoScheduling}
              className={`bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2 ${
                isAutoScheduling ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              <span>{isAutoScheduling ? "⏳" : "🤖"}</span>
              <span>
                {isAutoScheduling ? "Đang phân ca..." : "Phân Ca Tự Động"}
              </span>
            </button>
          </div>
        </div>
      </header>

      <main className="h-full overflow-y-auto">
        {/* Top Filters */}
        <div className="bg-white border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <input
                type="week"
                value={filters.week}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, week: e.target.value }))
                }
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <select
                value={filters.department}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    department: e.target.value,
                  }))
                }
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Tất cả bộ phận</option>
                <option value="kitchen">Bếp</option>
                <option value="service">Phục vụ</option>
                <option value="cashier">Thu ngân</option>
                <option value="cleaning">Vệ sinh</option>
              </select>
            </div>
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center space-x-2">
                <span className="text-gray-600">Ca thiếu người:</span>
                <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full font-medium">
                  {
                    shifts.filter(
                      (s) => s.staffIds.length < s.essentialJobs.length
                    ).length
                  }
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-gray-600">Tổng ca:</span>
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">
                  {shifts.length}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Weekly calendar */}
        <div className="bg-white">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-blue-900">
              Lịch Làm Việc Tuần
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left text-blue-900 font-medium w-24">
                    Ca Làm
                  </th>
                  {"t234567cn".split("").map((_, idx) => (
                    <th
                      key={idx}
                      className="px-2 py-3 text-center text-blue-900 font-medium"
                    >
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
                  <tr key={shiftType} className="border-b border-gray-100">
                    <td className="px-3 py-4 border-r border-gray-100">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">{shiftData.icon}</span>
                        <div>
                          <div className="text-sm font-medium text-blue-900">
                            {shiftData.label}
                          </div>
                          <div className="text-xs text-gray-600">
                            {shiftData.time}
                          </div>
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
                        <td
                          key={day}
                          className="px-2 py-2 border-r border-gray-100 relative min-h-[120px] align-top"
                        >
                          {dayShifts.length > 0 ? (
                            dayShifts.map((shift) => (
                              <ShiftCard key={shift.id} shift={shift} />
                            ))
                          ) : (
                            <div
                              className="h-20 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-colors group"
                              onClick={() => openAddShiftModal(day, shiftType)}
                            >
                              <div className="text-center">
                                <div className="text-2xl text-gray-300 group-hover:text-blue-400 mb-1">
                                  +
                                </div>
                                <span className="text-xs text-gray-400 group-hover:text-blue-600">
                                  Tạo ca
                                </span>
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
        <form onSubmit={handleAddShift} className="space-y-6">
          {/* Shift Info */}
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
            <div className="flex items-center space-x-3 mb-3">
              <span className="text-2xl">
                {shiftTypes[selectedShiftType]?.icon}
              </span>
              <div>
                <h4 className="font-semibold text-blue-900">
                  {shiftTypes[selectedShiftType]?.label}
                </h4>
                <p className="text-sm text-blue-700">
                  {shiftTypes[selectedShiftType]?.time}
                </p>
              </div>
            </div>
            <div className="text-sm text-blue-800">
              <strong>Ngày:</strong>{" "}
              {selectedDate ? formatDate(selectedDate) : ""}
            </div>
          </div>

          {/* Essential Jobs Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Vị trí cần thiết cho ca này
            </label>
            <div className="grid grid-cols-2 gap-3">
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
                  className={`flex items-center space-x-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    newShift.essentialJobs.includes(job.value)
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
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
                  <span className="text-xl">{job.emoji}</span>
                  <span className="text-sm font-medium">{job.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Staff Selection with Search & Filters (ADD) */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Chọn nhân viên cho ca này
            </label>

            {/* Search & Filters */}
            <div className="space-y-3 mb-4 p-3 bg-gray-50 rounded-lg">
              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Tìm kiếm theo tên hoặc vị trí..."
                  value={addStaffSearch}
                  onChange={(e) => setAddStaffSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
                <div className="absolute left-3 top-2.5 text-gray-400">🔍</div>
                {addStaffSearch && (
                  <button
                    onClick={() => setAddStaffSearch("")}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Filter Controls */}
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={addStaffJobFilter}
                  onChange={(e) => setAddStaffJobFilter(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value="active">✅ Hoạt động</option>
                  <option value="off">🏖️ Nghỉ phép</option>
                  <option value="sick">🤒 Nghỉ ốm</option>
                </select>
              </div>

              {/* Quick buttons */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setAddStaffJobFilter("");
                    setAddStaffStatusFilter("active");
                    setAddStaffSearch("");
                  }}
                  type="button"
                  className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs hover:bg-blue-200 transition-colors"
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
                    className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs hover:bg-green-200 transition-colors flex items-center space-x-1"
                  >
                    <span>{getJobEmoji(job)}</span>
                    <span>{getJobName(job)}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Filtered list with checkboxes */}
            <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
              {(() => {
                const filtered = filterStaffByControls(staff, {
                  search: addStaffSearch,
                  job: addStaffJobFilter,
                  status: addStaffStatusFilter,
                });

                if (filtered.length === 0) {
                  return (
                    <div className="text-center py-8 text-gray-400">
                      <div className="text-2xl mb-2">🔍</div>
                      <p className="text-sm">
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
                          className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
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
                    className={`flex items-center justify-between p-3 border-b border-gray-100 last:border-b-0 cursor-pointer hover:bg-gray-50 ${
                      newShift.staffIds.includes(person.id) ? "bg-blue-50" : ""
                    }`}
                  >
                    <div className="flex items-center space-x-3">
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
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
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
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900">
                        {person.salary?.toLocaleString()}đ/h
                      </div>
                      <span
                        className={`inline-block px-2 py-1 rounded-full text-xs ${
                          person.status === "active"
                            ? "bg-green-100 text-green-800"
                            : person.status === "off"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
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
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Ghi chú (tùy chọn)
            </label>
            <textarea
              value={newShift.notes}
              onChange={(e) =>
                setNewShift((prev) => ({ ...prev, notes: e.target.value }))
              }
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Thêm ghi chú về ca làm việc này..."
            />
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => setIsAddShiftModalOpen(false)}
              className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-xl hover:bg-gray-50 transition-colors font-medium"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={newShift.essentialJobs.length === 0}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 rounded-xl transition-colors font-medium"
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
          <div className="space-y-6">
            {/* Shift Overview */}
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center space-x-3 mb-3">
                <span className="text-2xl">
                  {shiftTypes[selectedShift.shiftType]?.icon}
                </span>
                <div>
                  <h4 className="font-semibold text-gray-900">
                    {shiftTypes[selectedShift.shiftType]?.label}
                  </h4>
                  <p className="text-sm text-gray-600">
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
            <div>
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
                      <div
                        key={staffId}
                        className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg"
                      >
                        <div className="flex items-center space-x-3">
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
                          className="text-red-600 hover:text-red-800 hover:bg-red-50 p-2 rounded-lg transition-colors"
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
                  >
                    Xóa bộ lọc
                  </button>
                </div>

                {/* Search & Filter Controls */}
                <div className="space-y-3 mb-4 p-3 bg-gray-50 rounded-lg">
                  {/* Search */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Tìm kiếm theo tên hoặc vị trí..."
                      value={editStaffSearch}
                      onChange={(e) => setEditStaffSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                    <div className="absolute left-3 top-2.5 text-gray-400">
                      🔍
                    </div>
                    {editStaffSearch && (
                      <button
                        onClick={() => setEditStaffSearch("")}
                        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Filters */}
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      value={editStaffJobFilter}
                      onChange={(e) => setEditStaffJobFilter(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Tất cả trạng thái</option>
                      <option value="active">✅ Hoạt động</option>
                      <option value="off">🏖️ Nghỉ phép</option>
                      <option value="sick">🤒 Nghỉ ốm</option>
                    </select>
                  </div>

                  {/* Quick buttons */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        setEditStaffJobFilter("");
                        setEditStaffStatusFilter("active");
                        setEditStaffSearch("");
                      }}
                      className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs hover:bg-blue-200 transition-colors"
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
                        className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs hover:bg-green-200 transition-colors flex items-center space-x-1"
                      >
                        <span>{getJobEmoji(job)}</span>
                        <span>{getJobName(job)}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Filtered Staff List */}
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
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
                        <div className="text-center py-8 text-gray-400">
                          <div className="text-2xl mb-2">🔍</div>
                          <p className="text-sm">
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
                              className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
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
                        className="flex items-center justify-between p-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <span className="text-lg">
                            {getJobEmoji(person.job)}
                          </span>
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">
                              {person.name}
                            </div>
                            <div className="text-sm text-gray-500 flex items-center space-x-2">
                              <span>{getJobName(person.job)}</span>
                              <span className="text-gray-300">•</span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs ${
                                  person.status === "active"
                                    ? "bg-green-100 text-green-700"
                                    : person.status === "off"
                                    ? "bg-yellow-100 text-yellow-700"
                                    : "bg-red-100 text-red-700"
                                }`}
                              >
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
                          className="ml-3 text-green-600 hover:text-green-800 hover:bg-green-50 p-2 rounded-lg transition-colors flex-shrink-0"
                          title="Thêm vào ca"
                        >
                          ➕
                        </button>
                      </div>
                    ));
                  })()}
                </div>

                {/* Summary */}
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
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h5 className="font-medium text-blue-900 mb-2">Ghi chú</h5>
                <p className="text-sm text-blue-800">{selectedShift.notes}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-3 pt-4 border-t border-gray-200">
              <button
                onClick={() => setIsShiftDetailModalOpen(false)}
                className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-xl hover:bg-gray-50 transition-colors font-medium"
              >
                Đóng
              </button>
              <button
                onClick={() => {
                  if (confirm("Bạn có chắc chắn muốn xóa ca làm việc này?")) {
                    setShifts(shifts.filter((s) => s.id !== selectedShift.id));
                    setIsShiftDetailModalOpen(false);
                    alert("Đã xóa ca làm việc!");
                  }
                }}
                className="px-6 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl transition-colors font-medium"
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
