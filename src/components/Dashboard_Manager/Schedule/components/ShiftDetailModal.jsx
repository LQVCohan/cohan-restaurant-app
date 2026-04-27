import React, { useEffect, useMemo, useState } from "react";
import Modal from "../../../common/Modal";
import "./ShiftDetailModal.scss";
import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  Clock,
  Plus,
  Search,
  Trash2,
  UserMinus,
  Users,
  X,
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
  onUpdateTime,
  shiftConfig = shiftTypes,
}) => {
  const [search, setSearch] = useState("");
  const [jobFilter, setJobFilter] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [timeDraft, setTimeDraft] = useState({ startTime: "", endTime: "" });
  const [timeError, setTimeError] = useState("");
  const [isSavingTime, setIsSavingTime] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);

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
    setTimeDraft({
      startTime: shift?.startTime || "",
      endTime: shift?.endTime || "",
    });
    setTimeError("");
    setIsSavingTime(false);
    setIsSavingNotes(false);
  }, [shift]);

  if (!isOpen || !shift) return null;

  const currentShiftType =
    shiftConfig[shift.shiftType] || shiftTypes[shift.shiftType];
  const missingCount = Math.max(
    0,
    shiftEssentialJobs.length - shiftStaffIds.length,
  );
  const isComplete = missingCount === 0;

  const handleSaveTime = async () => {
    if (readOnly || !onUpdateTime) return;
    if (!timeDraft.startTime || !timeDraft.endTime) {
      setTimeError("Cần nhập đủ giờ bắt đầu và giờ kết thúc.");
      return;
    }
    if (timeDraft.startTime === timeDraft.endTime) {
      setTimeError("Giờ kết thúc phải khác giờ bắt đầu.");
      return;
    }

    setTimeError("");
    setIsSavingTime(true);
    try {
      await onUpdateTime(timeDraft);
    } catch (error) {
      setTimeError(error?.message || "Không thể cập nhật thời gian ca.");
    } finally {
      setIsSavingTime(false);
    }
  };

  const handleSaveNotes = async () => {
    if (readOnly || !onUpdateNotes) return;
    setIsSavingNotes(true);
    try {
      await onUpdateNotes(noteDraft);
    } finally {
      setIsSavingNotes(false);
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
                          onClick={() => onRemoveStaff(shift.id, staffId)}
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

          {!readOnly ? (
            <div className="section-block note-section">
              <div className="section-header">
                <div>
                  <h4>Ghi chú ca</h4>
                  <p>Thông tin nội bộ cho quản lý hoặc nhân sự trong ca.</p>
                </div>
              </div>

              <textarea
                className="note-textarea"
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.target.value)}
                placeholder="Nhập ghi chú ca làm..."
                rows={3}
                readOnly={readOnly}
                disabled={readOnly}
              />
            </div>
          ) : null}

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

          <div className="modal-footer-actions">
            {!readOnly ? (
              <>
                <button
                  className="btn-close"
                  onClick={handleSaveNotes}
                  disabled={isSavingNotes || isSavingTime}
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
