import React, { useEffect, useMemo, useState } from "react";
import { eachDayOfInterval, format } from "date-fns";
import { vi } from "date-fns/locale";
import "./AvailabilitySnapshotModal.scss";

const FINALIZED_STATUSES = new Set([
  "approved",
  "locked",
  "submitted",
  "late_change_requested",
]);
const PART_TIME_TYPES = new Set([
  "part_time",
  "seasonal",
  "probation",
  "contract",
]);
const DAY_KEYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const EMPLOYMENT_TYPE_LABELS = {
  full_time: "Toàn thời gian",
  part_time: "Bán thời gian",
  probation: "Thử việc",
  seasonal: "Thời vụ",
  contract: "Hợp đồng",
};

const CELL_UI = {
  available: { short: "Rảnh", label: "Có thể làm", tone: "available" },
  working_day: {
    short: "Cố định",
    label: "Theo lịch làm cố định",
    tone: "available",
  },
  unavailable_exception: { short: "Bận", label: "Báo bận", tone: "warning" },
  unavailable: { short: "Nghỉ", label: "Không khả dụng", tone: "unavailable" },
  not_registered: { short: "—", label: "Chưa đăng ký", tone: "neutral" },
};

const getWorkingDayKey = (date) => DAY_KEYS[new Date(date).getDay()];
const getWeekDays = (weekStart, weekEnd) =>
  eachDayOfInterval({ start: new Date(weekStart), end: new Date(weekEnd) });
const isFinalizedStatus = (status) =>
  FINALIZED_STATUSES.has(String(status || "").toLowerCase());
const toDateKey = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : format(date, "yyyy-MM-dd");
};
const parseTimeToMinutes = (value) => {
  const match = String(value || "").match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
};
const getDurationHours = ({ startTime, endTime, allowCrossDay }) => {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (start == null || end == null) return 0;
  let minutes = end - start;
  if (allowCrossDay || minutes <= 0) minutes += 24 * 60;
  return minutes > 0 ? minutes / 60 : 0;
};
const formatDuration = (value) =>
  Number.isInteger(value) ? String(value) : Number(value || 0).toFixed(1);
const isFourHourTemplate = (shift) =>
  shift.durationHours >= 3.75 && shift.durationHours <= 4.25;
const looksLikePartTimeTemplate = (shift) =>
  isFourHourTemplate(shift) ||
  /part[- ]?time|bán thời gian|cao điểm/i.test(String(shift.label || ""));

function getCellUi(cell) {
  const configured = CELL_UI[cell?.state];
  if (!configured) {
    return {
      short: "—",
      label: cell?.label || "Không rõ",
      tone: cell?.className || "neutral",
    };
  }
  return { ...configured, label: cell?.label || configured.label };
}

export function normalizeShiftDefinitions({ shiftTemplates, shiftRules }) {
  let definitions = [];
  if (Array.isArray(shiftTemplates) && shiftTemplates.length) {
    definitions = shiftTemplates
      .filter((item) => item?.enabled !== false)
      .map((item) => ({
        key: String(item.key || "").toLowerCase(),
        label: item.label || item.key,
        startTime: item.startTime,
        endTime: item.endTime,
        allowCrossDay: item.allowCrossDay === true,
      }));
  } else if (Array.isArray(shiftRules) && shiftRules.length) {
    definitions = shiftRules.map((rule) => ({
      key: String(rule.type || rule.key || "").toLowerCase(),
      label: rule.label || rule.type || rule.key,
      startTime: rule.startTime,
      endTime: rule.endTime,
      allowCrossDay: rule.allowCrossDay === true,
    }));
  } else if (shiftRules && typeof shiftRules === "object") {
    definitions = Object.entries(shiftRules).map(([key, value]) => ({
      key: String(value?.key || value?.type || key).toLowerCase(),
      label: value?.label || key,
      startTime: value?.startTime,
      endTime: value?.endTime,
      allowCrossDay: value?.allowCrossDay === true,
    }));
  } else {
    definitions = [
      { key: "morning", label: "Ca sáng", startTime: "06:00", endTime: "14:00" },
      { key: "afternoon", label: "Ca chiều", startTime: "14:00", endTime: "18:00" },
      { key: "evening", label: "Ca tối", startTime: "18:00", endTime: "23:00" },
    ];
  }

  return definitions
    .filter((item) => item.key)
    .map((item) => ({ ...item, durationHours: getDurationHours(item) }));
}

