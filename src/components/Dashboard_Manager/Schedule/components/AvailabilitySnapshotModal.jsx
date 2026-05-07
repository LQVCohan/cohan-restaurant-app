import React, { useMemo, useState } from "react";
import { eachDayOfInterval, format } from "date-fns";
import { vi } from "date-fns/locale";
import "./AvailabilitySnapshotModal.scss";

const FINALIZED_STATUSES = new Set(["approved", "locked", "submitted", "late_change_requested"]);
const PART_TIME_TYPES = new Set(["part_time", "seasonal", "probation", "contract"]);

const getWeekDays = (weekStart, weekEnd) => {
  if (!weekStart || !weekEnd) return [];
  return eachDayOfInterval({ start: new Date(weekStart), end: new Date(weekEnd) });
};

const AvailabilitySnapshotModal = ({
  isOpen,
  onClose,
  weekStart,
  weekEnd,
  staffList = [],
  availabilityWindows = [],
  availabilitySubmissions = [],
  shiftTemplates,
  shiftRules,
  loading,
  error,
}) => {
  const [search, setSearch] = useState("");
  const [employmentType, setEmploymentType] = useState("all");
  const [roleDepartment, setRoleDepartment] = useState("all");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [onlyShiftType, setOnlyShiftType] = useState("all");
  if (!isOpen) return null;

  const templates = shiftTemplates || shiftRules || {};
  const shiftTypes = Object.entries(templates).map(([key, value]) => ({
    key: String(key).toLowerCase(),
    label: value?.label || key,
    startTime: value?.startTime,
    endTime: value?.endTime,
  }));
  const days = getWeekDays(weekStart, weekEnd);
  const hasWindow = (availabilityWindows || []).some((windowRow) => {
    const start = new Date(windowRow.periodStart).getTime();
    const end = new Date(windowRow.periodEnd).getTime();
    return start === new Date(weekStart).getTime() && end === new Date(weekEnd).getTime();
  });

  const submissionByStaff = useMemo(() => {
    const map = new Map();
    availabilitySubmissions.forEach((row) => map.set(String(row.staffId || row.employeeId), row));
    return map;
  }, [availabilitySubmissions]);

  const rows = useMemo(() => staffList.map((person) => {
    const staffId = String(person.id);
    const submission = submissionByStaff.get(staffId);
    const submissionStatus = String(submission?.status || "").toLowerCase();
    const isFullTime = String(person.employmentType || "").toLowerCase() === "full_time";
    const isPartTimeLike = PART_TIME_TYPES.has(String(person.employmentType || "").toLowerCase());
    const hasLateChangePending = submissionStatus === "late_change_requested";
    const pendingSlotsCount = Array.isArray(submission?.pendingSlots) ? submission.pendingSlots.length : 0;

    const cellMap = {};
    days.forEach((day) => {
      const dayKey = format(day, "yyyy-MM-dd");
      shiftTypes.forEach((shift) => {
        const slotKey = `${dayKey}|${shift.key}`;
        if (isFullTime) {
          const workingDays = Array.isArray(person.workingDays) ? person.workingDays : [];
          if (!workingDays.length) {
            cellMap[slotKey] = { state: "not_registered", label: "Chưa rõ workingDays", className: "neutral" };
            return;
          }
          const weekdayKey = format(day, "EEE", { locale: vi }).toUpperCase();
          const worksToday = workingDays.includes(weekdayKey);
          const exceptionSlots = (submissionStatus === "approved" && submission?.submissionType === "unavailable_exception" && Array.isArray(submission?.slots)) ? submission.slots : [];
          const hasException = exceptionSlots.some((slot) => format(new Date(slot.date), "yyyy-MM-dd") === dayKey && String(slot.shiftType || "").toLowerCase() === shift.key && String(slot.status || "").toLowerCase() === "unavailable");
          if (hasException) {
            cellMap[slotKey] = { state: "unavailable_exception", label: "Báo bận", className: "warning" };
          } else if (worksToday) {
            cellMap[slotKey] = { state: "working_day", label: "Theo workingDays", className: "available" };
          } else {
            cellMap[slotKey] = { state: "unavailable", label: "Không khả dụng", className: "unavailable" };
          }
          return;
        }

        if (!isPartTimeLike || !FINALIZED_STATUSES.has(submissionStatus)) {
          cellMap[slotKey] = { state: "not_registered", label: "Chưa đăng ký", className: "neutral" };
          return;
        }
        const slots = Array.isArray(submission?.slots) ? submission.slots : [];
        const matched = slots.find((slot) => format(new Date(slot.date), "yyyy-MM-dd") === dayKey && String(slot.shiftType || "").toLowerCase() === shift.key);
        if (matched?.status === "available") {
          cellMap[slotKey] = { state: "available", label: "Có thể làm", className: "available" };
        } else {
          cellMap[slotKey] = { state: "not_registered", label: "Chưa đăng ký", className: "neutral" };
        }
      });
    });
    return { person, submission, hasLateChangePending, pendingSlotsCount, cellMap, isFullTime, isPartTimeLike };
  }), [days, shiftTypes, staffList, submissionByStaff]);

  const filteredRows = rows.filter(({ person, cellMap }) => {
    const keyword = search.trim().toLowerCase();
    if (keyword) {
      const raw = `${person.fullName || ""} ${person.employeeCode || ""}`.toLowerCase();
      if (!raw.includes(keyword)) return false;
    }
    if (employmentType !== "all" && String(person.employmentType || "").toLowerCase() !== employmentType) return false;
    if (roleDepartment !== "all") {
      const role = String(person.roleName || person.role?.name || person.roleSlug || "").toLowerCase();
      const dept = String(person.department || "").toLowerCase();
      if (role !== roleDepartment && dept !== roleDepartment) return false;
    }
    if (onlyMissing) {
      const hasMissing = Object.values(cellMap).some((cell) => ["not_registered"].includes(cell.state));
      if (!hasMissing) return false;
    }
    if (onlyShiftType !== "all") {
      const hasAvailable = Object.entries(cellMap).some(([key, cell]) => key.endsWith(`|${onlyShiftType}`) && ["available", "working_day"].includes(cell.state));
      if (!hasAvailable) return false;
    }
    return true;
  });

  const summary = {
    total: rows.length,
    official: rows.filter((row) => row.submission || row.isFullTime).length,
    missing: rows.filter((row) => Object.values(row.cellMap).some((cell) => cell.state === "not_registered")).length,
    late: rows.filter((row) => row.hasLateChangePending).length,
    fullTime: rows.filter((row) => row.isFullTime).length,
    partTime: rows.filter((row) => row.isPartTimeLike).length,
  };

  return (
    <div className="availability-snapshot-modal-overlay">
      <div className="availability-snapshot-modal">
        <button type="button" onClick={onClose}>Đóng</button>
        <h3>Availability đã chốt</h3>
        <p>Tuần {format(new Date(weekStart), "dd/MM/yyyy")} - {format(new Date(weekEnd), "dd/MM/yyyy")}. Dữ liệu này là nguồn chính thức dùng để xếp lịch.</p>
        <div>Tổng nhân viên: {summary.total} | Có availability chính thức: {summary.official} | Chưa có availability / chưa rõ: {summary.missing} | Có late change pending: {summary.late} | Full-time theo workingDays: {summary.fullTime} | Part-time theo approved slots: {summary.partTime}</div>
        {!hasWindow ? <div className="empty">Chưa có kỳ availability đã chốt cho tuần này.</div> : null}
        {loading ? <div>Đang tải...</div> : null}
        {error ? <div>{String(error)}</div> : null}
        {hasWindow ? (
          <table className="availability-snapshot-table">
            <thead><tr><th>Nhân viên</th>{days.map((d)=>(<th key={String(d)}>{format(d,'EEE dd/MM',{locale:vi})}</th>))}</tr></thead>
            <tbody>{filteredRows.map(({person,cellMap,hasLateChangePending,pendingSlotsCount}) => (
              <tr key={person.id}><td>{person.fullName} ({person.employeeCode}) {hasLateChangePending ? '⚠️' : ''}{hasLateChangePending ? ' Có thay đổi muộn đang chờ duyệt, đang dùng availability chính thức.' : ''} {pendingSlotsCount>0 ? `(pending: ${pendingSlotsCount}, not usable)` : ''}</td>
                {days.map((d)=>{const k=format(d,'yyyy-MM-dd'); const dayShiftStates=shiftTypes.map((s)=>cellMap[`${k}|${s.key}`]); const primary=dayShiftStates.find(Boolean) || {label:'-',className:'neutral'}; return <td key={`${person.id}-${k}`} className={`availability-cell ${primary.className}`}>{primary.label}</td>;})}
              </tr>
            ))}</tbody>
          </table>
        ) : null}
      </div>
    </div>
  );
};

export default AvailabilitySnapshotModal;
