import React, { useEffect, useMemo, useState } from "react";
import Modal from "../../../common/Modal";
import "./AddShiftModal.scss";
import {
  shiftTypes,
  formatDate,
  jobOptions,
  getJobName,
  normalizeRoleKey,
  resolveConcreteStaffRoleSlug,
} from "../utils/scheduleHelpers";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Search,
  UserX,
  Users,
  X,
} from "lucide-react";

const DAY_KEY_BY_INDEX = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const OFFICIAL_AVAILABILITY_STATUSES = new Set([
  "submitted",
  "approved",
  "locked",
]);

const normalizeWorkingDayKey = (value) =>
  String(value || "")
    .trim()
    .toUpperCase();

const normalizeEmploymentType = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const normalizeAvailabilityStatus = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const normalizeShiftType = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const normalizeLabel = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const getSelectedDateDayKey = (selectedDate) => {
  if (!selectedDate) return "";
  const date = new Date(selectedDate);
  if (Number.isNaN(date.getTime())) return "";
  return DAY_KEY_BY_INDEX[date.getDay()] || "";
};

const isStaffWorkingOnDate = (staff, selectedDate) => {
  const selectedDayKey = getSelectedDateDayKey(selectedDate);
  if (!selectedDayKey) return true;

  const workingDays = Array.isArray(staff?.workingDays)
    ? staff.workingDays
    : [];
  if (!workingDays.length) return false;

  return workingDays.map(normalizeWorkingDayKey).includes(selectedDayKey);
};

const isPartTimeLike = (staff) => {
  const type = normalizeEmploymentType(staff?.employmentType);
  return type === "part_time" || type === "seasonal";
};

const toLocalYmd = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const hasOfficialSlot = (
  submission,
  selectedDate,
  selectedShiftType,
  expectedStatus,
) => {
  if (!submission) return false;
  if (
    !OFFICIAL_AVAILABILITY_STATUSES.has(
      normalizeAvailabilityStatus(submission.status),
    )
  ) {
    return false;
  }

  const targetDate = toLocalYmd(selectedDate);
  const targetShift = normalizeShiftType(selectedShiftType);

  return (submission.slots || []).some(
    (slot) =>
      toLocalYmd(slot.date) === targetDate &&
      normalizeShiftType(slot.shiftType) === targetShift &&
      normalizeAvailabilityStatus(slot.status) === expectedStatus,
  );
};

const normalizeMandatoryRoles = (roles = []) =>
  Array.from(
    new Set(
      (roles || []).map((role) => normalizeRoleKey(role)).filter(Boolean),
    ),
  );

const buildCompactRoleLabel = ({ roleName, positionTitle, fallbackRole }) => {
  const parts = [roleName, positionTitle, fallbackRole].reduce((acc, part) => {
    const trimmed = String(part || "").trim();
    if (!trimmed) return acc;
    const key = normalizeLabel(trimmed);
    if (acc.some((item) => normalizeLabel(item) === key)) return acc;
    return [...acc, trimmed];
  }, []);

  return parts.join(" · ") || "Chưa xác định vị trí";
};

const getStaffName = (staff) =>
  staff?.name || staff?.fullName || staff?.employeeName || "Nhân viên";

