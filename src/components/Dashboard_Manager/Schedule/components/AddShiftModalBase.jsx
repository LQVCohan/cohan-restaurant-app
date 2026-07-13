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
import { AlertTriangle, Check, CheckCircle2, Search, Users } from "lucide-react";

const DAY_KEY_BY_INDEX = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

const normalizeWorkingDayKey = (value) =>
  String(value || "")
    .trim()
    .toUpperCase();

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
const OFFICIAL_AVAILABILITY_STATUSES = new Set([
  "submitted",
  "approved",
  "locked",
]);
const isPartTimeLike = (staff) => {
  const type = normalizeEmploymentType(staff?.employmentType);
  return type === "part_time" || type === "seasonal";
};
const toLocalYmd = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const hasOfficialAvailableSlot = (
  submission,
  selectedDate,
  selectedShiftType,
) => {
  if (!submission) return false;
  if (
    !OFFICIAL_AVAILABILITY_STATUSES.has(
      normalizeAvailabilityStatus(submission.status),
    )
  )
    return false;
  const targetDate = toLocalYmd(selectedDate);
  const targetShift = normalizeShiftType(selectedShiftType);
  return (submission.slots || []).some(
    (slot) =>
      toLocalYmd(slot.date) === targetDate &&
      normalizeShiftType(slot.shiftType) === targetShift &&
      normalizeAvailabilityStatus(slot.status) === "available",
  );
};
const hasOfficialUnavailableSlot = (
  submission,
  selectedDate,
  selectedShiftType,
) => {
  if (!submission) return false;
  if (
    !OFFICIAL_AVAILABILITY_STATUSES.has(
      normalizeAvailabilityStatus(submission.status),
    )
  )
    return false;
  const targetDate = toLocalYmd(selectedDate);
  const targetShift = normalizeShiftType(selectedShiftType);
  return (submission.slots || []).some(
    (slot) =>
      toLocalYmd(slot.date) === targetDate &&
      normalizeShiftType(slot.shiftType) === targetShift &&
      normalizeAvailabilityStatus(slot.status) === "unavailable",
  );
};
const normalizeMandatoryRoles = (roles = []) =>
  Array.from(
    new Set(
      (roles || []).map((role) => normalizeRoleKey(role)).filter(Boolean),
    ),
  );

