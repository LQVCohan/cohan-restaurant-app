import React, { useEffect, useMemo, useState } from "react";
import { Check, Clock3, Search, Users } from "lucide-react";
import Modal from "../../../common/Modal";
import {
  buildLocalShiftRange,
  formatDurationHours,
  toVietnamDateKey,
  toVietnamTime,
} from "../utils/partTimeSchedule";
import "./PartTimeShiftModal.scss";

const QUICK_DURATIONS = [2, 3, 4, 5, 6, 8];

const PartTimeShiftModal = ({
  isOpen,
  date,
  startTime = "08:00",
  staffList = [],
  onClose,
  onConfirm,
  submitting = false,
  defaultDurationHours = 4,
}) => {
  const [durationHours, setDurationHours] = useState(defaultDurationHours);
  const [selectedStaffIds, setSelectedStaffIds] = useState([]);
  const [search, setSearch] = useState("");
  const [notes, setNotes] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setDurationHours(defaultDurationHours || 4);
    setSelectedStaffIds([]);
    setSearch("");
    setNotes("");
    setOverrideReason("");
    setSubmitError("");
  }, [isOpen, date, startTime, defaultDurationHours]);

  const rangePreview = useMemo(() => {
    try {
      return buildLocalShiftRange({ date, startTime, durationHours });
    } catch {
      return null;
    }
  }, [date, startTime, durationHours]);

  const filteredStaff = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return staffList;
    return staffList.filter((person) =>
      [
        person.name,
        person.fullName,
        person.employeeCode,
        person.positionTitle,
        person.departmentLabel,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [staffList, search]);

  const toggleStaff = (staffId) => {
    setSubmitError("");
    setSelectedStaffIds((current) =>
      current.includes(staffId)
        ? current.filter((id) => id !== staffId)
        : [...current, staffId],
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError("");
    if (!rangePreview) {
      setSubmitError("Thời gian ca không hợp lệ.");
      return;
    }
    if (!selectedStaffIds.length) {
      setSubmitError("Cần chọn ít nhất một nhân viên bán thời gian.");
      return;
    }
    try {
      await onConfirm({
        date,
        startTime,
        durationHours: Number(durationHours),
        staffIds: selectedStaffIds,
        notes: notes.trim(),
        overrideReason: overrideReason.trim(),
      });
    } catch (error) {
      setSubmitError(error?.message || "Không thể tạo ca bán thời gian.");
    }
  };

  const endDateKey = rangePreview
    ? toVietnamDateKey(rangePreview.endTime)
    : "";
  const crossesDay = Boolean(endDateKey && endDateKey !== date);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Thêm ca bán thời gian"
    >
      <form className="part-time-shift-modal" onSubmit={handleSubmit}>
        <section className="part-time-shift-modal__summary">
          <div>
            <span>Ngày</span>
            <strong>{date || "--"}</strong>
          </div>
          <div>
            <span>Bắt đầu tự động</span>
            <strong>{startTime}</strong>
          </div>
          <div>
            <span>Kết thúc dự kiến</span>
            <strong>
              {rangePreview ? toVietnamTime(rangePreview.endTime) : "--:--"}
              {crossesDay ? " · ngày hôm sau" : ""}
            </strong>
          </div>
        </section>

        <section className="part-time-shift-modal__section">
          <div className="part-time-shift-modal__section-heading">
            <div>
              <span className="eyebrow">Thời lượng</span>
              <h4>Chọn số giờ của block ca</h4>
            </div>
            <span className="duration-result">
              <Clock3 size={15} /> {formatDurationHours(durationHours)} giờ
            </span>
          </div>
          <div className="duration-presets" aria-label="Chọn nhanh thời lượng ca">
            {QUICK_DURATIONS.map((hours) => (
              <button
                key={hours}
                type="button"
                className={Number(durationHours) === hours ? "active" : ""}
                onClick={() => setDurationHours(hours)}
              >
                {hours} giờ
              </button>
            ))}
          </div>
          <label className="custom-duration-field">
            <span>Thời lượng riêng của doanh nghiệp</span>
            <input
              type="number"
              min="1"
              max="12"
              step="0.5"
              value={durationHours}
              onChange={(event) => setDurationHours(event.target.value)}
            />
          </label>
        </section>

        <section className="part-time-shift-modal__section">
          <div className="part-time-shift-modal__section-heading">
            <div>
              <span className="eyebrow">Phân công</span>
              <h4>Nhân viên bán thời gian</h4>
            </div>
            <span className="selected-counter">
              <Users size={15} /> {selectedStaffIds.length} đã chọn
            </span>
          </div>
          <label className="part-time-staff-search">
            <Search size={16} />
            <input
              type="search"
              placeholder="Tìm tên, mã nhân viên, vị trí…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <div className="part-time-staff-list">
            {filteredStaff.map((person) => {
              const selected = selectedStaffIds.includes(person.id);
              return (
                <button
                  key={person.id}
                  type="button"
                  className={selected ? "selected" : ""}
                  onClick={() => toggleStaff(person.id)}
                >
                  <span className="part-time-staff-list__identity">
                    <strong>{person.name || person.fullName}</strong>
                    <small>
                      {person.employeeCode || "Chưa có mã"} · {person.positionTitle || person.departmentLabel || "Nhân viên"}
                    </small>
                  </span>
                  <span className="part-time-staff-list__check">
                    {selected ? <Check size={16} /> : null}
                  </span>
                </button>
              );
            })}
            {!filteredStaff.length ? (
              <div className="part-time-staff-list__empty">
                Không có nhân viên bán thời gian phù hợp.
              </div>
            ) : null}
          </div>
        </section>

        <section className="part-time-shift-modal__section compact">
          <label>
            <span>Ghi chú ca</span>
            <textarea
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Ví dụ: tăng cường khung giờ cao điểm"
            />
          </label>
          <label>
            <span>Lý do ghi đè chính sách, khi hệ thống cảnh báo</span>
            <textarea
              rows={2}
              value={overrideReason}
              onChange={(event) => setOverrideReason(event.target.value)}
              placeholder="Chỉ cần nhập khi ca có cảnh báo hợp lệ cần quản lý chấp thuận"
            />
          </label>
        </section>

        {submitError ? (
          <div className="part-time-shift-modal__error" role="alert">
            {submitError}
          </div>
        ) : null}

        <footer className="part-time-shift-modal__footer">
          <button type="button" className="secondary" onClick={onClose} disabled={submitting}>
            Hủy
          </button>
          <button type="submit" className="primary" disabled={submitting}>
            {submitting ? "Đang tạo ca…" : "Tạo block ca"}
          </button>
        </footer>
      </form>
    </Modal>
  );
};

export default PartTimeShiftModal;
