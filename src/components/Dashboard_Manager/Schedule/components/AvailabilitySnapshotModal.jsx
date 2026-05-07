import React, { useMemo, useState } from "react";
import { eachDayOfInterval, format } from "date-fns";
import { vi } from "date-fns/locale";
import "./AvailabilitySnapshotModal.scss";

const FINALIZED_STATUSES = new Set(["approved", "locked", "submitted", "late_change_requested"]);
const PART_TIME_TYPES = new Set(["part_time", "seasonal", "probation", "contract"]);
const DAY_KEYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

const getWorkingDayKey = (date) => DAY_KEYS[new Date(date).getDay()];
const getWeekDays = (weekStart, weekEnd) => eachDayOfInterval({ start: new Date(weekStart), end: new Date(weekEnd) });
const isFinalizedStatus = (status) => FINALIZED_STATUSES.has(String(status || "").toLowerCase());
const toDateKey = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : format(date, "yyyy-MM-dd");
};


export function normalizeShiftDefinitions({ shiftTemplates, shiftRules }) {
  if (Array.isArray(shiftTemplates) && shiftTemplates.length) {
    return shiftTemplates
      .filter((t) => t?.enabled !== false)
      .map((t) => ({
        key: String(t.key || "").toLowerCase(),
        label: t.label || t.key,
        startTime: t.startTime,
        endTime: t.endTime,
      }))
      .filter((t) => t.key);
  }
  if (Array.isArray(shiftRules) && shiftRules.length) {
    return shiftRules
      .map((rule) => ({
        key: String(rule.type || rule.key || "").toLowerCase(),
        label: rule.label || rule.type || rule.key,
        startTime: rule.startTime,
        endTime: rule.endTime,
      }))
      .filter((t) => t.key);
  }
  if (shiftRules && typeof shiftRules === "object") {
    return Object.entries(shiftRules)
      .map(([key, value]) => ({
        key: String(value?.key || value?.type || key).toLowerCase(),
        label: value?.label || key,
        startTime: value?.startTime,
        endTime: value?.endTime,
      }))
      .filter((t) => t.key);
  }
  return [
    { key: "morning", label: "Ca sáng", startTime: "06:00", endTime: "14:00" },
    { key: "afternoon", label: "Ca chiều", startTime: "14:00", endTime: "18:00" },
    { key: "evening", label: "Ca tối", startTime: "18:00", endTime: "23:00" },
  ];
}