const AddShiftModal = ({
  isOpen,
  onClose,
  selectedDate,
  selectedShiftType,
  shiftConfig = shiftTypes,
  staffList = [],
  availabilitySubmissions = [],
  mandatoryShiftRoles = [],
  onConfirm,
  isSchedulePublished = false,
  submitting = false,
}) => {
  const lockedMandatoryRoles = useMemo(
    () => normalizeMandatoryRoles(mandatoryShiftRoles),
    [mandatoryShiftRoles],
  );
  const lockedMandatoryRoleSet = useMemo(
    () => new Set(lockedMandatoryRoles),
    [lockedMandatoryRoles],
  );
  const lockedMandatoryRolesKey = lockedMandatoryRoles.join("|");

  const [newShift, setNewShift] = useState({
    essentialJobs: [],
    staffIds: [],
    notes: "",
  });
  const [search, setSearch] = useState("");
  const [staffRoleFilter, setStaffRoleFilter] = useState("all");
  const [submitError, setSubmitError] = useState("");
  const [publishedReason, setPublishedReason] = useState("");
  const [notifyEmployees, setNotifyEmployees] = useState(true);
  const [allowOverride, setAllowOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");

  const finalEssentialJobs = useMemo(
    () =>
      normalizeMandatoryRoles([
        ...lockedMandatoryRoles,
        ...(newShift.essentialJobs || []),
      ]),
    [lockedMandatoryRolesKey, newShift.essentialJobs],
  );

  useEffect(() => {
    if (!isOpen) return;
    setNewShift({
      essentialJobs: lockedMandatoryRoles,
      staffIds: [],
      notes: "",
    });
    setSearch("");
    setStaffRoleFilter("all");
    setSubmitError("");
    setPublishedReason("");
    setNotifyEmployees(true);
    setAllowOverride(false);
    setOverrideReason("");
  }, [isOpen, selectedDate, selectedShiftType, lockedMandatoryRolesKey]);

  useEffect(() => {
    if (!isOpen) return;
    setNewShift((previous) => ({
      ...previous,
      essentialJobs: normalizeMandatoryRoles([
        ...lockedMandatoryRoles,
        ...(previous.essentialJobs || []),
      ]),
    }));
  }, [isOpen, lockedMandatoryRolesKey]);

  const availabilityByEmployeeId = useMemo(() => {
    const map = new Map();
    (availabilitySubmissions || []).forEach((submission) => {
      if (!submission?.employeeId) return;
      map.set(String(submission.employeeId), submission);
    });
    return map;
  }, [availabilitySubmissions]);

  const getStaffAvailabilityState = (staff) => {
    const submission = availabilityByEmployeeId.get(String(staff.id));

    if (isPartTimeLike(staff)) {
      if (
        hasOfficialSlot(
          submission,
          selectedDate,
          selectedShiftType,
          "available",
        )
      ) {
        return {
          selectable: true,
          reason: "available_submission",
          label: "Đã đăng ký có thể làm",
        };
      }

      return {
        selectable: false,
        reason: "missing_or_unmatched_part_time_availability",
        label: "Không có lịch rảnh đã duyệt phù hợp",
      };
    }

    if (!isStaffWorkingOnDate(staff, selectedDate)) {
      return {
        selectable: false,
        reason: "outside_working_days",
        label: "Ngoài ngày làm việc mặc định",
      };
    }

    if (
      hasOfficialSlot(
        submission,
        selectedDate,
        selectedShiftType,
        "unavailable",
      )
    ) {
      return {
        selectable: false,
        reason: "full_time_unavailable_exception",
        label: "Đã báo không khả dụng cho ca này",
      };
    }

    return {
      selectable: true,
      reason: "working_day",
      label: "Theo ngày làm việc mặc định",
    };
  };

  const getStaffRoleMatch = (staff) => {
    const roleSlug = resolveConcreteStaffRoleSlug(staff);
    const roleLabel = roleSlug ? getJobName(roleSlug) : "Chưa xác định vị trí";

    if (!finalEssentialJobs.length) {
      return { roleSlug, roleLabel, matched: true };
    }

    const matched = Boolean(
      roleSlug &&
        finalEssentialJobs.some((role) => normalizeRoleKey(role) === roleSlug),
    );

    return { roleSlug, roleLabel, matched };
  };

  const selectedStaff = useMemo(
    () =>
      staffList.filter((person) =>
        newShift.staffIds.some((id) => String(id) === String(person.id)),
      ),
    [newShift.staffIds, staffList],
  );

  const selectedRoleSet = useMemo(
    () =>
      new Set(
        selectedStaff
          .map((person) => resolveConcreteStaffRoleSlug(person))
          .filter(Boolean),
      ),
    [selectedStaff],
  );

  const missingRequiredRoles = useMemo(
    () =>
      finalEssentialJobs.filter(
        (role) => !selectedRoleSet.has(normalizeRoleKey(role)),
      ),
    [finalEssentialJobs, selectedRoleSet],
  );

  const isCoverageReady =
    selectedStaff.length > 0 && missingRequiredRoles.length === 0;

  const candidateRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return staffList
      .map((staff) => {
        const availability = getStaffAvailabilityState(staff);
        const role = getStaffRoleMatch(staff);
        const selected = newShift.staffIds.some(
          (id) => String(id) === String(staff.id),
        );
        return { staff, availability, role, selected };
      })
      .filter((row) => {
        if (staffRoleFilter === "blocked" && row.availability.selectable) {
          return false;
        }
        if (staffRoleFilter === "selected" && !row.selected) return false;
        if (
          staffRoleFilter === "matched" &&
          (!row.availability.selectable || !row.role.matched)
        ) {
          return false;
        }
        if (
          staffRoleFilter === "mismatch" &&
          (!row.availability.selectable || row.role.matched)
        ) {
          return false;
        }

        if (!normalizedSearch) return true;
        const searchableText = [
          getStaffName(row.staff),
          row.staff.employeeCode,
          row.staff.departmentLabel,
          row.staff.positionTitle,
          row.staff.roleName,
          row.role.roleLabel,
          row.availability.label,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchableText.includes(normalizedSearch);
      })
      .sort((left, right) => {
        if (left.selected !== right.selected) return left.selected ? -1 : 1;
        if (left.availability.selectable !== right.availability.selectable) {
          return left.availability.selectable ? -1 : 1;
        }
        if (left.role.matched !== right.role.matched) {
          return left.role.matched ? -1 : 1;
        }
        return getStaffName(left.staff).localeCompare(
          getStaffName(right.staff),
          "vi",
        );
      });
  }, [
    staffList,
    search,
    staffRoleFilter,
    newShift.staffIds,
    finalEssentialJobs,
    selectedDate,
    selectedShiftType,
    availabilityByEmployeeId,
  ]);

  const blockedVisibilityStats = useMemo(
    () =>
      staffList.reduce(
        (summary, staff) => {
          const availability = getStaffAvailabilityState(staff);
          if (!availability.selectable) {
            summary.total += 1;
            summary[availability.reason] =
              (summary[availability.reason] || 0) + 1;
          }
          return summary;
        },
        { total: 0 },
      ),
    [staffList, selectedDate, selectedShiftType, availabilityByEmployeeId],
  );

  const toggleJob = (jobValue) => {
    const key = normalizeRoleKey(jobValue);
    if (!key || lockedMandatoryRoleSet.has(key)) return;
    setSubmitError("");
    setNewShift((previous) => {
      const current = normalizeMandatoryRoles(previous.essentialJobs);
      return {
        ...previous,
        essentialJobs: current.includes(key)
          ? current.filter((job) => job !== key)
          : [...current, key],
      };
    });
  };

  const toggleStaff = (staffId, selectable = true) => {
    if (!selectable) return;
    setSubmitError("");
    setNewShift((previous) => {
      const exists = previous.staffIds.some(
        (id) => String(id) === String(staffId),
      );
      return {
        ...previous,
        staffIds: exists
          ? previous.staffIds.filter((id) => String(id) !== String(staffId))
          : [...previous.staffIds, staffId],
      };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError("");

    if (!selectedStaff.length) {
      setSubmitError("Cần chọn ít nhất một nhân viên cho ca làm.");
      return;
    }
    if (missingRequiredRoles.length) {
      setSubmitError(
        `Ca làm còn thiếu vị trí bắt buộc: ${missingRequiredRoles
          .map((role) => getJobName(role))
          .join(", ")}.`,
      );
      return;
    }
    if (isSchedulePublished && !publishedReason.trim()) {
      setSubmitError(
        "Lịch đã công bố, cần nhập lý do khi thêm nhân viên vào ca.",
      );
      return;
    }
    if (isSchedulePublished && allowOverride && !overrideReason.trim()) {
      setSubmitError("Cần nhập lý do ghi đè chính sách.");
      return;
    }

    try {
      await onConfirm({
        ...newShift,
        essentialJobs: finalEssentialJobs,
        date: selectedDate,
        shiftType: selectedShiftType,
        publishedReason: publishedReason.trim(),
        notifyEmployees,
        allowOverride,
        overrideReason: overrideReason.trim(),
      });
    } catch (error) {
      setSubmitError(error?.message || "Không thể tạo ca làm.");
    }
  };

  const coverageMessage = !selectedStaff.length
    ? "Chưa chọn nhân viên. Ca cần ít nhất một người để được tạo."
    : missingRequiredRoles.length
      ? `Còn thiếu: ${missingRequiredRoles
          .map((role) => getJobName(role))
          .join(", ")}.`
      : "Đã đủ nhân viên cho các vị trí bắt buộc.";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Thêm ca làm việc"
      size="xl"
      className="add-shift-workspace-modal"
    >
      <Modal.Body className="add-shift-workspace-body">
        <form
          id="add-shift-workspace-form"
          className="add-modal-content add-shift-workspace"
          onSubmit={handleSubmit}
        >
          <section className="add-shift-workspace__topline">
            <div className="shift-info-box" aria-label="Thông tin ca làm">
              <div className="info-item">
                <span className="label">Loại ca</span>
                <span className="value">
                  {shiftConfig[selectedShiftType]?.label || "Chưa xác định"}
                </span>
              </div>
              <div className="info-item">
                <span className="label">Thời gian</span>
                <span className="value">
                  {shiftConfig[selectedShiftType]?.time || "--:--"}
                </span>
              </div>
              <div className="info-item">
                <span className="label">Ngày</span>
                <span className="value">
                  {selectedDate ? formatDate(selectedDate) : "Chưa chọn"}
                </span>
              </div>
            </div>

            <div
              className={`shift-coverage-summary ${isCoverageReady ? "ready" : "needs-attention"}`}
              role="status"
              aria-live="polite"
            >
              <div className="coverage-icon" aria-hidden="true">
                {isCoverageReady ? (
                  <CheckCircle2 size={20} />
                ) : (
                  <AlertTriangle size={20} />
                )}
              </div>
              <div className="coverage-copy">
                <strong>
                  {selectedStaff.length} nhân viên đã chọn
                  {finalEssentialJobs.length
                    ? ` · ${finalEssentialJobs.length} vị trí bắt buộc`
                    : ""}
                </strong>
                <span>{coverageMessage}</span>
              </div>
            </div>
          </section>

          {isSchedulePublished ? (
            <div className="published-change-warning">
              <strong>Lịch đã được công bố</strong>
              <p>
                Thay đổi sẽ được kiểm tra chính sách, ghi nhật ký và gửi thông
                báo đến nhân viên liên quan.
              </p>
            </div>
          ) : null}

          <div className="add-shift-workspace__grid">
            <section className="add-shift-workspace__main form-group">
              <div className="staff-section-heading">
                <div>
                  <span className="workspace-eyebrow">Phân công</span>
                  <h3>Phân công nhân viên</h3>
                </div>
                <span className="selected-counter">
                  <Users size={15} /> {selectedStaff.length} đã chọn
                </span>
              </div>

              <div className="staff-selector">
                <div className="search-wrapper">
                  <Search size={16} aria-hidden="true" />
                  <input
                    className="search-input"
                    type="search"
                    aria-label="Tìm nhân viên để phân công"
                    placeholder="Tìm tên, mã nhân viên, vị trí hoặc lý do bị chặn…"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>

                <div
                  className="staff-role-filter-tabs"
                  aria-label="Lọc danh sách nhân viên"
                >
                  {[
                    { value: "all", label: `Tất cả (${staffList.length})` },
                    { value: "matched", label: "Đề xuất tốt" },
                    { value: "mismatch", label: "Khác vị trí" },
                    { value: "selected", label: `Đã chọn (${selectedStaff.length})` },
                    {
                      value: "blocked",
                      label: `Không thể chọn (${blockedVisibilityStats.total})`,
                    },
                  ].map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      className={staffRoleFilter === item.value ? "active" : ""}
                      aria-pressed={staffRoleFilter === item.value}
                      onClick={() => setStaffRoleFilter(item.value)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {blockedVisibilityStats.total > 0 ? (
                  <div className="staff-filter-hint" role="note">
                    <UserX size={16} aria-hidden="true" />
                    <span>
                      Nhân viên không phù hợp vẫn được hiển thị ở trạng thái khóa
                      để quản lý biết chính xác nguyên nhân.
                    </span>
                  </div>
                ) : null}

                <div className="staff-list" aria-label="Danh sách nhân viên">
                  {candidateRows.map(({ staff, availability, role, selected }) => {
                    const compactRoleLabel = buildCompactRoleLabel({
                      roleName: staff.roleName,
                      positionTitle: staff.positionTitle,
                      fallbackRole: role.roleLabel,
                    });
                    const salary = Number(staff.salary || 0);
                    const staffName = getStaffName(staff);

                    return (
                      <button
                        type="button"
                        key={staff.id}
                        className={`staff-item ${selected ? "selected" : ""} ${!availability.selectable ? "blocked" : ""}`}
                        aria-pressed={availability.selectable ? selected : undefined}
                        aria-label={
                          availability.selectable
                            ? `${selected ? "Bỏ chọn" : "Chọn"} ${staffName}`
                            : `Không thể chọn ${staffName}: ${availability.label}`
                        }
                        disabled={!availability.selectable}
                        onClick={() => toggleStaff(staff.id, availability.selectable)}
                      >
                        <span className="checkbox-custom" aria-hidden="true">
                          {selected ? <span className="dot" /> : null}
                          {!availability.selectable ? <X size={12} /> : null}
                        </span>
                        <span className="staff-info">
                          <span className="name">{staffName}</span>
                          <span className="role">
                            {compactRoleLabel} · {staff.departmentLabel || "Khác"}
                          </span>
                          <span
                            className={`role-match ${availability.selectable ? "matched" : "blocked-reason"}`}
                          >
                            {availability.label}
                          </span>
                          {finalEssentialJobs.length > 0 && availability.selectable ? (
                            <span
                              className={`role-match ${role.matched ? "matched" : "mismatch"}`}
                            >
                              {role.matched
                                ? "Khớp vị trí bắt buộc"
                                : "Không khớp vị trí bắt buộc"}
                            </span>
                          ) : null}
                        </span>
                        {salary > 0 ? (
                          <span className="salary">
                            {salary.toLocaleString("vi-VN")}đ/giờ
                          </span>
                        ) : null}
                      </button>
                    );
                  })}

                  {!candidateRows.length ? (
                    <p className="no-result" role="status">
                      Không tìm thấy nhân viên phù hợp với từ khóa và bộ lọc.
                    </p>
                  ) : null}
                </div>
              </div>
            </section>

            <aside className="add-shift-workspace__side">
              <section className="selection-panel" aria-label="Nhân viên đã chọn">
                <div className="selection-panel__heading">
                  <div>
                    <span className="workspace-eyebrow">Tóm tắt ca</span>
                    <h3>Nhân viên đã chọn</h3>
                  </div>
                  <span>{selectedStaff.length}</span>
                </div>

                <div className="selected-staff-list">
                  {selectedStaff.length ? (
                    selectedStaff.map((staff) => {
                      const role = getStaffRoleMatch(staff);
                      return (
                        <div key={staff.id} className="selected-staff-item">
                          <div>
                            <strong>{getStaffName(staff)}</strong>
                            <small>{role.roleLabel}</small>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleStaff(staff.id)}
                            aria-label={`Bỏ ${getStaffName(staff)} khỏi ca`}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      );
                    })
                  ) : (
                    <p className="selection-panel__empty">
                      Chọn nhân viên ở danh sách bên trái. Người được chọn sẽ luôn
                      hiển thị tại đây.
                    </p>
                  )}
                </div>
              </section>

              <section className="required-role-panel">
                <div className="selection-panel__heading">
                  <div>
                    <span className="workspace-eyebrow">Kiểm tra bao phủ</span>
                    <h3>Vị trí bắt buộc</h3>
                  </div>
                </div>

                <div className="required-role-status-list">
                  {finalEssentialJobs.length ? (
                    finalEssentialJobs.map((role) => {
                      const covered = selectedRoleSet.has(normalizeRoleKey(role));
                      return (
                        <div
                          key={role}
                          className={covered ? "covered" : "missing"}
                        >
                          {covered ? (
                            <CheckCircle2 size={15} />
                          ) : (
                            <AlertTriangle size={15} />
                          )}
                          <span>{getJobName(role)}</span>
                          <strong>{covered ? "Đã đủ" : "Còn thiếu"}</strong>
                        </div>
                      );
                    })
                  ) : (
                    <p className="selection-panel__empty">
                      Chưa cấu hình vị trí bắt buộc cho ca này.
                    </p>
                  )}
                </div>

                <details className="required-role-editor">
                  <summary>Chỉnh vị trí bắt buộc</summary>
                  <p className="job-helper-text">
                    Vị trí từ chính sách đã được khóa. Có thể chọn thêm vị trí
                    riêng cho ca này.
                  </p>
                  <div className="job-grid" aria-label="Vị trí bắt buộc cho ca">
                    {jobOptions.map((job) => {
                      const jobKey = normalizeRoleKey(job.value);
                      const isLocked = lockedMandatoryRoleSet.has(jobKey);
                      const isChecked =
                        finalEssentialJobs.includes(jobKey) || isLocked;
                      return (
                        <button
                          key={job.value}
                          type="button"
                          className={`job-checkbox ${isChecked ? "checked" : ""} ${isLocked ? "locked" : ""}`}
                          title={
                            isLocked
                              ? "Vị trí này được thiết lập trong Cài đặt ca và không thể bỏ chọn tại đây."
                              : `Chọn vị trí ${job.label}`
                          }
                          aria-pressed={isChecked}
                          disabled={isLocked}
                          onClick={() => toggleJob(job.value)}
                        >
                          <span className="emoji" aria-hidden="true">
                            {job.emoji}
                          </span>
                          <span className="text">{job.label}</span>
                          {isChecked ? (
                            <Check size={16} className="check-icon" />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </details>
              </section>

              <details className="add-shift-advanced" open={isSchedulePublished}>
                <summary>Tùy chọn và ghi chú</summary>

                {isSchedulePublished ? (
                  <div className="advanced-field-group">
                    <label htmlFor="published-shift-reason">
                      Lý do thêm nhân viên vào lịch đã công bố
                      <span className="required"> *</span>
                    </label>
                    <textarea
                      id="published-shift-reason"
                      className="note-input"
                      rows={3}
                      placeholder="Ví dụ: bổ sung nhân sự do nhu cầu vận hành tăng…"
                      value={publishedReason}
                      onChange={(event) => setPublishedReason(event.target.value)}
                    />

                    <label className="published-check-row">
                      <input
                        type="checkbox"
                        checked={notifyEmployees}
                        onChange={(event) =>
                          setNotifyEmployees(event.target.checked)
                        }
                      />
                      <span>Gửi thông báo đến nhân viên được thêm vào ca</span>
                    </label>

                    <label className="published-check-row">
                      <input
                        type="checkbox"
                        checked={allowOverride}
                        onChange={(event) =>
                          setAllowOverride(event.target.checked)
                        }
                      />
                      <span>Cho phép ghi đè khi chỉ có cảnh báo chính sách</span>
                    </label>

                    {allowOverride ? (
                      <textarea
                        className="note-input"
                        rows={2}
                        aria-label="Lý do ghi đè chính sách"
                        placeholder="Lý do ghi đè chính sách…"
                        value={overrideReason}
                        onChange={(event) =>
                          setOverrideReason(event.target.value)
                        }
                      />
                    ) : null}
                  </div>
                ) : null}

                <div className="advanced-field-group">
                  <label htmlFor="new-shift-note">Ghi chú ca</label>
                  <textarea
                    id="new-shift-note"
                    className="note-input"
                    rows={2}
                    placeholder="Ví dụ: cần chuẩn bị tiệc sinh nhật…"
                    value={newShift.notes}
                    onChange={(event) =>
                      setNewShift((previous) => ({
                        ...previous,
                        notes: event.target.value,
                      }))
                    }
                  />
                </div>
              </details>
            </aside>
          </div>

          {submitError ? (
            <div className="submit-error" role="alert">
              {submitError}
            </div>
          ) : null}
        </form>
      </Modal.Body>

      <Modal.Footer className="add-shift-workspace-footer">
        <div className="add-shift-workspace-footer__status">
          {isCoverageReady ? (
            <CheckCircle2 size={17} />
          ) : (
            <AlertTriangle size={17} />
          )}
          <span>{coverageMessage}</span>
        </div>
        <div className="add-shift-workspace-footer__actions">
          <button type="button" className="btn-cancel" onClick={onClose}>
            Hủy
          </button>
          <button
            type="submit"
            form="add-shift-workspace-form"
            className="btn-submit"
            disabled={submitting}
          >
            {submitting
              ? "Đang lưu…"
              : isSchedulePublished
                ? "Kiểm tra & thêm vào lịch"
                : "Tạo ca làm việc"}
          </button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default AddShiftModal;