const normalizeLabel = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

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
    setNewShift((prev) => ({
      ...prev,
      essentialJobs: normalizeMandatoryRoles([
        ...lockedMandatoryRoles,
        ...(prev.essentialJobs || []),
      ]),
    }));
  }, [isOpen, lockedMandatoryRolesKey]);

  const toggleJob = (jobValue) => {
    const key = normalizeRoleKey(jobValue);
    if (!key || lockedMandatoryRoleSet.has(key)) return;
    setSubmitError("");
    setNewShift((prev) => {
      const current = normalizeMandatoryRoles(prev.essentialJobs);
      const exists = current.includes(key);
      return {
        ...prev,
        essentialJobs: exists
          ? current.filter((job) => job !== key)
          : [...current, key],
      };
    });
  };

  const toggleStaff = (staffId) => {
    setSubmitError("");
    setNewShift((prev) => {
      const exists = prev.staffIds.includes(staffId);
      return {
        ...prev,
        staffIds: exists
          ? prev.staffIds.filter((id) => id !== staffId)
          : [...prev.staffIds, staffId],
      };
    });
  };

  const availabilityByEmployeeId = useMemo(() => {
    const map = new Map();
    (availabilitySubmissions || []).forEach((submission) => {
      if (!submission?.employeeId) return;
      map.set(String(submission.employeeId), submission);
    });
    return map;
  }, [availabilitySubmissions]);

  const getStaffAvailabilityVisibility = (staff) => {
    const submission = availabilityByEmployeeId.get(String(staff.id));
    if (isPartTimeLike(staff)) {
      if (
        hasOfficialAvailableSlot(submission, selectedDate, selectedShiftType)
      ) {
        return {
          visible: true,
          reason: "available_submission",
          label: "Đã đăng ký có thể làm",
        };
      }
      return {
        visible: false,
        reason: "missing_or_unmatched_part_time_availability",
        label: "Không có lịch rảnh phù hợp",
      };
    }
    if (!isStaffWorkingOnDate(staff, selectedDate)) {
      return {
        visible: false,
        reason: "outside_working_days",
        label: "Ngoài ngày làm việc mặc định",
      };
    }
    if (
      hasOfficialUnavailableSlot(submission, selectedDate, selectedShiftType)
    ) {
      return {
        visible: false,
        reason: "full_time_unavailable_exception",
        label: "Đã báo không khả dụng",
      };
    }
    return {
      visible: true,
      reason: "working_day",
      label: "Theo ngày làm việc mặc định",
    };
  };

  const getStaffRoleMatch = (staff) => {
    const roleSlug = resolveConcreteStaffRoleSlug(staff);

    if (!finalEssentialJobs.length) {
      return {
        roleSlug,
        roleLabel: roleSlug ? getJobName(roleSlug) : "Chưa xác định vị trí",
        matched: true,
      };
    }

    const matched = Boolean(
      roleSlug &&
        finalEssentialJobs.some((role) => normalizeRoleKey(role) === roleSlug),
    );

    return {
      roleSlug,
      roleLabel: roleSlug ? getJobName(roleSlug) : "Chưa xác định vị trí",
      matched,
    };
  };

  const selectedStaff = useMemo(
    () => staffList.filter((person) => newShift.staffIds.includes(person.id)),
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

  const filteredStaff = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return staffList.filter((staff) => {
      const visibility = getStaffAvailabilityVisibility(staff);
      if (!visibility.visible) return false;

      const roleMatch = getStaffRoleMatch(staff);
      const isSelected = newShift.staffIds.includes(staff.id);

      if (staffRoleFilter === "matched" && !roleMatch.matched) return false;
      if (staffRoleFilter === "mismatch" && roleMatch.matched) return false;
      if (staffRoleFilter === "selected" && !isSelected) return false;

      if (!normalizedSearch) return true;

      const searchableText = [
        staff.name,
        staff.employeeCode,
        staff.departmentLabel,
        staff.positionTitle,
        staff.roleName,
        roleMatch.roleLabel,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedSearch);
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

  const hiddenVisibilityStats = useMemo(
    () =>
      staffList.reduce(
        (acc, staff) => {
          const visibility = getStaffAvailabilityVisibility(staff);
          if (!visibility.visible) {
            acc.total += 1;
            acc[visibility.reason] = (acc[visibility.reason] || 0) + 1;
          }
          return acc;
        },
        { total: 0 },
      ),
    [staffList, selectedDate, selectedShiftType, availabilityByEmployeeId],
  );

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
    <Modal isOpen={isOpen} onClose={onClose} title="Thêm ca làm việc">
      <form className="add-modal-content" onSubmit={handleSubmit}>
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

        {isSchedulePublished ? (
          <div className="published-change-warning">
            <strong>Lịch đã được công bố</strong>
            <p>
              Thêm nhân viên vào ca này là thay đổi lịch đã công bố. Hệ thống sẽ
              kiểm tra chính sách, ghi nhật ký và gửi thông báo đến nhân viên liên
              quan.
            </p>
          </div>
        ) : null}

        <div className="form-group">
          <label id="required-jobs-label">Vị trí bắt buộc cho ca</label>
          <p className="job-helper-text">
            Vị trí từ chính sách đã được khóa. Có thể chọn thêm vị trí riêng cho ca
            này.
          </p>
          <div className="job-grid" aria-labelledby="required-jobs-label">
            {jobOptions.map((job) => {
              const jobKey = normalizeRoleKey(job.value);
              const isLocked = lockedMandatoryRoleSet.has(jobKey);
              const isChecked = finalEssentialJobs.includes(jobKey) || isLocked;
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
                  {isChecked && <Check size={16} className="check-icon" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="form-group">
          <label>Phân công nhân viên ({newShift.staffIds.length})</label>
          <div className="staff-selector">
            <div className="search-wrapper">
              <Search size={16} aria-hidden="true" />
              <input
                className="search-input"
                type="search"
                aria-label="Tìm nhân viên để phân công"
                placeholder="Tìm tên, mã nhân viên, vị trí…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div
              className="staff-role-filter-tabs"
              aria-label="Lọc danh sách nhân viên"
            >
              {[
                { value: "all", label: "Tất cả" },
                { value: "matched", label: "Khớp vị trí" },
                { value: "mismatch", label: "Không khớp" },
                { value: "selected", label: "Đã chọn" },
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
            {hiddenVisibilityStats.total > 0 ? (
              <details className="staff-filter-hint">
                <summary>
                  Đã ẩn {hiddenVisibilityStats.total} nhân viên không phù hợp với
                  ngày hoặc ca này
                </summary>
                <span>
                  Bán thời gian chưa đăng ký phù hợp: {" "}
                  {hiddenVisibilityStats.missing_or_unmatched_part_time_availability ||
                    0}
                  . Toàn thời gian ngoài ngày làm mặc định: {" "}
                  {hiddenVisibilityStats.outside_working_days || 0}. Đã báo không
                  khả dụng: {" "}
                  {hiddenVisibilityStats.full_time_unavailable_exception || 0}.
                </span>
              </details>
            ) : null}

            <div className="staff-list" aria-label="Nhân viên có thể phân công">
              {filteredStaff.map((staff) => {
                const isSelected = newShift.staffIds.includes(staff.id);
                const visibility = getStaffAvailabilityVisibility(staff);
                const { roleLabel, matched: roleMatched } =
                  getStaffRoleMatch(staff);
                const compactRoleLabel = buildCompactRoleLabel({
                  roleName: staff.roleName,
                  positionTitle: staff.positionTitle,
                  fallbackRole: roleLabel,
                });
                const salary = Number(staff.salary || 0);
                return (
                  <button
                    type="button"
                    key={staff.id}
                    className={`staff-item ${isSelected ? "selected" : ""}`}
                    aria-pressed={isSelected}
                    onClick={() => toggleStaff(staff.id)}
                  >
                    <span className="checkbox-custom" aria-hidden="true">
                      {isSelected && <span className="dot" />}
                    </span>
                    <span className="staff-info">
                      <span className="name">{staff.name}</span>
                      <span className="role">
                        {compactRoleLabel} · {staff.departmentLabel || "Khác"}
                      </span>
                      <span className="role-match matched">
                        {visibility.label}
                      </span>
                      {finalEssentialJobs.length > 0 ? (
                        <span
                          className={`role-match ${roleMatched ? "matched" : "mismatch"}`}
                        >
                          {roleMatched
                            ? "Khớp vị trí"
                            : "Không khớp vị trí bắt buộc"}
                        </span>
                      ) : null}
                    </span>
                    <span className="salary">
                      {salary.toLocaleString("vi-VN")}đ/giờ
                    </span>
                  </button>
                );
              })}
              {filteredStaff.length === 0 && (
                <p className="no-result" role="status">
                  {search.trim()
                    ? "Không tìm thấy nhân viên phù hợp với từ khóa và bộ lọc."
                    : "Không có nhân viên phù hợp với ngày và ca đã chọn."}
                </p>
              )}
            </div>
          </div>
        </div>

        {isSchedulePublished ? (
          <div className="form-group">
            <label htmlFor="published-shift-reason">
              Lý do thêm nhân viên vào lịch đã công bố {" "}
              <span className="required">*</span>
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
                onChange={(event) => setNotifyEmployees(event.target.checked)}
              />
              <span>Gửi thông báo đến nhân viên được thêm vào ca</span>
            </label>

            <label className="published-check-row">
              <input
                type="checkbox"
                checked={allowOverride}
                onChange={(event) => setAllowOverride(event.target.checked)}
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
                onChange={(event) => setOverrideReason(event.target.value)}
              />
            ) : null}
          </div>
        ) : null}

        <div className="form-group">
          <label htmlFor="new-shift-note">Ghi chú</label>
          <textarea
            id="new-shift-note"
            className="note-input"
            rows={2}
            placeholder="Ví dụ: cần chuẩn bị tiệc sinh nhật…"
            value={newShift.notes}
            onChange={(event) =>
              setNewShift((prev) => ({ ...prev, notes: event.target.value }))
            }
          />
        </div>

        {submitError ? (
          <div className="submit-error" role="alert">
            {submitError}
          </div>
        ) : null}

        <div className="actions">
          <button type="button" className="btn-cancel" onClick={onClose}>
            Hủy
          </button>
          <button type="submit" className="btn-submit" disabled={submitting}>
            {submitting
              ? "Đang lưu…"
              : isSchedulePublished
                ? "Kiểm tra & thêm vào lịch"
                : "Tạo ca làm việc"}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default AddShiftModal;
