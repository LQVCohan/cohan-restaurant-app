import React, { useState, useEffect } from "react";
import Modal from "../../../../components/common/Modal";
import "./AddShiftModal.scss";
import { shiftTypes, formatDate } from "../utils/scheduleHelpers";

// ... (Giữ nguyên logic JS như các phiên bản trước, chỉ đổi className khớp với SCSS mới)

const AddShiftModal = ({
  isOpen,
  onClose,
  selectedDate,
  selectedShiftType,
}) => {
  const [newShift, setNewShift] = useState({
    essentialJobs: [],
    staffIds: [],
    notes: "",
  });
  const [search, setSearch] = useState("");

  // ... (Effects và Handlers giữ nguyên) ...

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Thêm Ca Làm Việc">
      <form className="add-modal-content" onSubmit={handleSubmit}>
        <div className="shift-info-box">
          <h4>{shiftTypes[selectedShiftType]?.label}</h4>
          <p>{selectedDate ? formatDate(selectedDate) : ""}</p>
        </div>

        <div className="form-group">
          <label>Vị trí cần thiết</label>
          <div className="job-grid">
            {jobOptions.map((job) => (
              <div
                key={job.value}
                className={`job-checkbox ${
                  newShift.essentialJobs.includes(job.value) ? "checked" : ""
                }`}
                onClick={() => {
                  /* logic toggle */
                }}
              >
                <span>{job.emoji}</span>
                <span>{job.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label>Chọn nhân viên</label>
          <div className="staff-selector">
            <input
              className="search-input"
              placeholder="Tìm nhân viên..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="staff-list">
              {/* Logic map staffList */}
              {filteredStaff.map((s) => (
                <div
                  key={s.id}
                  className={`staff-item ${
                    newShift.staffIds.includes(s.id) ? "selected" : ""
                  }`}
                >
                  {/* ... content ... */}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="actions">
          <button type="button" className="btn-cancel" onClick={onClose}>
            Hủy
          </button>
          <button type="submit" className="btn-submit">
            Lưu
          </button>
        </div>
      </form>
    </Modal>
  );
};
export default AddShiftModal;
