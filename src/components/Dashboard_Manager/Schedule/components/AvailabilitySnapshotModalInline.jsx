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

const getWorkingDayKey = (date) => DAY_KEYS[new Date(date).getDay()];
const getWeekDays = (weekStart, weekEnd) =>
  eachDayOfInterval({ start: new Date(weekStart), end: new Date(weekEnd) });
const isFinalizedStatus = (status) =>
  FINALIZED_STATUSES.has(String(status || "").toLowerCase());
const toDateKey = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : format(date, "yyyy-MM-dd");
};

const CELL_UI = {
  available: { short: "Rảnh", label: "Có thể làm", tone: "available" },
  working_day: { short: "Cố định", label: "Theo lịch làm cố định", tone: "available" },
  unavailable_exception: { short: "Bận", label: "Báo bận", tone: "warning" },
  unavailable: { short: "Nghỉ", label: "Không khả dụng", tone: "unavailable" },
  not_registered: { short: "—", label: "Chưa đăng ký", tone: "neutral" },
};

function getCellUi(cell) {
  const configured = CELL_UI[cell?.state];
  if (!configured) {
    return {
      short: "—",
      label: cell?.label || "Không rõ",
      tone: cell?.className || "neutral",
    };
  }

  return {
    ...configured,
    label: cell?.label || configured.label,
  };
}

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
  const {
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
  } = props;
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
    availabilitySubmissions.forEach((row) =>
      map.set(String(row.staffId || row.employeeId), row),
    );
    return map;
  }, [availabilitySubmissions]);

  const rows = useMemo(
    () =>
      staffList.map((person) => {
        const submission = submissionByStaff.get(String(person.id));
        const submissionStatus = String(submission?.status || "").toLowerCase();
        const isFullTime =
          String(person.employmentType || "").toLowerCase() === "full_time";
        const isPartTimeLike = PART_TIME_TYPES.has(
          String(person.employmentType || "").toLowerCase(),
        );
        const workingDays = new Set(
          (Array.isArray(person.workingDays) ? person.workingDays : []).map((d) =>
            String(d).toUpperCase(),
          ),
        );
        const hasLateChangePending = submissionStatus === "late_change_requested";
        const pendingSlotsCount = Array.isArray(submission?.pendingSlots)
          ? submission.pendingSlots.length
          : 0;
        const finalizedUnavailableException =
          isFinalizedStatus(submissionStatus) &&
          submission?.submissionType === "unavailable_exception";

        const cellMap = {};
        days.forEach((day) => {
          const dayKey = format(day, "yyyy-MM-dd");
          const workingDayKey = getWorkingDayKey(day);
          shiftTypes.forEach((shift) => {
            const slotKey = `${dayKey}|${shift.key}`;
            if (isFullTime) {
              if (!workingDays.size) {
                cellMap[slotKey] = {
                  state: "not_registered",
                  label: "Chưa rõ workingDays",
                  className: "neutral",
                };
                return;
              }
              const worksToday = workingDays.has(workingDayKey);
              const exceptionSlots =
                finalizedUnavailableException && Array.isArray(submission?.slots)
                  ? submission.slots
                  : [];
              const hasException = exceptionSlots.some(
                (slot) =>
                  toDateKey(slot.date) === dayKey &&
                  String(slot.shiftType || "").toLowerCase() === shift.key &&
                  String(slot.status || "").toLowerCase() === "unavailable",
              );
              if (hasException) {
                cellMap[slotKey] = {
                  state: "unavailable_exception",
                  label: "Báo bận",
                  className: "warning",
                };
              } else if (worksToday) {
                cellMap[slotKey] = {
                  state: "working_day",
                  label: "Theo lịch làm cố định",
                  className: "available",
                };
              } else {
                cellMap[slotKey] = {
                  state: "unavailable",
                  label: "Không khả dụng",
                  className: "unavailable",
                };
              }
              return;
            }

            if (!isPartTimeLike || !isFinalizedStatus(submissionStatus)) {
              cellMap[slotKey] = {
                state: "not_registered",
                label: "Chưa đăng ký",
                className: "neutral",
              };
              return;
            }
            const slots = Array.isArray(submission?.slots) ? submission.slots : [];
            const matched = slots.find(
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
          submission,
          submissionStatus,
          isFullTime,
          isPartTimeLike,
          hasLateChangePending,
          pendingSlotsCount,
          finalizedUnavailableException,
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
      const departmentValue = String(person.department || "")
        .trim()
        .toLowerCase();
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
            .map((p) => String(p.employmentType || "").toLowerCase())
            .filter(Boolean),
        ),
      ).map((value) => ({
        value,
        label: EMPLOYMENT_TYPE_LABELS[value] || value,
      })),
    [staffList],
  );

  const filteredRows = rows.filter(({ person, cellMap }) => {
    const keyword = search.trim().toLowerCase();
    if (
      keyword &&
      !`${person.fullName || ""} ${person.employeeCode || ""}`
        .toLowerCase()
        .includes(keyword)
    ) {
      return false;
    }
    if (
      employmentType !== "all" &&
      String(person.employmentType || "").toLowerCase() !== employmentType
    ) {
      return false;
    }
    if (roleDepartment !== "all") {
      const role = String(
        person.roleName || person.role?.name || person.roleSlug || "",
      ).toLowerCase();
      const dept = String(person.department || "").toLowerCase();
      if (role !== roleDepartment && dept !== roleDepartment) return false;
    }
    if (onlyMissing && !Object.values(cellMap).some((c) => c.state === "not_registered")) {
      return false;
    }
    if (onlyShiftType !== "all") {
      const hasAvailable = Object.entries(cellMap).some(
        ([k, c]) =>
          k.endsWith(`|${onlyShiftType}`) &&
          ["available", "working_day"].includes(c.state),
      );
      if (!hasAvailable) return false;
    }
    return true;
  });

  const summary = {
    total: rows.length,
    official: rows.filter((r) =>
      r.isFullTime
        ? (Array.isArray(r.person.workingDays) && r.person.workingDays.length > 0) ||
          r.finalizedUnavailableException
        : r.isPartTimeLike && isFinalizedStatus(r.submissionStatus),
    ).length,
    missing: rows.filter((r) =>
      Object.values(r.cellMap).some((c) => c.state === "not_registered"),
    ).length,
    late: rows.filter((r) => r.hasLateChangePending).length,
    fullTime: rows.filter((r) => r.isFullTime).length,
    partTime: rows.filter((r) => r.isPartTimeLike).length,
  };

  return (
    <div className="availability-snapshot-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="availability-snapshot-title">
      <div className="availability-snapshot-modal">
        <header className="availability-snapshot-header">
          <div>
            <span className="eyebrow">LỊCH RẢNH NHÂN VIÊN</span>
            <h3 id="availability-snapshot-title">Lịch rảnh đã đăng ký</h3>
            <p>
              Tuần {format(new Date(weekStart), "dd/MM/yyyy")} -{" "}
              {format(new Date(weekEnd), "dd/MM/yyyy")}. Kiểm tra dữ liệu trước
              khi xếp và công bố lịch làm việc.
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
          <div>
            <span>Tổng nhân viên</span>
            <strong>{summary.total}</strong>
          </div>
          <div>
            <span>Đủ dữ liệu xếp ca</span>
            <strong>{summary.official}</strong>
          </div>
          <div>
            <span>Chưa đủ dữ liệu</span>
            <strong>{summary.missing}</strong>
          </div>
          <div>
            <span>Thay đổi chờ duyệt</span>
            <strong>{summary.late}</strong>
          </div>
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
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label className="availability-filter-field">
            <span>Loại hợp đồng</span>
            <select
              aria-label="Loại hợp đồng"
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value)}
            >
              <option value="all">Tất cả loại hợp đồng</option>
              {employmentOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="availability-filter-field">
            <span>Vai trò / phòng ban</span>
            <select
              aria-label="Vai trò hoặc phòng ban"
              value={roleDepartment}
              onChange={(e) => setRoleDepartment(e.target.value)}
            >
              <option value="all">Tất cả vai trò / phòng ban</option>
              {roleDepartmentOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="availability-filter-field">
            <span>Ca có thể làm</span>
            <select
              aria-label="Ca có thể làm"
              value={onlyShiftType}
              onChange={(e) => setOnlyShiftType(e.target.value)}
            >
              <option value="all">Mọi ca</option>
              {shiftTypes.map((shift) => (
                <option key={shift.key} value={shift.key}>
                  {shift.label}
                </option>
              ))}
            </select>
          </label>
          <label className="toggle-missing">
            <input
              type="checkbox"
              checked={onlyMissing}
              onChange={(e) => setOnlyMissing(e.target.checked)}
            />
            <span>Chỉ hiện nhân viên thiếu đăng ký</span>
          </label>
        </section>

        <div className="availability-results-bar" role="status" aria-live="polite">
          <span>
            Đang hiển thị <strong>{filteredRows.length}</strong> / {rows.length} nhân viên
          </span>
          {search ||
          employmentType !== "all" ||
          roleDepartment !== "all" ||
          onlyShiftType !== "all" ||
          onlyMissing ? (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setEmploymentType("all");
                setRoleDepartment("all");
                setOnlyShiftType("all");
                setOnlyMissing(false);
              }}
            >
              Xóa bộ lọc
            </button>
          ) : null}
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
            <span>
              Bảng dưới vẫn hiển thị lịch làm cố định của nhân viên toàn thời gian
              và đánh dấu các trường hợp chưa đăng ký.
            </span>
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
          <div className="availability-table-shell">
            <table className="availability-snapshot-table">
              <thead>
                <tr>
                  <th rowSpan={2} className="employee-col">
                    Nhân viên
                  </th>
                  {days.map((d) => (
                    <th key={String(d)} colSpan={shiftTypes.length}>
                      {format(d, "EEE dd/MM", { locale: vi })}
                    </th>
                  ))}
                </tr>
                <tr>
                  {days.flatMap((d) =>
                    shiftTypes.map((s) => (
                      <th key={`${String(d)}-${s.key}`}>
                        <span>{s.label}</span>
                        {s.startTime && s.endTime ? (
                          <small>
                            {s.startTime}-{s.endTime}
                          </small>
                        ) : null}
                      </th>
                    )),
                  )}
                </tr>
              </thead>
              <tbody>
                {!filteredRows.length ? (
                  <tr>
                    <td
                      className="availability-filter-empty"
                      colSpan={1 + days.length * shiftTypes.length}
                    >
                      Không có nhân viên phù hợp với bộ lọc hiện tại.
                    </td>
                  </tr>
                ) : null}
                {filteredRows.map(
                  ({ person, cellMap, hasLateChangePending, pendingSlotsCount }) => (
                    <tr key={person.id}>
                      <td className="employee-col employee-cell">
                        <strong>{person.fullName}</strong>
                        <span>{person.employeeCode || "Chưa có mã"}</span>
                        {hasLateChangePending ? (
                          <em>Chờ duyệt thay đổi muộn</em>
                        ) : null}
                        {pendingSlotsCount > 0 ? <small>Chờ duyệt: {pendingSlotsCount}</small> : null}
                      </td>
                      {days.flatMap((d) =>
                        shiftTypes.map((s) => {
                          const key = `${format(d, "yyyy-MM-dd")}|${s.key}`;
                          const cell = cellMap[key] || {
                            state: "not_registered",
                            label: "-",
                            className: "neutral",
                          };
                          const ui = getCellUi(cell);
                          return (
                            <td
                              key={`${person.id}-${key}`}
                              className={`availability-cell ${ui.tone}`}
                              title={ui.label}
                              aria-label={`${person.fullName || "Nhân viên"}, ${format(d, "dd/MM")}, ${s.label}: ${ui.label}`}
                            >
                              <span>{ui.short}</span>
                            </td>
                          );
                        }),
                      )}
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
};

const AvailabilitySnapshotModal = ({ isOpen, ...rest }) => {
  if (!isOpen) return null;
  return <AvailabilitySnapshotModalContent {...rest} />;
};

export default AvailabilitySnapshotModal;
