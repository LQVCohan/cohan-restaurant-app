import React, { useEffect, useMemo, useState } from "react";
import Modal from "../../../common/Modal";
import "./ShiftDetailModal.scss";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Plus,
  Search,
  Trash2,
  UserMinus,
  Users,
  X,
  Edit3,
} from "lucide-react";
import {
  shiftTypes,
  formatDate,
  getDayName,
  jobOptions,
  getJobName,
} from "../utils/scheduleHelpers";
const getInitials = (name) =>
  String(name || "NV")
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "NV";
const ShiftDetailModal = ({
  isOpen,
  onClose,
  shift,
  staffList,
  readOnly = false,
  onRemoveStaff,
  onAddStaff,
  onDeleteShift,
  onUpdateNotes,
  isSchedulePublished = false,
  isChangingShiftTime = false,
  onChangeShiftGroupTime,
  shiftConfig = shiftTypes,
}) => {
  const [search, setSearch] = useState("");
  const [jobFilter, setJobFilter] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [timeChangeOpen, setTimeChangeOpen] = useState(false);
  const [timeChangeDraft, setTimeChangeDraft] = useState({
    startTime: "",
    endTime: "",
    reason: "",
    notifyEmployees: true,
    allowOverride: false,
    overrideReason: "",
  });
  const [timeChangeError, setTimeChangeError] = useState("");
  const [isSubmittingTimeChange, setIsSubmittingTimeChange] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState(null);
  const [removeReason, setRemoveReason] = useState("");
  const [isRemovingStaff, setIsRemovingStaff] = useState(false);
  const shiftStaffIds = useMemo(() => shift?.staffIds || [], [shift?.staffIds]);
  const shiftEssentialJobs = useMemo(
    () => shift?.essentialJobs || [],
    [shift?.essentialJobs],
  );

  const availableStaff = useMemo(() => {
    if (!shift || readOnly) return [];

    return staffList.filter((staff) => {
      const notInShift = !shiftStaffIds.includes(staff.id);
      const matchSearch = staff.name
        .toLowerCase()
        .includes(search.toLowerCase());
      const matchJob = jobFilter ? staff.job === jobFilter : true;
      return notInShift && matchSearch && matchJob;
    });
  }, [jobFilter, readOnly, search, shift, shiftStaffIds, staffList]);

  useEffect(() => {
    setNoteDraft(shift?.notes || "");

    setTimeChangeOpen(false);
    setTimeChangeDraft({
      startTime: shift?.startTime || "",
      endTime: shift?.endTime || "",
      reason: "",
      notifyEmployees: true,
      allowOverride: false,
      overrideReason: "",
    });
    setTimeChangeError("");
    setIsSubmittingTimeChange(false);
    setIsSavingNotes(false);
    setRemoveConfirm(null);
    setRemoveReason("");
    setIsRemovingStaff(false);
  }, [shift]);

  if (!isOpen || !shift) return null;

  const currentShiftType =
    shiftConfig[shift.shiftType] || shiftTypes[shift.shiftType];
  const missingCount = Math.max(
    0,
    shiftEssentialJobs.length - shiftStaffIds.length,
  );
  const isComplete = missingCount === 0;

  const handleSaveNotes = async () => {
    if (readOnly || !onUpdateNotes) return;
    setIsSavingNotes(true);
    try {
      await onUpdateNotes(noteDraft);
    } finally {
      setIsSavingNotes(false);
    }
  };
  const openRemoveConfirm = (person) => {
    setRemoveConfirm(person);
    setRemoveReason("");
  };

  const closeRemoveConfirm = () => {
    if (isRemovingStaff) return;
    setRemoveConfirm(null);
    setRemoveReason("");
  };

  const handleConfirmRemoveStaff = async () => {
    if (!removeConfirm || readOnly || !onRemoveStaff) return;

    if (!removeReason.trim()) {
      return;
    }

    setIsRemovingStaff(true);

    try {
      await onRemoveStaff(shift.id, removeConfirm.id, {
        reason: removeReason.trim(),
        notifyEmployee: true,
      });

      setRemoveConfirm(null);
      setRemoveReason("");
    } finally {
      setIsRemovingStaff(false);
    }
  };
  const openTimeChangeModal = () => {
    if (readOnly || !onChangeShiftGroupTime) return;

    setTimeChangeDraft({
      startTime: shift?.startTime || "",
      endTime: shift?.endTime || "",
      reason: "",
      notifyEmployees: true,
      allowOverride: false,
      overrideReason: "",
    });
    setTimeChangeError("");
    setTimeChangeOpen(true);
  };

  const closeTimeChangeModal = () => {
    if (isSubmittingTimeChange || isChangingShiftTime) return;
    setTimeChangeOpen(false);
    setTimeChangeError("");
  };

  const handleConfirmTimeChange = async () => {
    if (readOnly || !onChangeShiftGroupTime) return;

    if (!timeChangeDraft.startTime || !timeChangeDraft.endTime) {
      setTimeChangeError("Cần nhập đủ giờ bắt đầu và giờ kết thúc.");
      return;
    }

    if (timeChangeDraft.startTime === timeChangeDraft.endTime) {
      setTimeChangeError("Giờ kết thúc phải khác giờ bắt đầu.");
      return;
    }

    if (!timeChangeDraft.reason.trim()) {
      setTimeChangeError("Cần nhập lý do thay đổi giờ ca.");
      return;
    }

    if (
      timeChangeDraft.allowOverride &&
      !timeChangeDraft.overrideReason.trim()
    ) {
      setTimeChangeError("Cần nhập lý do override policy.");
      return;
    }

    setTimeChangeError("");
    setIsSubmittingTimeChange(true);

    try {
      await onChangeShiftGroupTime(shift, {
        startTime: timeChangeDraft.startTime,
        endTime: timeChangeDraft.endTime,
        reason: timeChangeDraft.reason.trim(),
        notifyEmployees: timeChangeDraft.notifyEmployees,
        allowOverride: timeChangeDraft.allowOverride,
        overrideReason: timeChangeDraft.overrideReason.trim(),
      });

      setTimeChangeOpen(false);
    } catch (error) {
      setTimeChangeError(error?.message || "Không thể đổi giờ ca.");
    } finally {
      setIsSubmittingTimeChange(false);
    }
  };
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <Modal.Header>
        <div className="shift-detail-title">
          <div>
            <span className="eyebrow">Quản lý lịch làm</span>
            <h2>Chi tiết ca làm việc</h2>
          </div>
          <button type="button" className="header-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
      </Modal.Header>
      <Modal.Body>
        <div className="shift-detail-content">
          <div className={`summary-card ${isComplete ? "success" : "warning"}`}>
            <div className="summary-main">
              <div className="shift-icon-wrap">
                <Clock size={22} />
              </div>

              <div className="main-info">
                <span className="shift-type-label">
                  {currentShiftType?.label}
                </span>
                <h3 className="shift-name">
                  {formatDate(shift.date)} • {getDayName(shift.day)}
                </h3>

                <div className="summary-meta">
                  <span>
                    <Clock size={14} />
                    {shift.startTime} - {shift.endTime}
                  </span>
                  <span>
                    <Users size={14} />
                    {shiftStaffIds.length} nhân sự
                  </span>
                </div>
              </div>

              <div
                className={`status-badge ${isComplete ? "complete" : "missing"}`}
              >
                {isComplete ? (
                  <CheckCircle size={16} />
                ) : (
                  <AlertTriangle size={16} />
                )}
                <span>
                  {isComplete ? "Đủ nhân sự" : `Thiếu ${missingCount} người`}
                </span>
              </div>
            </div>

            {shift.notes ? (
              <div className="summary-note">
                <span>Ghi chú hiện tại</span>
                <p>{shift.notes}</p>
              </div>
            ) : null}
            {shift.notes ? (
              <div className="summary-note">
                <span>Ghi chú hiện tại</span>
                <p>{shift.notes}</p>
              </div>
            ) : null}
            {!readOnly && onChangeShiftGroupTime ? (
              <div className="summary-actions">
                <button
                  type="button"
                  className="btn-time-change"
                  onClick={openTimeChangeModal}
                  disabled={isChangingShiftTime}
                >
                  <Edit3 size={16} />
                  Đổi giờ ca
                </button>

                <span
                  className={
                    isSchedulePublished ? "published-hint" : "draft-hint"
                  }
                >
                  {isSchedulePublished
                    ? "Lịch đã công bố: đổi giờ sẽ yêu cầu lý do, validate policy, ghi log và thông báo nhân viên."
                    : "Lịch chưa công bố: hệ thống vẫn sẽ validate nhân viên trước khi đổi giờ."}
                </span>
              </div>
            ) : null}
          </div>

          <div className="section-block">
            <div className="section-header">
              <h4>Nhân viên trong ca ({shiftStaffIds.length})</h4>
            </div>

            <div className="assigned-list">
              {shiftStaffIds.length > 0 ? (
                shiftStaffIds.map((staffId) => {
                  const person = staffList.find(
                    (staff) => staff.id === staffId,
                  );
                  if (!person) return null;

                  return (
                    <div key={staffId} className="staff-row assigned">
                      <div className="info">
                        <div className="avatar">{getInitials(person.name)}</div>
                        <div className="details">
                          <span className="name">{person.name}</span>
                          <span className="role">{getJobName(person.job)}</span>
                        </div>
                      </div>
                      {!readOnly ? (
                        <button
                          className="btn-icon remove"
                          onClick={() => openRemoveConfirm(person)}
                          title="Xóa khỏi ca"
                        >
                          <UserMinus size={18} />
                        </button>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <div className="empty-placeholder">Chưa có nhân viên nào</div>
              )}
            </div>
          </div>

          <div className="section-block">
            <div className="section-header">
              <h4>Ghi chú ca</h4>
            </div>
            <textarea
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
              placeholder="Nhập ghi chú ca làm..."
              rows={2}
              style={{ width: "100%" }}
              readOnly={readOnly}
              disabled={readOnly}
            />
          </div>

          {!readOnly ? (
            <div className="section-block add-section">
              <div className="section-header">
                <h4>Thêm nhân sự</h4>
                {search || jobFilter ? (
                  <button
                    className="clear-filter"
                    onClick={() => {
                      setSearch("");
                      setJobFilter("");
                    }}
                  >
                    Xóa lọc
                  </button>
                ) : null}
              </div>

              <div className="filter-bar">
                <div className="search-box">
                  <Search size={16} />
                  <input
                    placeholder="Tìm tên..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  {search ? (
                    <X
                      size={14}
                      className="clear-icon"
                      onClick={() => setSearch("")}
                    />
                  ) : null}
                </div>
                <select
                  value={jobFilter}
                  onChange={(event) => setJobFilter(event.target.value)}
                  className="job-select"
                >
                  <option value="">Tất cả vị trí</option>
                  {jobOptions.map((job) => (
                    <option key={job.value} value={job.value}>
                      {job.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="candidate-list">
                {availableStaff.length > 0 ? (
                  availableStaff.map((person) => {
                    const isRecommended = shiftEssentialJobs.includes(
                      person.job,
                    );
                    return (
                      <div key={person.id} className="staff-row candidate">
                        <div className="info">
                          <div className="details">
                            <span className="name">{person.name}</span>
                            <div className="sub-row">
                              <span className="role">
                                {getJobName(person.job)}
                              </span>
                              {isRecommended ? (
                                <span className="tag-rec">Ưu tiên</span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        <button
                          className="btn-icon add"
                          onClick={() => onAddStaff(shift.id, person.id)}
                        >
                          <Plus size={18} />
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="empty-placeholder">
                    Không tìm thấy nhân viên phù hợp với bộ lọc hiện tại.
                  </div>
                )}
              </div>
            </div>
          ) : null}
          {timeChangeOpen ? (
            <div className="time-change-backdrop">
              <div className="time-change-card">
                <div className="time-change-icon">
                  <Clock size={22} />
                </div>

                <div className="time-change-content">
                  <h4>Đổi giờ ca làm việc</h4>

                  <p>
                    Bạn đang đổi giờ <strong>{currentShiftType?.label}</strong>{" "}
                    ngày <strong>{formatDate(shift.date)}</strong>. Giờ hiện
                    tại:{" "}
                    <strong>
                      {shift.startTime} - {shift.endTime}
                    </strong>
                    .
                  </p>

                  {isSchedulePublished ? (
                    <div className="time-change-warning">
                      Lịch này đã được công bố. Khi lưu, hệ thống sẽ validate
                      toàn bộ nhân viên trong ca, ghi log và gửi thông báo đến
                      nhân viên liên quan.
                    </div>
                  ) : (
                    <div className="time-change-info">
                      Lịch chưa công bố. Hệ thống vẫn sẽ kiểm tra trùng ca, nghỉ
                      phép, giới hạn giờ làm và các policy liên quan trước khi
                      lưu.
                    </div>
                  )}

                  <div className="time-change-grid">
                    <label>
                      Giờ bắt đầu mới
                      <input
                        type="time"
                        value={timeChangeDraft.startTime}
                        onChange={(event) =>
                          setTimeChangeDraft((prev) => ({
                            ...prev,
                            startTime: event.target.value,
                          }))
                        }
                        disabled={isSubmittingTimeChange || isChangingShiftTime}
                      />
                    </label>

                    <label>
                      Giờ kết thúc mới
                      <input
                        type="time"
                        value={timeChangeDraft.endTime}
                        onChange={(event) =>
                          setTimeChangeDraft((prev) => ({
                            ...prev,
                            endTime: event.target.value,
                          }))
                        }
                        disabled={isSubmittingTimeChange || isChangingShiftTime}
                      />
                    </label>
                  </div>

                  <label className="time-change-reason">
                    Lý do thay đổi <span>*</span>
                    <textarea
                      value={timeChangeDraft.reason}
                      onChange={(event) =>
                        setTimeChangeDraft((prev) => ({
                          ...prev,
                          reason: event.target.value,
                        }))
                      }
                      placeholder="Ví dụ: điều chỉnh theo nhu cầu vận hành, thay đổi giờ mở ca..."
                      rows={3}
                      disabled={isSubmittingTimeChange || isChangingShiftTime}
                    />
                  </label>

                  <label className="time-change-check">
                    <input
                      type="checkbox"
                      checked={timeChangeDraft.notifyEmployees}
                      onChange={(event) =>
                        setTimeChangeDraft((prev) => ({
                          ...prev,
                          notifyEmployees: event.target.checked,
                        }))
                      }
                      disabled={isSubmittingTimeChange || isChangingShiftTime}
                    />
                    <span>Gửi thông báo đến nhân viên trong ca</span>
                  </label>

                  <label className="time-change-check">
                    <input
                      type="checkbox"
                      checked={timeChangeDraft.allowOverride}
                      onChange={(event) =>
                        setTimeChangeDraft((prev) => ({
                          ...prev,
                          allowOverride: event.target.checked,
                        }))
                      }
                      disabled={isSubmittingTimeChange || isChangingShiftTime}
                    />
                    <span>Cho phép override nếu chỉ có cảnh báo policy</span>
                  </label>

                  {timeChangeDraft.allowOverride ? (
                    <label className="time-change-reason">
                      Lý do override policy <span>*</span>
                      <textarea
                        value={timeChangeDraft.overrideReason}
                        onChange={(event) =>
                          setTimeChangeDraft((prev) => ({
                            ...prev,
                            overrideReason: event.target.value,
                          }))
                        }
                        placeholder="Giải thích vì sao vẫn cần đổi giờ dù có cảnh báo policy..."
                        rows={2}
                        disabled={isSubmittingTimeChange || isChangingShiftTime}
                      />
                    </label>
                  ) : null}

                  {timeChangeError ? (
                    <div className="time-change-error">{timeChangeError}</div>
                  ) : null}

                  <div className="time-change-actions">
                    <button
                      type="button"
                      className="btn-close"
                      onClick={closeTimeChangeModal}
                      disabled={isSubmittingTimeChange || isChangingShiftTime}
                    >
                      Hủy
                    </button>

                    <button
                      type="button"
                      className="btn-primary-danger"
                      onClick={handleConfirmTimeChange}
                      disabled={isSubmittingTimeChange || isChangingShiftTime}
                    >
                      {isSubmittingTimeChange || isChangingShiftTime
                        ? "Đang kiểm tra..."
                        : "Kiểm tra & lưu"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          {removeConfirm ? (
            <div className="remove-confirm-backdrop">
              <div className="remove-confirm-card">
                <div className="remove-confirm-icon">
                  <AlertTriangle size={22} />
                </div>

                <div className="remove-confirm-content">
                  <h4>Xóa nhân viên khỏi ca?</h4>
                  <p>
                    Bạn đang chuẩn bị xóa <strong>{removeConfirm.name}</strong>{" "}
                    khỏi ca <strong>{currentShiftType?.label}</strong> ngày{" "}
                    <strong>{formatDate(shift.date)}</strong>, thời gian{" "}
                    <strong>
                      {shift.startTime} - {shift.endTime}
                    </strong>
                    .
                  </p>

                  <label>
                    Lý do xóa khỏi ca <span>*</span>
                    <textarea
                      value={removeReason}
                      onChange={(event) => setRemoveReason(event.target.value)}
                      placeholder="Ví dụ: nhân viên xin nghỉ, đổi ca, phân công nhầm..."
                      rows={3}
                      disabled={isRemovingStaff}
                    />
                  </label>

                  <div className="remove-confirm-note">
                    Sau khi xác nhận, hệ thống sẽ gửi thông báo đến nhân viên
                    này.
                  </div>

                  <div className="remove-confirm-actions">
                    <button
                      type="button"
                      className="btn-close"
                      onClick={closeRemoveConfirm}
                      disabled={isRemovingStaff}
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={handleConfirmRemoveStaff}
                      disabled={isRemovingStaff || !removeReason.trim()}
                    >
                      {isRemovingStaff ? "Đang xóa..." : "Xác nhận xóa"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          <div className="modal-footer-actions">
            {!readOnly ? (
              <>
                <button
                  className="btn-close"
                  onClick={handleSaveNotes}
                  disabled={isSavingNotes}
                >
                  {isSavingNotes ? "Đang lưu..." : "Lưu ghi chú"}
                </button>
                <button
                  className="btn-delete"
                  onClick={() => {
                    if (window.confirm("Bạn có chắc chắn muốn xóa ca này?")) {
                      onDeleteShift(shift.id);
                    }
                  }}
                >
                  <Trash2 size={16} />
                  Xóa Ca
                </button>
              </>
            ) : null}
            <button className="btn-close" onClick={onClose}>
              Đóng
            </button>
          </div>
        </div>
      </Modal.Body>
    </Modal>
  );
};

export default ShiftDetailModal;
