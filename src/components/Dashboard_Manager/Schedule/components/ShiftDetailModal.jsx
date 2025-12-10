import React, { useState } from "react";
import Modal from "../../../../components/common/Modal"; // Adjust path
import {
  shiftTypes,
  getJobName,
  getJobEmoji,
  getStatusText,
  formatDate,
  getDayName,
  filterStaffByControls,
} from "../utils/scheduleHelpers";

const jobOptions = [
  { value: "chef", label: "Đầu bếp", emoji: "👨‍🍳" },
  { value: "cook", label: "Phụ bếp", emoji: "🍳" },
  { value: "waiter", label: "Phục vụ", emoji: "🍽️" },
  { value: "cashier", label: "Thu ngân", emoji: "💰" },
  { value: "cleaner", label: "Vệ sinh", emoji: "🧹" },
  { value: "host", label: "Tiếp tân", emoji: "🎯" },
  { value: "bartender", label: "Pha chế", emoji: "🍹" },
];

const ShiftDetailModal = ({
  isOpen,
  onClose,
  shift,
  staffList,
  onRemoveStaff,
  onAddStaff,
  onDeleteShift,
}) => {
  const [search, setSearch] = useState("");
  const [jobFilter, setJobFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");

  if (!shift) return null;

  const resetFilters = () => {
    setSearch("");
    setJobFilter("");
    setStatusFilter("active");
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${shiftTypes[shift.shiftType]?.label} - ${formatDate(
        shift.date
      )}`}
    >
      <div>
        {/* Shift Overview */}
        <div
          className="shift-summary-box"
          style={{ background: "#f9fafb", borderColor: "#e5e7eb" }}
        >
          <div className="header">
            <span className="icon">{shiftTypes[shift.shiftType]?.icon}</span>
            <div>
              <h4 style={{ color: "#111827" }}>
                {shiftTypes[shift.shiftType]?.label}
              </h4>
              <p style={{ color: "#4b5563" }}>
                {shift.startTime} - {shift.endTime}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Ngày:</span>
              <span className="ml-2 font-medium">
                {formatDate(shift.date)} ({getDayName(shift.day)})
              </span>
            </div>
            <div>
              <span className="text-gray-600">Trạng thái:</span>
              <span
                className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                  shift.staffIds.length < shift.essentialJobs.length
                    ? "bg-red-100 text-red-700"
                    : "bg-green-100 text-green-700"
                }`}
              >
                {shift.staffIds.length < shift.essentialJobs.length
                  ? "⚠️ Thiếu nhân viên"
                  : "✅ Đầy đủ"}
              </span>
            </div>
          </div>
        </div>

        {/* Current Staff */}
        <div className="form-section">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-gray-900">
              Nhân viên trong ca ({shift.staffIds.length}/
              {shift.essentialJobs.length})
            </h4>
          </div>
          <div className="space-y-2 mb-6">
            {shift.staffIds.length > 0 ? (
              shift.staffIds.map((staffId) => {
                const person = staffList.find((s) => s.id === staffId);
                return person ? (
                  <div key={staffId} className="edit-staff-row">
                    <div className="info-left">
                      <span className="text-lg">{getJobEmoji(person.job)}</span>
                      <div>
                        <div className="font-medium text-gray-900">
                          {person.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {getJobName(person.job)}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => onRemoveStaff(shift.id, staffId)}
                      className="btn-remove"
                      title="Xóa khỏi ca"
                    >
                      🗑️
                    </button>
                  </div>
                ) : null;
              })
            ) : (
              <div className="text-center py-8 text-gray-400">
                <div className="text-3xl mb-2">👥</div>
                <p>Chưa có nhân viên nào trong ca này</p>
              </div>
            )}
          </div>

          {/* Available Staff to Add */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h5 className="font-medium text-gray-900">
                Thêm nhân viên vào ca
              </h5>
              <button
                onClick={resetFilters}
                className="text-sm text-blue-600 hover:text-blue-800"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Xóa bộ lọc
              </button>
            </div>

            <div className="search-filter-box">
              <div className="search-input-wrapper">
                <input
                  type="text"
                  placeholder="Tìm kiếm..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <div className="icon-search">🔍</div>
                {search && (
                  <button onClick={() => setSearch("")} className="btn-clear">
                    ✕
                  </button>
                )}
              </div>
              <div className="filters-row">
                <select
                  value={jobFilter}
                  onChange={(e) => setJobFilter(e.target.value)}
                >
                  <option value="">Tất cả vị trí</option>
                  {jobOptions.map((j) => (
                    <option key={j.value} value={j.value}>
                      {j.emoji} {j.label}
                    </option>
                  ))}
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value="active">✅ Hoạt động</option>
                  <option value="off">🏖️ Nghỉ phép</option>
                  <option value="sick">🤒 Nghỉ ốm</option>
                </select>
              </div>
            </div>

            <div className="staff-list-container">
              {(() => {
                const candidates = staffList.filter(
                  (s) => !shift.staffIds.includes(s.id)
                );
                const filtered = filterStaffByControls(candidates, {
                  search,
                  job: jobFilter,
                  status: statusFilter,
                });

                if (filtered.length === 0)
                  return (
                    <div className="empty-state">
                      <p>Không tìm thấy nhân viên phù hợp</p>
                    </div>
                  );

                return filtered.map((person) => (
                  <div
                    key={person.id}
                    className="edit-staff-row hover:bg-gray-50"
                  >
                    <div className="info-left">
                      <span className="text-lg">{getJobEmoji(person.job)}</span>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">
                          {person.name}
                        </div>
                        <div className="text-sm text-gray-500 flex items-center gap-2">
                          <span>{getJobName(person.job)}</span>{" "}
                          <span className={`status ${person.status}`}>
                            {getStatusText(person.status)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        {shift.essentialJobs.includes(person.job) && (
                          <div className="text-xs text-green-600 font-medium">
                            ⭐ Cần thiết
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => onAddStaff(shift.id, person.id)}
                      className="btn-add"
                      title="Thêm vào ca"
                    >
                      ➕
                    </button>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>

        {shift.notes && (
          <div className="shift-summary-box mt-4">
            <h5
              style={{
                fontWeight: 500,
                color: "#1e3a8a",
                marginBottom: "0.5rem",
              }}
            >
              Ghi chú
            </h5>
            <p style={{ fontSize: "0.875rem", color: "#1e40af", margin: 0 }}>
              {shift.notes}
            </p>
          </div>
        )}

        <div className="modal-actions">
          <button onClick={onClose} className="btn-cancel">
            Đóng
          </button>
          <button
            onClick={() => {
              if (window.confirm("Xóa ca này?")) onDeleteShift(shift.id);
            }}
            className="btn-delete"
          >
            Xóa Ca
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ShiftDetailModal;
