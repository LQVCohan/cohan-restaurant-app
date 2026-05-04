import React, { useState, useEffect, useMemo } from "react";
import Modal from "../../../common/Modal"; // Đảm bảo đường dẫn đúng
import "./AddShiftModal.scss";
import {
  shiftTypes,
  formatDate,
  jobOptions,
  getJobName,
  normalizeRoleKey,
  resolveConcreteStaffRoleSlug,
} from "../utils/scheduleHelpers";
import { Search, Check } from "lucide-react"; // Import icon từ lucide-react

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

const normalizeEmploymentType = (value) => String(value || "").trim().toLowerCase();
const normalizeAvailabilityStatus = (value) => String(value || "").trim().toLowerCase();
const normalizeShiftType = (value) => String(value || "").trim().toLowerCase();
const OFFICIAL_AVAILABILITY_STATUSES = new Set(["submitted", "approved", "locked"]);
const isPartTimeLike = (staff) => {
  const type = normalizeEmploymentType(staff?.employmentType);
  return type === "part_time" || type === "seasonal";
};
const toLocalYmd = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const hasOfficialAvailableSlot = (submission, selectedDate, selectedShiftType) => {
  if (!submission) return false;
  if (!OFFICIAL_AVAILABILITY_STATUSES.has(normalizeAvailabilityStatus(submission.status))) return false;
  const targetDate = toLocalYmd(selectedDate);
  const targetShift = normalizeShiftType(selectedShiftType);
  return (submission.slots || []).some((slot) => toLocalYmd(slot.date) === targetDate && normalizeShiftType(slot.shiftType) === targetShift && normalizeAvailabilityStatus(slot.status) === "available");
};
const hasOfficialUnavailableSlot = (submission, selectedDate, selectedShiftType) => {
  if (!submission) return false;
  if (!OFFICIAL_AVAILABILITY_STATUSES.has(normalizeAvailabilityStatus(submission.status))) return false;
  const targetDate = toLocalYmd(selectedDate);
  const targetShift = normalizeShiftType(selectedShiftType);
  return (submission.slots || []).some((slot) => toLocalYmd(slot.date) === targetDate && normalizeShiftType(slot.shiftType) === targetShift && normalizeAvailabilityStatus(slot.status) === "unavailable");
};

