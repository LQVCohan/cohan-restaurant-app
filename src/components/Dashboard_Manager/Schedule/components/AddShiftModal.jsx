import React, { useState, useEffect, useMemo } from "react";
import Modal from "../../../common/Modal"; // Đảm bảo đường dẫn đúng
import "./AddShiftModal.scss";
import { shiftTypes, formatDate } from "../utils/scheduleHelpers";
import { Search, Check } from "lucide-react"; // Import icon từ lucide-react

// Mock Job Options (Nếu chưa có file utils)
const jobOptions = [
  { value: "chef", label: "Bếp trưởng", emoji: "👨‍🍳" },
  { value: "cook", label: "Phụ bếp", emoji: "🍳" },
  { value: "waiter", label: "Phục vụ", emoji: "💁" },
  { value: "bartender", label: "Pha chế", emoji: "🍹" },
  { value: "cashier", label: "Thu ngân", emoji: "💻" },
  { value: "cleaner", label: "Tạp vụ", emoji: "🧹" },
];

const AddShiftModal = ({
  isOpen,
  onClose,
  selectedDate,
  selectedShiftType,
  staffList,
  onConfirm,
}) => {
  const [newShift, setNewShift] = useState({
    essentialJobs: [],
    staffIds: [],
    notes: "",
  });
  const [search, setSearch] = useState("");

  // Reset form khi mở modal
  useEffect(() => {
    if (isOpen) {
      setNewShift({
        essentialJobs: [],
        staffIds: [],
        notes: "",
      });
      setSearch("");
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

  // Filter Staff
  const filteredStaff = useMemo(() => {
    return staffList.filter((s) =>
      s.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [staffList, search]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm({
      ...newShift,
      date: selectedDate,
      shiftType: selectedShiftType,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Thêm Ca Làm Việc Mới">
      <form className="add-modal-content" onSubmit={handleSubmit}>
        {/* Header Info */}
        <div className="shift-info-box">
          <div className="info-item">
            <span className="label">Loại ca:</span>
            <span className="value">
              {shiftTypes[selectedShiftType]?.label || "N/A"}
            </span>
          </div>
          <div className="info-item">
            <span className="label">Thời gian:</span>
            <span className="value">
              {shiftTypes[selectedShiftType]?.time || "--:--"}
            </span>
          </div>
          <div className="info-item">
            <span className="label">Ngày:</span>
            <span className="value">
              {selectedDate ? formatDate(selectedDate) : ""}
            </span>
          </div>
        </div>

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

            <div className="staff-list">
              {filteredStaff.map((s) => {
                const isSelected = newShift.staffIds.includes(s.id);
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
                      <span className="role">{s.job}</span>
                    </div>
                    <span className="salary">
                      {s.salary.toLocaleString()}đ/h
                    </span>
                  </div>
                );
              })}
              {filteredStaff.length === 0 && (
                <p className="no-result">Không tìm thấy nhân viên</p>
              )}
            </div>
          </div>
        </div>

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

        {/* Footer Actions */}
        <div className="actions">
          <button type="button" className="btn-cancel" onClick={onClose}>
            Hủy bỏ
          </button>
          <button type="submit" className="btn-submit">
            Lưu & Tạo Lịch
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default AddShiftModal;
