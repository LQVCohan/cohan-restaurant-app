import React, { useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addDays,
  addWeeks,
  addMonths,
  subDays,
  subWeeks,
  subMonths,
  isSameDay,
} from "date-fns";
import { vi } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";

import "./ScheduleManagement.scss";
import { shiftTypes } from "./utils/scheduleHelpers";
import ShiftCard from "./components/ShiftCard";
import AddShiftModal from "./components/AddShiftModal";
import ShiftDetailModal from "./components/ShiftDetailModal";
import DailyView from "./DailyView";

const ME_QUERY = gql`
  query Me {
    me {
      id
      roleName
      restaurantForStaff
      refRestaurants {
        id
        name
      }
    }
  }
`;

const GET_ALL_RESTAURANTS = gql`
  query AllRestaurants($limit: Int = 100, $cursor: ID) {
    restaurants(limit: $limit, cursor: $cursor) {
      edges {
        node {
          id
          name
        }
      }
    }
  }
`;

const GET_STAFF_LIST = gql`
  query StaffList($restaurantId: ID, $search: String) {
    staffList(restaurantId: $restaurantId, search: $search) {
      id
      fullName
      department
      employmentStatus
      baseSalary
    }
  }
`;

const GET_STAFF_SHIFTS = gql`
  query StaffShifts(
    $restaurantId: ID
    $employeeId: ID
    $startDate: DateTime
    $endDate: DateTime
    $status: String
  ) {
    staffShifts(
      restaurantId: $restaurantId
      employeeId: $employeeId
      startDate: $startDate
      endDate: $endDate
      status: $status
      limit: 1000
    ) {
      id
      employeeId
      employeeName
      restaurantId
      shiftType
      startTime
      endTime
      status
      notes
    }
  }
`;

const CREATE_STAFF_SHIFT = gql`
  mutation CreateStaffShift($input: CreateStaffShiftInput!) {
    createStaffShift(input: $input) {
      id
    }
  }
`;

const UPDATE_STAFF_SHIFT = gql`
  mutation UpdateStaffShift($shiftId: ID!, $input: UpdateStaffShiftInput!) {
    updateStaffShift(shiftId: $shiftId, input: $input) {
      id
      notes
      status
    }
  }
`;

const DELETE_STAFF_SHIFT = gql`
  mutation DeleteStaffShift($shiftId: ID!) {
    deleteStaffShift(shiftId: $shiftId)
  }
`;

const mapDepartmentToJob = (department) =>
  ({
    management: "host",
    kitchen: "cook",
    service: "waiter",
    cashier: "cashier",
    cleaning: "cleaner",
    delivery: "waiter",
  }[String(department || "").toLowerCase()] || "waiter");

const normalizeTime = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : format(date, "HH:mm");
};