const EmployeeCell = ({ row }) => (
  <td className="employee-col employee-cell">
    <strong>{row.person.fullName}</strong>
    <span>{row.person.employeeCode || "Chưa có mã"}</span>
    {row.hasLateChangePending ? <em>Chờ duyệt thay đổi muộn</em> : null}
    {row.pendingSlotsCount > 0 ? <small>Chờ duyệt: {row.pendingSlotsCount}</small> : null}
  </td>
);

const AvailabilitySnapshotModalContent = ({
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

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const shiftTypes = useMemo(
    () => normalizeShiftDefinitions({ shiftTemplates, shiftRules }),
    [shiftRules, shiftTemplates],
  );
  const days = useMemo(() => getWeekDays(weekStart, weekEnd), [weekStart, weekEnd]);
  const weekStartKey = toDateKey(weekStart);
  const weekEndKey = toDateKey(weekEnd);

  const hasWindow = useMemo(
    () =>
      availabilityWindows.some((windowItem) => {
        const status = String(
          windowItem.status || windowItem.effectiveStatus || "",
        ).toLowerCase();
        return (
          status !== "cancelled" &&
          toDateKey(windowItem.periodStart) === weekStartKey &&
          toDateKey(windowItem.periodEnd) === weekEndKey
        );
      }),
    [availabilityWindows, weekEndKey, weekStartKey],
  );

  const submissionByStaff = useMemo(() => {
    const map = new Map();
    availabilitySubmissions.forEach((row) =>
      map.set(String(row.staffId || row.employeeId), row),
    );
    return map;
  }, [availabilitySubmissions]);

  const referencedPartTimeShiftKeys = useMemo(() => {
    const keys = new Set();
    staffList.forEach((person) => {
      if (!PART_TIME_TYPES.has(String(person.employmentType || "").toLowerCase())) return;
      const submission = submissionByStaff.get(String(person.id));
      [...(submission?.slots || []), ...(submission?.pendingSlots || [])].forEach(
        (slot) => {
          const key = String(slot?.shiftType || "").toLowerCase();
          if (key) keys.add(key);
        },
      );
    });
    return keys;
  }, [staffList, submissionByStaff]);

  const partTimeShiftTypes = useMemo(() => {
    const matching = shiftTypes.filter(
      (shift) =>
        looksLikePartTimeTemplate(shift) || referencedPartTimeShiftKeys.has(shift.key),
    );
    return matching.length ? matching : shiftTypes;
  }, [referencedPartTimeShiftKeys, shiftTypes]);
  const hasFourHourTemplate = partTimeShiftTypes.some(isFourHourTemplate);

  const rows = useMemo(
    () =>
      staffList.map((person) => {
        const submission = submissionByStaff.get(String(person.id));
        const submissionStatus = String(submission?.status || "").toLowerCase();
        const type = String(person.employmentType || "").toLowerCase();
        const isFullTime = type === "full_time";
        const isPartTimeLike = PART_TIME_TYPES.has(type);
        const workingDays = new Set(
          (Array.isArray(person.workingDays) ? person.workingDays : []).map((day) =>
            String(day).toUpperCase(),
          ),
        );
        const hasLateChangePending = submissionStatus === "late_change_requested";
        const pendingSlotsCount = Array.isArray(submission?.pendingSlots)
          ? submission.pendingSlots.length
          : 0;
        const finalizedUnavailableException =
          isFinalizedStatus(submissionStatus) &&
          submission?.submissionType === "unavailable_exception";
        const officialSlots = Array.isArray(submission?.slots) ? submission.slots : [];
        const dayMap = {};
        const cellMap = {};

        days.forEach((day) => {
          const dayKey = toDateKey(day);
          if (isFullTime) {
            if (!workingDays.size) {
              dayMap[dayKey] = {
                state: "not_registered",
                label: "Chưa rõ workingDays",
                className: "neutral",
              };
            } else {
              const hasException =
                finalizedUnavailableException &&
                officialSlots.some(
                  (slot) =>
                    toDateKey(slot.date) === dayKey &&
                    String(slot.status || "").toLowerCase() === "unavailable",
                );
              dayMap[dayKey] = hasException
                ? {
                    state: "unavailable_exception",
                    label: "Báo bận",
                    className: "warning",
                  }
                : workingDays.has(getWorkingDayKey(day))
                  ? {
                      state: "working_day",
                      label: "Theo lịch làm cố định",
                      className: "available",
                    }
                  : {
                      state: "unavailable",
                      label: "Không khả dụng",
                      className: "unavailable",
                    };
            }
          }

          shiftTypes.forEach((shift) => {
            const slotKey = `${dayKey}|${shift.key}`;
            if (!isPartTimeLike || !isFinalizedStatus(submissionStatus)) {
              cellMap[slotKey] = {
                state: "not_registered",
                label: "Chưa đăng ký",
                className: "neutral",
              };
              return;
            }
            const matched = officialSlots.find(
              (slot) =>
                toDateKey(slot.date) === dayKey &&
                String(slot.shiftType || "").toLowerCase() === shift.key,
            );
            const matchedStatus = String(matched?.status || "").toLowerCase();
            if (matchedStatus === "available") {
              cellMap[slotKey] = {
                state: "available",
                label: "Có thể làm",
                className: "available",
              };
            } else if (matchedStatus === "unavailable") {
              cellMap[slotKey] = {
                state: "unavailable",
                label: "Không khả dụng",
                className: "unavailable",
              };
            } else {
              cellMap[slotKey] = {
                state: "not_registered",
                label: "Chưa đăng ký",
                className: "neutral",
              };
            }
          });
        });

        return {
          person,
          employmentType: type,
          submissionStatus,
          isFullTime,
          isPartTimeLike,
          hasLateChangePending,
          pendingSlotsCount,
          finalizedUnavailableException,
          dayMap,
          cellMap,
        };
      }),
    [days, shiftTypes, staffList, submissionByStaff],
  );

  const roleDepartmentOptions = useMemo(() => {
    const options = new Map();
    staffList.forEach((person) => {
      const roleValue = String(
        person.roleName || person.role?.name || person.roleSlug || "",
      )
        .trim()
        .toLowerCase();
      const roleLabel = String(
        person.roleName || person.role?.name || person.roleSlug || "",
      ).trim();
      const departmentValue = String(person.department || "").trim().toLowerCase();
      const departmentLabel = String(
        person.departmentLabel || person.department || "",
      ).trim();
      if (roleValue && !options.has(roleValue)) options.set(roleValue, roleLabel);
      if (departmentValue && !options.has(departmentValue)) {
        options.set(departmentValue, departmentLabel);
      }
    });
    return Array.from(options, ([value, label]) => ({ value, label }));
  }, [staffList]);

  const employmentOptions = useMemo(
    () =>
      Array.from(
        new Set(
          staffList
            .map((person) => String(person.employmentType || "").toLowerCase())
            .filter(Boolean),
        ),
      ).map((value) => ({
        value,
        label: EMPLOYMENT_TYPE_LABELS[value] || value,
      })),
    [staffList],
  );

  const rowHasMissing = (row) =>
    row.isFullTime
      ? Object.values(row.dayMap).some((cell) => cell.state === "not_registered")
      : partTimeShiftTypes.some((shift) =>
          days.some(
            (day) =>
              row.cellMap[`${toDateKey(day)}|${shift.key}`]?.state ===
              "not_registered",
          ),
        );

  const filteredRows = rows.filter((row) => {
    const { person } = row;
    const keyword = search.trim().toLowerCase();
    if (
      keyword &&
      !`${person.fullName || ""} ${person.employeeCode || ""}`
        .toLowerCase()
        .includes(keyword)
    ) {
      return false;
    }
    if (employmentType !== "all" && row.employmentType !== employmentType) {
      return false;
    }
    if (roleDepartment !== "all") {
      const role = String(
        person.roleName || person.role?.name || person.roleSlug || "",
      ).toLowerCase();
      const department = String(person.department || "").toLowerCase();
      if (role !== roleDepartment && department !== roleDepartment) return false;
    }
    if (onlyMissing && !rowHasMissing(row)) return false;
    if (onlyShiftType !== "all") {
      if (!row.isPartTimeLike) return false;
      const hasAvailable = days.some((day) =>
        ["available", "working_day"].includes(
          row.cellMap[`${toDateKey(day)}|${onlyShiftType}`]?.state,
        ),
      );
      if (!hasAvailable) return false;
    }
    return true;
  });

  const fullTimeRows = filteredRows.filter((row) => row.isFullTime);
  const partTimeRows = filteredRows.filter((row) => row.isPartTimeLike);
  const hasActiveFilters =
    search ||
    employmentType !== "all" ||
    roleDepartment !== "all" ||
    onlyShiftType !== "all" ||
    onlyMissing;
  const summary = {
    total: rows.length,
    official: rows.filter((row) =>
      row.isFullTime
        ? (Array.isArray(row.person.workingDays) && row.person.workingDays.length > 0) ||
          row.finalizedUnavailableException
        : row.isPartTimeLike && isFinalizedStatus(row.submissionStatus),
    ).length,
    missing: rows.filter(rowHasMissing).length,
    late: rows.filter((row) => row.hasLateChangePending).length,
  };

  const clearFilters = () => {
    setSearch("");
    setEmploymentType("all");
    setRoleDepartment("all");
    setOnlyShiftType("all");
    setOnlyMissing(false);
  };

  return (
    <div
      className="availability-snapshot-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="availability-snapshot-title"
    >
      <div className="availability-snapshot-modal">
        <header className="availability-snapshot-header">
          <div>
            <span className="eyebrow">LỊCH RẢNH NHÂN VIÊN</span>
            <h3 id="availability-snapshot-title">Lịch rảnh đã đăng ký</h3>
            <p>
              Tuần {format(new Date(weekStart), "dd/MM/yyyy")} -{" "}
              {format(new Date(weekEnd), "dd/MM/yyyy")}. Full-time xem theo ngày;
              part-time xem theo từng block ca.
            </p>
          </div>
          <button
            type="button"
            className="btn-close-snapshot"
            aria-label="Đóng lịch rảnh đã đăng ký"
            onClick={onClose}
          >
            Đóng
          </button>
        </header>

        <section className="availability-summary-cards">
          <div><span>Tổng nhân viên</span><strong>{summary.total}</strong></div>
          <div><span>Đủ dữ liệu xếp ca</span><strong>{summary.official}</strong></div>
          <div><span>Chưa đủ dữ liệu</span><strong>{summary.missing}</strong></div>
          <div><span>Thay đổi chờ duyệt</span><strong>{summary.late}</strong></div>
        </section>

        <section
          className="availability-snapshot-controls"
          aria-label="Bộ lọc lịch rảnh nhân viên"
        >
          <label className="availability-filter-field availability-filter-search">
            <span>Tìm nhân viên</span>
            <input
              aria-label="Tìm nhân viên"
              placeholder="Nhập tên hoặc mã nhân viên"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label className="availability-filter-field">
            <span>Loại hợp đồng</span>
            <select
              aria-label="Loại hợp đồng"
              value={employmentType}
              onChange={(event) => {
                setEmploymentType(event.target.value);
                if (event.target.value === "full_time") setOnlyShiftType("all");
              }}
            >
              <option value="all">Tất cả loại hợp đồng</option>
              {employmentOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="availability-filter-field">
            <span>Vai trò / phòng ban</span>
            <select
              aria-label="Vai trò hoặc phòng ban"
              value={roleDepartment}
              onChange={(event) => setRoleDepartment(event.target.value)}
            >
              <option value="all">Tất cả vai trò / phòng ban</option>
              {roleDepartmentOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="availability-filter-field">
            <span>Block ca part-time</span>
            <select
              aria-label="Ca có thể làm"
              value={onlyShiftType}
              onChange={(event) => setOnlyShiftType(event.target.value)}
              disabled={employmentType === "full_time"}
            >
              <option value="all">Mọi ca</option>
              {partTimeShiftTypes.map((shift) => (
                <option key={shift.key} value={shift.key}>{shift.label}</option>
              ))}
            </select>
          </label>
          <label className="toggle-missing">
            <input
              type="checkbox"
              checked={onlyMissing}
              onChange={(event) => setOnlyMissing(event.target.checked)}
            />
            <span>Chỉ hiện nhân viên thiếu đăng ký</span>
          </label>
        </section>

        <div className="availability-results-bar" role="status" aria-live="polite">
          <span>Đang hiển thị <strong>{filteredRows.length}</strong> / {rows.length} nhân viên</span>
          {hasActiveFilters ? <button type="button" onClick={clearFilters}>Xóa bộ lọc</button> : null}
        </div>

        <div className="availability-template-strip" aria-label="Khung ca đang cấu hình">
          <strong>Khung ca:</strong>
          {shiftTypes.map((shift) => (
            <span key={shift.key} className={isFourHourTemplate(shift) ? "is-part-time" : ""}>
              {shift.label}
              {shift.startTime && shift.endTime ? ` · ${shift.startTime}-${shift.endTime}` : ""}
              {shift.durationHours ? ` · ${formatDuration(shift.durationHours)} giờ` : ""}
            </span>
          ))}
        </div>

        <div className="availability-legend-row" aria-label="Chú giải trạng thái lịch rảnh">
          <span><i className="available" /> Rảnh: nhân viên có thể làm</span>
          <span><i className="available" /> Cố định: theo lịch làm đã thiết lập</span>
          <span><i className="warning" /> Bận: đã báo ngoại lệ</span>
          <span><i className="unavailable" /> Nghỉ: không khả dụng</span>
          <span><i className="neutral" /> —: chưa đăng ký</span>
        </div>

        {!hasWindow ? (
          <div className="availability-window-note" role="status">
            <strong>Tuần này chưa có kỳ đăng ký đã chốt.</strong>
            <span>Bảng vẫn hiển thị lịch cố định của full-time và đánh dấu part-time chưa đăng ký.</span>
          </div>
        ) : null}
        {error ? (
          <div className="availability-error-state">
            Không thể tải lịch rảnh đã đăng ký: {error.message || String(error)}
          </div>
        ) : null}
        {loading ? (
          <div className="availability-loading-state" role="status" aria-live="polite">
            Đang tải dữ liệu nhân viên và lịch rảnh của tuần này...
          </div>
        ) : null}
        {!loading && !error && rows.length === 0 ? (
          <div className="availability-empty-state" role="status">
            <strong>Chưa có nhân viên để hiển thị.</strong>
            <span>Kiểm tra lại nhà hàng đang chọn hoặc trạng thái làm việc của nhân viên.</span>
          </div>
        ) : null}

        {!loading && !error && rows.length > 0 ? (
          <div className="availability-group-stack">
            {(employmentType === "all" || employmentType === "full_time") &&
            fullTimeRows.length ? (
              <section className="availability-group availability-group--full-time">
                <div className="availability-group-header">
                  <div>
                    <strong>Nhân viên toàn thời gian</strong>
                    <span>Mỗi ngày một trạng thái; không nhân bản qua mọi loại ca.</span>
                  </div>
                  <b>{fullTimeRows.length} nhân viên</b>
                </div>
                <div className="availability-table-shell">
                  <table className="availability-snapshot-table availability-full-time-table">
                    <thead>
                      <tr>
                        <th className="employee-col">Nhân viên</th>
                        {days.map((day) => (
                          <th key={String(day)}>{format(day, "EEE dd/MM", { locale: vi })}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {fullTimeRows.map((row) => (
                        <tr key={row.person.id}>
                          <EmployeeCell row={row} />
                          {days.map((day) => {
                            const ui = getCellUi(row.dayMap[toDateKey(day)]);
                            return (
                              <td
                                key={`${row.person.id}-${toDateKey(day)}`}
                                className={`availability-cell availability-day-cell ${ui.tone}`}
                                title={ui.label}
                                aria-label={`${row.person.fullName || "Nhân viên"}, ${format(day, "dd/MM")}: ${ui.label}`}
                              >
                                <span>{ui.short}</span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            {(employmentType === "all" || PART_TIME_TYPES.has(employmentType)) &&
            partTimeRows.length ? (
              <section className="availability-group availability-group--part-time">
                <div className="availability-group-header">
                  <div>
                    <strong>Nhân viên bán thời gian</strong>
                    <span>Đăng ký theo block ca; block 4 giờ được đánh dấu rõ.</span>
                  </div>
                  <b>{partTimeRows.length} nhân viên</b>
                </div>
                {!hasFourHourTemplate ? (
                  <div className="availability-policy-warning" role="status">
                    Chính sách ca hiện tại chưa có block 4 giờ. Hệ thống đang giữ nguyên các ca đã cấu hình để không làm sai dữ liệu đăng ký cũ.
                  </div>
                ) : null}
                <div className="availability-table-shell">
                  <table className="availability-snapshot-table">
                    <thead>
                      <tr>
                        <th rowSpan={2} className="employee-col">Nhân viên</th>
                        {days.map((day) => (
                          <th key={String(day)} colSpan={partTimeShiftTypes.length}>
                            {format(day, "EEE dd/MM", { locale: vi })}
                          </th>
                        ))}
                      </tr>
                      <tr>
                        {days.flatMap((day) =>
                          partTimeShiftTypes.map((shift) => (
                            <th key={`${String(day)}-${shift.key}`}>
                              <span>{shift.label}</span>
                              {shift.startTime && shift.endTime ? (
                                <small>
                                  {shift.startTime}-{shift.endTime}
                                  {shift.durationHours ? ` · ${formatDuration(shift.durationHours)}h` : ""}
                                </small>
                              ) : null}
                            </th>
                          )),
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {partTimeRows.map((row) => (
                        <tr key={row.person.id}>
                          <EmployeeCell row={row} />
                          {days.flatMap((day) =>
                            partTimeShiftTypes.map((shift) => {
                              const key = `${toDateKey(day)}|${shift.key}`;
                              const ui = getCellUi(row.cellMap[key]);
                              return (
                                <td
                                  key={`${row.person.id}-${key}`}
                                  className={`availability-cell ${ui.tone}`}
                                  title={ui.label}
                                  aria-label={`${row.person.fullName || "Nhân viên"}, ${format(day, "dd/MM")}, ${shift.label}: ${ui.label}`}
                                >
                                  <span>{ui.short}</span>
                                </td>
                              );
                            }),
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            {!filteredRows.length ? (
              <div className="availability-empty-state" role="status">
                <strong>Không có nhân viên phù hợp với bộ lọc hiện tại.</strong>
                <span>Hãy xóa bớt điều kiện lọc để xem lại dữ liệu.</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};

const AvailabilitySnapshotModalInline = ({ isOpen, ...rest }) => {
  if (!isOpen) return null;
  return <AvailabilitySnapshotModalContent {...rest} />;
};

export default AvailabilitySnapshotModalInline;