const AddShiftModal = ({
  isOpen,
  onClose,
  selectedDate,
  selectedShiftType,
  shiftConfig = shiftTypes,
  staffList,
  availabilitySubmissions = [],
  onConfirm,
  isSchedulePublished = false,
  submitting = false,
}) => {
  const [newShift, setNewShift] = useState({
    essentialJobs: [],
    staffIds: [],
    notes: "",
  });
  const [search, setSearch] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [publishedReason, setPublishedReason] = useState("");
  const [notifyEmployees, setNotifyEmployees] = useState(true);
  const [allowOverride, setAllowOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  // Reset form khi mở modal
  useEffect(() => {
    if (isOpen) {
      setNewShift({
        essentialJobs: [],
        staffIds: [],
        notes: "",
      });
      setSearch("");
      setSubmitError("");
      setPublishedReason("");
      setNotifyEmployees(true);
      setAllowOverride(false);
      setOverrideReason("");
    }
  }, [isOpen, selectedDate, selectedShiftType]);

  // Handle Toggle Job
  const toggleJob = (jobValue) => {
    setNewShift((prev) => {
      const exists = prev.essentialJobs.includes(jobValue);
      return {
        ...prev,
        essentialJobs: exists
          ? prev.essentialJobs.filter((j) => j !== jobValue)
          : [...prev.essentialJobs, jobValue],
      };
    });
  };

  // Handle Toggle Staff
  const toggleStaff = (staffId) => {
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
      if (hasOfficialAvailableSlot(submission, selectedDate, selectedShiftType)) {
        return { visible: true, reason: "available_submission", label: "Đã đăng ký có thể làm" };
      }
      return { visible: false, reason: "missing_or_unmatched_part_time_availability", label: "Không có availability phù hợp" };
    }
    if (!isStaffWorkingOnDate(staff, selectedDate)) {
      return { visible: false, reason: "outside_working_days", label: "Ngoài ngày làm việc mặc định" };
    }
    if (hasOfficialUnavailableSlot(submission, selectedDate, selectedShiftType)) {
      return { visible: false, reason: "full_time_unavailable_exception", label: "Đã báo không khả dụng" };
    }
    return { visible: true, reason: "working_day", label: "Theo ngày làm việc mặc định" };
  };

  // Filter Staff
  const filteredStaff = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return staffList.filter((s) => {
      const visibility = getStaffAvailabilityVisibility(s);
      if (!visibility.visible) return false;

      if (!normalizedSearch) {
        return true;
      }

      return String(s.name || "")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [staffList, search, selectedDate, selectedShiftType, availabilityByEmployeeId]);

  const hiddenVisibilityStats = useMemo(() => {
    return staffList.reduce((acc, s) => {
      const visibility = getStaffAvailabilityVisibility(s);
      if (!visibility.visible) {
        acc.total += 1;
        acc[visibility.reason] = (acc[visibility.reason] || 0) + 1;
      }
      return acc;
    }, { total: 0 });
  }, [staffList, selectedDate, selectedShiftType, availabilityByEmployeeId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError("");

    if (!newShift.staffIds.length) {
      setSubmitError("Cần chọn ít nhất một nhân viên cho ca làm.");
      return;
    }
    if (newShift.essentialJobs.length) {
      const selectedStaff = staffList.filter((person) =>
        newShift.staffIds.includes(person.id),
      );
      const staffRoleSet = new Set(selectedStaff.map((person) => resolveConcreteStaffRoleSlug(person)).filter(Boolean));
      const missingRoles = newShift.essentialJobs.filter(
        (role) => !staffRoleSet.has(normalizeRoleKey(role)),
      );
      if (missingRoles.length) {
        setSubmitError(
          `Ca làm còn thiếu vị trí bắt buộc: ${missingRoles.map((role) => getJobName(role)).join(", ")}.`,
        );
        return;
      }
    }

    if (isSchedulePublished && !publishedReason.trim()) {
      setSubmitError(
        "Lịch đã công bố, cần nhập lý do khi thêm nhân viên vào ca.",
      );
      return;
    }

    if (isSchedulePublished && allowOverride && !overrideReason.trim()) {
      setSubmitError("Cần nhập lý do override policy.");
      return;
    }

    try {
      await onConfirm({
        ...newShift,
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Thêm Ca Làm Việc Mới">
      <form className="add-modal-content" onSubmit={handleSubmit}>
        {/* Header Info */}
        <div className="shift-info-box">
          <div className="info-item">
            <span className="label">Loại ca:</span>
            <span className="value">
              {shiftConfig[selectedShiftType]?.label || "N/A"}
            </span>
          </div>
          <div className="info-item">
            <span className="label">Thời gian:</span>
            <span className="value">
              {shiftConfig[selectedShiftType]?.time || "--:--"}
            </span>
          </div>
          <div className="info-item">
            <span className="label">Ngày:</span>
            <span className="value">
              {selectedDate ? formatDate(selectedDate) : ""}
            </span>
          </div>
        </div>
        {isSchedulePublished ? (
          <div className="published-change-warning">
            <strong>Lịch đã được công bố</strong>
            <p>
              Thêm nhân viên vào ca này sẽ được xem là thay đổi lịch đã công bố.
              Hệ thống sẽ validate policy, ghi log và gửi thông báo đến nhân
              viên liên quan.
            </p>
          </div>
        ) : null}
        {/* Job Selection */}
        <div className="form-group">
          <label>Vị trí bắt buộc (KPI)</label>
          <div className="job-grid">
            {jobOptions.map((job) => {
              const isChecked = newShift.essentialJobs.includes(job.value);
              return (
                <div
                  key={job.value}
                  className={`job-checkbox ${isChecked ? "checked" : ""}`}
                  onClick={() => toggleJob(job.value)}
                >
                  <span className="emoji">{job.emoji}</span>
                  <span className="text">{job.label}</span>
                  {isChecked && <Check size={16} className="check-icon" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Staff Selection */}
        <div className="form-group">
          <label>Phân công nhân viên ({newShift.staffIds.length})</label>
          <div className="staff-selector">
            <div className="search-wrapper">
              <Search size={16} />
              <input
                className="search-input"
                placeholder="Tìm tên nhân viên..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {hiddenVisibilityStats.total > 0 ? (
              <p className="staff-filter-hint">
                Đã ẩn {hiddenVisibilityStats.total} nhân viên không phù hợp với ngày/ca này.
                {` Part-time chưa có availability phù hợp: ${hiddenVisibilityStats.missing_or_unmatched_part_time_availability || 0}.`}
                {` Full-time ngoài ngày làm việc mặc định: ${hiddenVisibilityStats.outside_working_days || 0}.`}
                {` Full-time đã báo không khả dụng: ${hiddenVisibilityStats.full_time_unavailable_exception || 0}.`}
              </p>
            ) : null}

            <div className="staff-list">
              {filteredStaff.map((s) => {
                const isSelected = newShift.staffIds.includes(s.id);
                const visibility = getStaffAvailabilityVisibility(s);
                const roleSlug = resolveConcreteStaffRoleSlug(s);
                const roleLabel = roleSlug ? getJobName(roleSlug) : "Chưa xác định vị trí";
                const roleMatched =
                  newShift.essentialJobs.length === 0 ||
                  (roleSlug &&
                    newShift.essentialJobs.some((role) => normalizeRoleKey(role) === roleSlug));
                return (
                  <div
                    key={s.id}
                    className={`staff-item ${isSelected ? "selected" : ""}`}
                    onClick={() => toggleStaff(s.id)}
                  >
                    <div className="checkbox-custom">
                      {isSelected && <div className="dot" />}
                    </div>
                    <div className="staff-info">
                      <span className="name">{s.name}</span>
                      <span className="role">{roleLabel} · {s.departmentLabel || "Khác"}</span>
                                            <span className="role-match matched">{visibility.label}</span>
                      {newShift.essentialJobs.length > 0 ? (
                        <span className={`role-match ${roleMatched ? "matched" : "mismatch"}`}>
                          {roleMatched ? "Khớp vị trí" : "Không khớp vị trí bắt buộc"}
                        </span>
                      ) : null}
                    </div>
                    <span className="salary">
                      {s.salary.toLocaleString()}đ/h
                    </span>
                  </div>
                );
              })}
              {filteredStaff.length === 0 && (
                <p className="no-result">
                  {search.trim()
                    ? "Không tìm thấy nhân viên phù hợp trong ngày này"
                    : "Không có nhân viên phù hợp với ngày làm việc đã chọn"}
                </p>
              )}
            </div>
          </div>
        </div>
        {isSchedulePublished ? (
          <div className="form-group">
            <label>
              Lý do thêm nhân viên vào lịch đã công bố{" "}
              <span className="required">*</span>
            </label>
            <textarea
              className="note-input"
              rows={3}
              placeholder="Ví dụ: bổ sung nhân sự do nhu cầu vận hành tăng..."
              value={publishedReason}
              onChange={(e) => setPublishedReason(e.target.value)}
            />

            <label className="published-check-row">
              <input
                type="checkbox"
                checked={notifyEmployees}
                onChange={(e) => setNotifyEmployees(e.target.checked)}
              />
              <span>Gửi thông báo đến nhân viên được thêm vào ca</span>
            </label>

            <label className="published-check-row">
              <input
                type="checkbox"
                checked={allowOverride}
                onChange={(e) => setAllowOverride(e.target.checked)}
              />
              <span>Cho phép override nếu chỉ có cảnh báo policy</span>
            </label>

            {allowOverride ? (
              <textarea
                className="note-input"
                rows={2}
                placeholder="Lý do override policy..."
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
              />
            ) : null}
          </div>
        ) : null}
        {/* Note Input */}
        <div className="form-group">
          <label>Ghi chú</label>
          <textarea
            className="note-input"
            rows={2}
            placeholder="VD: Cần chuẩn bị tiệc sinh nhật..."
            value={newShift.notes}
            onChange={(e) =>
              setNewShift({ ...newShift, notes: e.target.value })
            }
          />
        </div>

        {submitError ? <div className="submit-error">{submitError}</div> : null}

        {/* Footer Actions */}
        <div className="actions">
          <button type="button" className="btn-cancel" onClick={onClose}>
            Hủy bỏ
          </button>
          <button type="submit" className="btn-submit" disabled={submitting}>
            {submitting
              ? "Đang lưu..."
              : isSchedulePublished
                ? "Validate & thêm vào lịch"
                : "Lưu & Tạo Lịch"}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default AddShiftModal;