const ScheduleManagement = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("week");
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addModalContext, setAddModalContext] = useState({
    date: "",
    shiftType: "",
  });
  const [selectedShift, setSelectedShift] = useState(null);

  const { data: meData } = useQuery(ME_QUERY, { fetchPolicy: "network-only" });
  const me = meData?.me;

  const { data: allRestaurantsData } = useQuery(GET_ALL_RESTAURANTS, {
    variables: { limit: 100 },
    skip: me?.roleName !== "admin",
    fetchPolicy: "network-only",
  });

  const restaurantOptions = useMemo(() => {
    if (me?.roleName === "admin") {
      return (allRestaurantsData?.restaurants?.edges || []).map((edge) => edge.node);
    }
    return (me?.refRestaurants || []).map((r) => ({ id: r.id, name: r.name }));
  }, [allRestaurantsData, me]);

  const effectiveRestaurantId = selectedRestaurantId || me?.restaurantForStaff || restaurantOptions[0]?.id || "";
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const rangeStart =
    viewMode === "week" ? weekStart : viewMode === "month" ? monthStart : currentDate;
  const rangeEnd =
    viewMode === "week" ? weekEnd : viewMode === "month" ? monthEnd : currentDate;

  const { data: staffData, loading: staffLoading } = useQuery(GET_STAFF_LIST, {
    variables: { restaurantId: effectiveRestaurantId || undefined },
    fetchPolicy: "network-only",
    skip: !effectiveRestaurantId,
  });
  const { data: shiftsData, loading: shiftsLoading, error: shiftsError, refetch } = useQuery(
    GET_STAFF_SHIFTS,
    {
      variables: {
        restaurantId: effectiveRestaurantId || undefined,
        employeeId: selectedStaffId || undefined,
        startDate: rangeStart.toISOString(),
        endDate: rangeEnd.toISOString(),
      },
      fetchPolicy: "network-only",
      skip: !effectiveRestaurantId,
    },
  );

  const [createShift] = useMutation(CREATE_STAFF_SHIFT);
  const [updateShift] = useMutation(UPDATE_STAFF_SHIFT);
  const [deleteShift] = useMutation(DELETE_STAFF_SHIFT);

  const staff = useMemo(
    () =>
      (staffData?.staffList || []).map((item) => ({
        id: item.id,
        name: item.fullName || "Nhân viên",
        job: mapDepartmentToJob(item.department),
        status: item.employmentStatus === "working" ? "active" : "off",
        salary: Number(item.baseSalary || 0) / 26 / 8,
      })),
    [staffData],
  );

  const shifts = useMemo(() => {
    const rows = shiftsData?.staffShifts || [];
    const map = new Map();
    rows.forEach((row) => {
      const date = format(new Date(row.startTime), "yyyy-MM-dd");
      const key = `${date}|${row.shiftType}`;
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          date,
          day: format(new Date(row.startTime), "EEEE").toLowerCase(),
          shiftType: row.shiftType,
          startTime: normalizeTime(row.startTime),
          endTime: normalizeTime(row.endTime),
          essentialJobs: [],
          staffIds: [],
          notes: row.notes || "",
          records: [],
        });
      }
      const bucket = map.get(key);
      bucket.records.push(row);
      bucket.staffIds.push(row.employeeId);
      const staffItem = staff.find((s) => String(s.id) === String(row.employeeId));
      if (staffItem?.job && !bucket.essentialJobs.includes(staffItem.job)) {
        bucket.essentialJobs.push(staffItem.job);
      }
    });
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [shiftsData, staff]);

  const dateLabel = useMemo(() => {
    if (viewMode === "week") {
      return `Tuần ${format(weekStart, "w")}, ${format(weekStart, "yyyy")} (${format(
        weekStart,
        "dd/MM",
      )} - ${format(weekEnd, "dd/MM")})`;
    }
    if (viewMode === "month") {
      return `Tháng ${format(currentDate, "MM/yyyy")}`;
    }
    return format(currentDate, "EEEE, dd/MM/yyyy", { locale: vi });
  }, [currentDate, viewMode, weekEnd, weekStart]);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );

  const kpis = useMemo(() => {
    const totalShifts = shifts.length;
    const alertShifts = shifts.filter(
      (s) => s.staffIds.length < Math.max(1, s.essentialJobs.length),
    ).length;
    const totalCost = shifts.reduce((sum, shift) => {
      const shiftCost = shift.staffIds.reduce((acc, staffId) => {
        const person = staff.find((item) => String(item.id) === String(staffId));
        return acc + (person ? person.salary * 8 : 0);
      }, 0);
      return sum + shiftCost;
    }, 0);
    return { totalShifts, alertShifts, totalCost };
  }, [shifts, staff]);

  const handleNavigate = (direction) => {
    if (viewMode === "week") {
      setCurrentDate((prev) => (direction === "next" ? addWeeks(prev, 1) : subWeeks(prev, 1)));
    } else if (viewMode === "month") {
      setCurrentDate((prev) => (direction === "next" ? addMonths(prev, 1) : subMonths(prev, 1)));
    } else {
      setCurrentDate((prev) => (direction === "next" ? addDays(prev, 1) : subDays(prev, 1)));
    }
  };

  const openAddShiftModal = (dateObj, shiftType) => {
    setAddModalContext({ date: format(dateObj, "yyyy-MM-dd"), shiftType });
    setIsAddModalOpen(true);
  };

  const handleCreateShift = async (newShiftData) => {
    const config = shiftTypes[newShiftData.shiftType];
    if (!config || !effectiveRestaurantId) return;
    const [year, month, day] = newShiftData.date.split("-").map(Number);
    const [startHour, startMin] = config.startTime.split(":").map(Number);
    const [endHour, endMin] = config.endTime.split(":").map(Number);

    const startTime = new Date(year, month - 1, day, startHour, startMin, 0, 0);
    const endTime = new Date(year, month - 1, day, endHour, endMin, 0, 0);
    if (endTime <= startTime) endTime.setDate(endTime.getDate() + 1);

    await Promise.all(
      (newShiftData.staffIds || []).map((employeeId) =>
        createShift({
          variables: {
            input: {
              employeeId,
              restaurantId: effectiveRestaurantId,
              shiftType: newShiftData.shiftType.toUpperCase(),
              startTime: startTime.toISOString(),
              endTime: endTime.toISOString(),
              status: "scheduled",
              notes: newShiftData.notes || "",
            },
          },
        }),
      ),
    );
    await refetch();
    setIsAddModalOpen(false);
  };

  const handleDeleteShift = async (shiftGroupId) => {
    const found = shifts.find((item) => item.id === shiftGroupId);
    if (!found) return;
    await Promise.all(found.records.map((row) => deleteShift({ variables: { shiftId: row.id } })));
    await refetch();
    setSelectedShift(null);
  };

  const handleRemoveStaff = async (shiftGroupId, staffId) => {
    const found = shifts.find((item) => item.id === shiftGroupId);
    const targetRecord = found?.records?.find((record) => String(record.employeeId) === String(staffId));
    if (!targetRecord) return;
    await deleteShift({ variables: { shiftId: targetRecord.id } });
    await refetch();
    setSelectedShift(null);
  };

  const handleAddStaff = async (shiftGroupId, staffId) => {
    const found = shifts.find((item) => item.id === shiftGroupId);
    if (!found || !effectiveRestaurantId) return;
    if (found.staffIds.includes(staffId)) return;

    const [year, month, day] = found.date.split("-").map(Number);
    const [startHour, startMin] = found.startTime.split(":").map(Number);
    const [endHour, endMin] = found.endTime.split(":").map(Number);
    const startTime = new Date(year, month - 1, day, startHour, startMin, 0, 0);
    const endTime = new Date(year, month - 1, day, endHour, endMin, 0, 0);
    if (endTime <= startTime) endTime.setDate(endTime.getDate() + 1);

    await createShift({
      variables: {
        input: {
          employeeId: staffId,
          restaurantId: effectiveRestaurantId,
          shiftType: found.shiftType.toUpperCase(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          status: "scheduled",
          notes: found.notes || "",
        },
      },
    });
    await refetch();
    setSelectedShift(null);
  };

  const handleUpdateSelectedNotes = async (notes) => {
    if (!selectedShift?.records?.length) return;
    await Promise.all(
      selectedShift.records.map((record) =>
        updateShift({ variables: { shiftId: record.id, input: { notes } } }),
      ),
    );
    await refetch();
  };

  return (
    <div className="schedule-container">
      <header className="schedule-header">
        <div className="header-top">
          <div className="title-group">
            <h1>Quản Lý Lịch Làm Việc</h1>
            <p className="subtitle">Lịch ca theo dữ liệu thật từ backend</p>
          </div>
          <div className="user-profile">
            <div className="user-info">
              <span className="name">{me?.roleName || "manager"}</span>
              <span className="role">Schedule Control</span>
            </div>
          </div>
        </div>

        <div className="kpi-grid">
          <div className="kpi-card money">
            <div className="kpi-icon">💰</div>
            <div className="kpi-content">
              <span className="label">Chi phí kỳ hiển thị</span>
              <span className="value">{Math.round(kpis.totalCost).toLocaleString()} đ</span>
            </div>
          </div>
          <div className="kpi-card shifts">
            <div className="kpi-icon">📅</div>
            <div className="kpi-content">
              <span className="label">Nhóm ca</span>
              <span className="value">{kpis.totalShifts}</span>
            </div>
          </div>
          <div className={`kpi-card alerts ${kpis.alertShifts > 0 ? "has-alert" : ""}`}>
            <div className="kpi-icon">⚠️</div>
            <div className="kpi-content">
              <span className="label">Thiếu người</span>
              <span className="value">{kpis.alertShifts}</span>
            </div>
          </div>
          <div className="kpi-card status">
            <div className="kpi-icon">{isPublished ? "✅" : "📝"}</div>
            <div className="kpi-content">
              <span className="label">Trạng thái</span>
              <span className={`value ${isPublished ? "published" : "draft"}`}>
                {isPublished ? "Đã xuất bản" : "Bản nháp"}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="schedule-toolbar">
        <div className="toolbar-left">
          <div className="view-toggles">
            <button className={viewMode === "week" ? "active" : ""} onClick={() => setViewMode("week")}>
              Theo Tuần
            </button>
            <button className={viewMode === "day" ? "active" : ""} onClick={() => setViewMode("day")}>
              Theo Ngày
            </button>
            <button className={viewMode === "month" ? "active" : ""} onClick={() => setViewMode("month")}>
              Theo Tháng
            </button>
          </div>

          <div className="date-navigation" style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 16 }}>
            <button onClick={() => handleNavigate("prev")} className="nav-btn"><ChevronLeft size={20} /></button>
            <span className="week-label">{dateLabel}</span>
            <button onClick={() => handleNavigate("next")} className="nav-btn"><ChevronRight size={20} /></button>
          </div>
        </div>
        <div className="toolbar-right">
          <select value={selectedRestaurantId} onChange={(e) => setSelectedRestaurantId(e.target.value)}>
            <option value="">Nhà hàng hiện tại</option>
            {restaurantOptions.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <select value={selectedStaffId} onChange={(e) => setSelectedStaffId(e.target.value)}>
            <option value="">Tất cả nhân viên</option>
            {staff.map((person) => (
              <option key={person.id} value={person.id}>{person.name}</option>
            ))}
          </select>
          <button onClick={() => setIsPublished((prev) => !prev)}>
            {isPublished ? "Chuyển về nháp" : "Xuất bản"}
          </button>
        </div>
      </div>

      {shiftsError ? (
        <div className="empty-state" style={{ marginTop: 20 }}>Không tải được lịch làm việc.</div>
      ) : viewMode === "day" ? (
        <DailyView currentDate={currentDate} shifts={shifts} staffList={staff} />
      ) : viewMode === "month" ? (
        <div className="schedule-board">
          {Array.from({ length: 42 }, (_, index) => addDays(startOfWeek(monthStart, { weekStartsOn: 1 }), index)).map((day) => {
            const dayStr = format(day, "yyyy-MM-dd");
            const shiftsForDay = shifts.filter((shift) => shift.date === dayStr);
            return (
              <div className="schedule-day-column" key={dayStr}>
                <div className={`day-header ${isSameDay(day, new Date()) ? "today" : ""}`}>
                  <span>{format(day, "EEE", { locale: vi })}</span>
                  <strong>{format(day, "dd/MM")}</strong>
                </div>
                <div className="day-body">
                  <div className="add-shift-btn" style={{ cursor: "default" }}>
                    {shiftsForDay.length} ca
                  </div>
                  {shiftsForDay.slice(0, 2).map((shift) => (
                    <ShiftCard key={shift.id} shift={shift} staffList={staff} onClick={setSelectedShift} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="schedule-board">
          {weekDays.map((day) => {
            const dayStr = format(day, "yyyy-MM-dd");
            const shiftsForDay = shifts.filter((shift) => shift.date === dayStr);
            return (
              <div className="schedule-day-column" key={dayStr}>
                <div className={`day-header ${isSameDay(day, new Date()) ? "today" : ""}`}>
                  <span>{format(day, "EEE", { locale: vi })}</span>
                  <strong>{format(day, "dd/MM")}</strong>
                </div>
                <div className="day-body">
                  {Object.keys(shiftTypes).map((type) => {
                    const shift = shiftsForDay.find((item) => item.shiftType === type);
                    return (
                      <div key={type} className="shift-slot">
                        {shift ? (
                          <ShiftCard shift={shift} staffList={staff} onClick={setSelectedShift} />
                        ) : (
                          <button className="add-shift-btn" onClick={() => openAddShiftModal(day, type)}>
                            + {shiftTypes[type].label}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(staffLoading || shiftsLoading) && (
        <div className="empty-state" style={{ marginTop: 12 }}>Đang tải dữ liệu lịch làm việc...</div>
      )}

      <AddShiftModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        selectedDate={addModalContext.date}
        selectedShiftType={addModalContext.shiftType}
        staffList={staff}
        onConfirm={handleCreateShift}
      />

      <ShiftDetailModal
        isOpen={Boolean(selectedShift)}
        onClose={() => setSelectedShift(null)}
        shift={selectedShift}
        staffList={staff}
        onRemoveStaff={handleRemoveStaff}
        onAddStaff={handleAddStaff}
        onDeleteShift={handleDeleteShift}
        onUpdateNotes={handleUpdateSelectedNotes}
      />
    </div>
  );
};

export default ScheduleManagement;