const AvailabilitySnapshotModalContent = (props) => {
  const { onClose, weekStart, weekEnd, staffList = [], availabilityWindows = [], availabilitySubmissions = [], shiftTemplates, shiftRules, loading, error } = props;
  const [search, setSearch] = useState("");
  const [employmentType, setEmploymentType] = useState("all");
  const [roleDepartment, setRoleDepartment] = useState("all");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [onlyShiftType, setOnlyShiftType] = useState("all");

  const shiftTypes = useMemo(() => normalizeShiftDefinitions({ shiftTemplates, shiftRules }), [shiftRules, shiftTemplates]);
  const days = useMemo(() => getWeekDays(weekStart, weekEnd), [weekStart, weekEnd]);
  const weekStartKey = toDateKey(weekStart);
  const weekEndKey = toDateKey(weekEnd);

  const hasWindow = useMemo(
    () =>
      (availabilityWindows || []).some((w) => {
        const status = String(w.status || w.effectiveStatus || "").toLowerCase();
        if (status === "cancelled") return false;

        return (
          toDateKey(w.periodStart) === weekStartKey &&
          toDateKey(w.periodEnd) === weekEndKey
        );
      }),
    [availabilityWindows, weekStartKey, weekEndKey],
  );

  const submissionByStaff = useMemo(() => {
    const map = new Map();
    availabilitySubmissions.forEach((row) => map.set(String(row.staffId || row.employeeId), row));
    return map;
  }, [availabilitySubmissions]);

  const rows = useMemo(
    () =>
      staffList.map((person) => {
        const submission = submissionByStaff.get(String(person.id));
        const submissionStatus = String(submission?.status || "").toLowerCase();
        const isFullTime = String(person.employmentType || "").toLowerCase() === "full_time";
        const isPartTimeLike = PART_TIME_TYPES.has(String(person.employmentType || "").toLowerCase());
        const workingDays = new Set((Array.isArray(person.workingDays) ? person.workingDays : []).map((d) => String(d).toUpperCase()));
        const hasLateChangePending = submissionStatus === "late_change_requested";
        const pendingSlotsCount = Array.isArray(submission?.pendingSlots) ? submission.pendingSlots.length : 0;
        const finalizedUnavailableException = isFinalizedStatus(submissionStatus) && submission?.submissionType === "unavailable_exception";

        const cellMap = {};
        days.forEach((day) => {
          const dayKey = format(day, "yyyy-MM-dd");
          const workingDayKey = getWorkingDayKey(day);
          shiftTypes.forEach((shift) => {
            const slotKey = `${dayKey}|${shift.key}`;
            if (isFullTime) {
              if (!workingDays.size) {
                cellMap[slotKey] = { state: "not_registered", label: "Chưa rõ workingDays", className: "neutral" };
                return;
              }
              const worksToday = workingDays.has(workingDayKey);
              const exceptionSlots = finalizedUnavailableException && Array.isArray(submission?.slots) ? submission.slots : [];
              const hasException = exceptionSlots.some((slot) => format(new Date(slot.date), "yyyy-MM-dd") === dayKey && String(slot.shiftType || "").toLowerCase() === shift.key && String(slot.status || "").toLowerCase() === "unavailable");
              if (hasException) cellMap[slotKey] = { state: "unavailable_exception", label: "Báo bận", className: "warning" };
              else if (worksToday) cellMap[slotKey] = { state: "working_day", label: "Theo workingDays", className: "available" };
              else cellMap[slotKey] = { state: "unavailable", label: "Không khả dụng", className: "unavailable" };
              return;
            }

            if (!isPartTimeLike || !isFinalizedStatus(submissionStatus)) {
              cellMap[slotKey] = { state: "not_registered", label: "Chưa đăng ký", className: "neutral" };
              return;
            }
            const slots = Array.isArray(submission?.slots) ? submission.slots : [];
            const matched = slots.find((slot) => format(new Date(slot.date), "yyyy-MM-dd") === dayKey && String(slot.shiftType || "").toLowerCase() === shift.key);
            cellMap[slotKey] = matched?.status === "available" ? { state: "available", label: "Có thể làm", className: "available" } : { state: "not_registered", label: "Chưa đăng ký", className: "neutral" };
          });
        });

        return { person, submission, submissionStatus, isFullTime, isPartTimeLike, hasLateChangePending, pendingSlotsCount, finalizedUnavailableException, cellMap };
      }),
    [days, shiftTypes, staffList, submissionByStaff],
  );

  const roleDepartmentOptions = useMemo(() => Array.from(new Set(staffList.flatMap((p) => [String(p.roleName || p.role?.name || p.roleSlug || "").toLowerCase(), String(p.department || "").toLowerCase()]).filter(Boolean))), [staffList]);
  const employmentOptions = useMemo(() => Array.from(new Set(staffList.map((p) => String(p.employmentType || "").toLowerCase()).filter(Boolean))), [staffList]);

  const filteredRows = rows.filter(({ person, cellMap }) => {
    const keyword = search.trim().toLowerCase();
    if (keyword && !(`${person.fullName || ""} ${person.employeeCode || ""}`.toLowerCase().includes(keyword))) return false;
    if (employmentType !== "all" && String(person.employmentType || "").toLowerCase() !== employmentType) return false;
    if (roleDepartment !== "all") {
      const role = String(person.roleName || person.role?.name || person.roleSlug || "").toLowerCase();
      const dept = String(person.department || "").toLowerCase();
      if (role !== roleDepartment && dept !== roleDepartment) return false;
    }
    if (onlyMissing && !Object.values(cellMap).some((c) => c.state === "not_registered")) return false;
    if (onlyShiftType !== "all") {
      const hasAvailable = Object.entries(cellMap).some(([k, c]) => k.endsWith(`|${onlyShiftType}`) && ["available", "working_day"].includes(c.state));
      if (!hasAvailable) return false;
    }
    return true;
  });

  const summary = {
    total: rows.length,
    official: rows.filter((r) => (r.isFullTime ? (Array.isArray(r.person.workingDays) && r.person.workingDays.length > 0) || r.finalizedUnavailableException : r.isPartTimeLike && isFinalizedStatus(r.submissionStatus))).length,
    missing: rows.filter((r) => Object.values(r.cellMap).some((c) => c.state === "not_registered")).length,
    late: rows.filter((r) => r.hasLateChangePending).length,
    fullTime: rows.filter((r) => r.isFullTime).length,
    partTime: rows.filter((r) => r.isPartTimeLike).length,
  };

  return <div className="availability-snapshot-modal-overlay"><div className="availability-snapshot-modal"><button type="button" onClick={onClose}>Đóng</button>
    <h3>Availability đã chốt</h3>
    <p>Tuần {format(new Date(weekStart), "dd/MM/yyyy")} - {format(new Date(weekEnd), "dd/MM/yyyy")}. Dữ liệu này là nguồn chính thức dùng để xếp lịch.</p>
    <div className="filters"><input placeholder="Tìm tên/mã NV" value={search} onChange={(e)=>setSearch(e.target.value)} /><select value={employmentType} onChange={(e)=>setEmploymentType(e.target.value)}><option value="all">Tất cả loại HĐ</option>{employmentOptions.map((o)=><option key={o} value={o}>{o}</option>)}</select><select value={roleDepartment} onChange={(e)=>setRoleDepartment(e.target.value)}><option value="all">Tất cả role/phòng</option>{roleDepartmentOptions.map((o)=><option key={o} value={o}>{o}</option>)}</select><label><input type="checkbox" checked={onlyMissing} onChange={(e)=>setOnlyMissing(e.target.checked)} /> Chỉ thiếu availability</label><select value={onlyShiftType} onChange={(e)=>setOnlyShiftType(e.target.value)}><option value="all">Mọi ca</option>{shiftTypes.map((s)=><option key={s.key} value={s.key}>{s.label}</option>)}</select></div>
    <div className="summary">Tổng nhân viên: {summary.total} | Có availability chính thức: {summary.official} | Chưa có availability / chưa rõ: {summary.missing} | Có late change pending: {summary.late} | Full-time theo workingDays: {summary.fullTime} | Part-time theo approved slots: {summary.partTime}</div>
    {!hasWindow ? <div className="empty">Chưa có kỳ availability đã chốt cho tuần này.</div> : null}
    {error ? <div className="error">Không thể tải availability đã chốt: {error.message || String(error)}</div> : null}
    {loading ? <div>Đang tải...</div> : null}
    {hasWindow ? <table className="availability-snapshot-table"><thead><tr><th rowSpan={2}>Nhân viên</th>{days.map((d)=><th key={String(d)} colSpan={shiftTypes.length}>{format(d,"EEE dd/MM",{locale:vi})}</th>)}</tr><tr>{days.flatMap((d)=>shiftTypes.map((s)=><th key={`${String(d)}-${s.key}`}>{s.label} {s.startTime && s.endTime ? `${s.startTime}-${s.endTime}` : ""}</th>))}</tr></thead><tbody>{filteredRows.map(({person,cellMap,hasLateChangePending,pendingSlotsCount})=><tr key={person.id}><td>{person.fullName} ({person.employeeCode}) {hasLateChangePending ? "⚠️ Có thay đổi muộn đang chờ duyệt, đang dùng availability chính thức." : ""} {pendingSlotsCount>0 ? `(pending: ${pendingSlotsCount}, not usable)` : ""}</td>{days.flatMap((d)=>shiftTypes.map((s)=>{const key=`${format(d,'yyyy-MM-dd')}|${s.key}`; const cell=cellMap[key] || {label:'-',className:'neutral'}; return <td key={`${person.id}-${key}`} className={`availability-cell ${cell.className}`}>{cell.label}</td>}))}</tr>)}</tbody></table> : null}
  </div></div>;
};

const AvailabilitySnapshotModal = ({ isOpen, ...rest }) => {
  if (!isOpen) return null;
  return <AvailabilitySnapshotModalContent {...rest} />;
};

export default AvailabilitySnapshotModal;
