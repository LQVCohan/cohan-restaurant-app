import React, { useState, useMemo, useEffect } from "react";
import Modal from "../../../common/Modal";
import "./ShiftDetailModal.scss";
import {
  Clock,
  Calendar,
  Trash2,
  Plus,
  Search,
  X,
  AlertTriangle,
  CheckCircle,
  UserMinus,
} from "lucide-react";
import { shiftTypes, formatDate, getDayName } from "../utils/scheduleHelpers";

const jobOptions = [
  { value: "chef", label: "Bếp trưởng" },
  { value: "cook", label: "Phụ bếp" },
  { value: "waiter", label: "Phục vụ" },
  { value: "bartender", label: "Pha chế" },
  { value: "cashier", label: "Thu ngân" },
  { value: "cleaner", label: "Tạp vụ" },
];

const ShiftDetailModal = ({
  isOpen,
  onClose,
  shift,
  staffList,
  onRemoveStaff,
  onAddStaff,
  onDeleteShift,
  onUpdateNotes,
}) => {
  const [search, setSearch] = useState("");
  const [jobFilter, setJobFilter] = useState("");
  const [noteDraft, setNoteDraft] = useState("");

  // --- 1. SỬA LỖI: Tạo các biến an toàn để dùng trong Hooks ---
  // Nếu shift là null, ta dùng mảng rỗng để tránh lỗi "reading properties of null"
  const shiftStaffIds = useMemo(() => shift?.staffIds || [], [shift?.staffIds]);
  const shiftEssentialJobs = useMemo(
    () => shift?.essentialJobs || [],
    [shift?.essentialJobs],
  );

  // --- 2. SỬA LỖI: Gọi useMemo TRƯỚC khi return null ---
  const availableStaff = useMemo(() => {
    if (!shift) return []; // Guard clause bên trong useMemo

    return staffList.filter((s) => {
      // Dùng biến an toàn shiftStaffIds
      const notInShift = !shiftStaffIds.includes(s.id);
      const matchSearch = s.name.toLowerCase().includes(search.toLowerCase());
      const matchJob = jobFilter ? s.job === jobFilter : true;
      return notInShift && matchSearch && matchJob;
    });
  }, [staffList, shiftStaffIds, search, jobFilter, shift]); // Dependency safe

  useEffect(() => {
    setNoteDraft(shift?.notes || "");
  }, [shift]);

  // --- 3. Return null NẾU không có dữ liệu (đặt sau Hooks) ---
  if (!isOpen || !shift) return null;

  const currentShiftType = shiftTypes[shift.shiftType];
  const missingCount = Math.max(
    0,
    shiftEssentialJobs.length - shiftStaffIds.length
  );
  const isComplete = missingCount === 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Chi Tiết Ca Làm Việc">
      <div className="shift-detail-content">
        {/* 1. Header Summary */}
        <div className={`summary-card ${isComplete ? "success" : "warning"}`}>
          <div className="card-row">
            <div className="main-info">
              <h3 className="shift-name">{currentShiftType?.label}</h3>
              <div className="time-badge">
                <Clock size={14} />
                <span>
                  {shift.startTime} - {shift.endTime}
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

          <div className="card-row meta-info">
            <div className="meta-item">
              <Calendar size={14} />
              <span>
                {formatDate(shift.date)} ({getDayName(shift.day)})
              </span>
            </div>
            {shift.notes && (
              <div className="meta-item note">
                <span>📝 {shift.notes}</span>
              </div>
            )}
          </div>
        </div>

        {/* 2. Assigned Staff Section */}
        <div className="section-block">
          <div className="section-header">
            <h4>Nhân viên trong ca ({shiftStaffIds.length})</h4>
          </div>

          <div className="assigned-list">
            {shiftStaffIds.length > 0 ? (
              shiftStaffIds.map((staffId) => {
                const person = staffList.find((s) => s.id === staffId);
                if (!person) return null;
                return (
                  <div key={staffId} className="staff-row assigned">
                    <div className="info">
                      <div className="avatar">{person.name.charAt(0)}</div>
                      <div className="details">
                        <span className="name">{person.name}</span>
                        <span className="role">{person.job}</span>
                      </div>
                    </div>
                    <button
                      className="btn-icon remove"
                      onClick={() => onRemoveStaff(shift.id, staffId)}
                      title="Xóa khỏi ca"
                    >
                      <UserMinus size={18} />
                    </button>
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
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="Nhập ghi chú ca làm..."
            rows={2}
            style={{ width: "100%" }}
          />
        </div>

        {/* 3. Add Staff Section */}
        <div className="section-block add-section">
          <div className="section-header">
            <h4>Thêm nhân sự</h4>
            {(search || jobFilter) && (
              <button
                className="clear-filter"
                onClick={() => {
                  setSearch("");
                  setJobFilter("");
                }}
              >
                Xóa lọc
              </button>
            )}
          </div>

          <div className="filter-bar">
            <div className="search-box">
              <Search size={16} />
              <input
                placeholder="Tìm tên..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <X
                  size={14}
                  className="clear-icon"
                  onClick={() => setSearch("")}
                />
              )}
            </div>
            <select
              value={jobFilter}
              onChange={(e) => setJobFilter(e.target.value)}
              className="job-select"
            >
              <option value="">Tất cả vị trí</option>
              {jobOptions.map((j) => (
                <option key={j.value} value={j.value}>
                  {j.label}
                </option>
              ))}
            </select>
          </div>

          <div className="candidate-list">
            {availableStaff.length > 0 ? (
              availableStaff.map((person) => {
                const isRecommended = shiftEssentialJobs.includes(person.job);
                return (
                  <div key={person.id} className="staff-row candidate">
                    <div className="info">
                      <div className="details">
                        <span className="name">{person.name}</span>
                        <div className="sub-row">
                          <span className="role">{person.job}</span>
                          {isRecommended && (
                            <span className="tag-rec">Ưu tiên</span>
                          )}
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
              <div className="empty-placeholder">Không tìm thấy nhân viên</div>
            )}
          </div>
        </div>

        {/* 4. Footer Actions */}
        <div className="modal-footer-actions">
          <button
            className="btn-close"
            onClick={() => onUpdateNotes && onUpdateNotes(noteDraft)}
          >
            Lưu ghi chú
          </button>
          <button
            className="btn-delete"
            onClick={() => {
              if (window.confirm("Bạn có chắc chắn muốn xóa ca này?"))
                onDeleteShift(shift.id);
            }}
          >
            <Trash2 size={16} />
            Xóa Ca
          </button>
          <button className="btn-close" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ShiftDetailModal;
