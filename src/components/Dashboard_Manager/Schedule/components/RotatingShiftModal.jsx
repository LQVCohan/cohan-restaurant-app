import React, { useEffect, useMemo, useState } from "react";
import { Check, Clock3, Search, Users } from "lucide-react";
import Modal from "../../../common/Modal";
import {
  buildVietnamShiftRange,
  hasRotatingShiftOverlap,
} from "../utils/rotatingSchedule";
import { toVietnamDateKey, toVietnamTime } from "../utils/partTimeSchedule";
import "./RotatingShiftModal.scss";

const DEFAULT_START_TIME = "08:00";
const DEFAULT_END_TIME = "16:00";

const RotatingShiftModal = ({
  isOpen,
  date,
  staffList = [],
  existingShifts = [],
  shiftTemplates = [],
  onClose,
  onConfirm,
  submitting = false,
}) => {
  const firstTemplate = useMemo(
    () =>
      (shiftTemplates || []).find(
        (template) =>
          template?.enabled !== false && template?.startTime && template?.endTime,
      ) || null,
    [shiftTemplates],
  );
  const [startTime, setStartTime] = useState(DEFAULT_START_TIME);
  const [endTime, setEndTime] = useState(DEFAULT_END_TIME);
  const [selectedStaffIds, setSelectedStaffIds] = useState([]);
  const [search, setSearch] = useState("");
  const [notes, setNotes] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setStartTime(firstTemplate?.startTime || DEFAULT_START_TIME);
    setEndTime(firstTemplate?.endTime || DEFAULT_END_TIME);
    setSelectedStaffIds([]);
    setSearch("");
    setNotes("");
    setOverrideReason("");
    setSubmitError("");
  }, [date, firstTemplate?.endTime, firstTemplate?.startTime, isOpen]);

  const range = useMemo(() => {
    try {
      return buildVietnamShiftRange({ date, startTime, endTime });
    } catch {
      return null;
    }
  }, [date, endTime, startTime]);

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
        person.roleName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [search, staffList]);

  const toggleStaff = (staffId, blocked) => {
    if (blocked) return;
    setSubmitError("");
    setSelectedStaffIds((current) =>
      current.includes(staffId)
        ? current.filter((id) => id !== staffId)
        : [...current, staffId],
    );
  };

  const applyTemplate = (template) => {
    setStartTime(template.startTime);
    setEndTime(template.endTime);
    setSelectedStaffIds([]);
    setSubmitError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError("");
    if (!range) {
      setSubmitError("Khung giờ ca xoay không hợp lệ.");
      return;
    }
    if (range.startTime.getTime() <= Date.now()) {
      setSubmitError("Không thể tạo ca đã bắt đầu hoặc đã kết thúc.");
      return;
    }
    if (!selectedStaffIds.length) {
      setSubmitError("Cần chọn ít nhất một nhân viên xoay ca.");
      return;
    }

    try {
      await onConfirm({
        date,
        startTime,
        endTime,
        staffIds: selectedStaffIds,
        notes: notes.trim(),
        overrideReason: overrideReason.trim(),
      });
    } catch (error) {
      setSubmitError(error?.message || "Không thể tạo ca xoay.");
    }
  };

  const crossesDay = Boolean(
    range && toVietnamDateKey(range.endTime) !== String(date || ""),
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Thêm ca xoay">
      <form className="rotating-shift-modal" onSubmit={handleSubmit}>
        <section className="rotating-shift-modal__summary">
          <div>
            <span>Ngày</span>
            <strong>{date || "--"}</strong>
          </div>
          <div>
            <span>Bắt đầu</span>
            <strong>{startTime}</strong>
          </div>
          <div>
            <span>Kết thúc</span>
            <strong>
              {range ? toVietnamTime(range.endTime) : "--:--"}
              {crossesDay ? " · ngày hôm sau" : ""}
            </strong>
          </div>
        </section>

        {(shiftTemplates || []).length ? (
          <section className="rotating-shift-modal__section">
            <div className="rotating-shift-modal__section-heading">
              <div>
                <span className="eyebrow">Mẫu ca</span>
                <h4>Chọn nhanh khung giờ</h4>
              </div>
            </div>
            <div className="rotating-template-list">
              {shiftTemplates
                .filter(
                  (template) =>
                    template?.enabled !== false &&
                    template?.startTime &&
                    template?.endTime,
                )
                .map((template) => (
                  <button
                    key={`${template.key || template.label}-${template.startTime}`}
                    type="button"
                    className={
                      startTime === template.startTime && endTime === template.endTime
                        ? "active"
                        : ""
                    }
                    onClick={() => applyTemplate(template)}
                  >
                    <strong>{template.label || template.key || "Ca"}</strong>
                    <span>
                      {template.startTime} - {template.endTime}
                    </span>
                  </button>
                ))}
            </div>
          </section>
        ) : null}

        <section className="rotating-shift-modal__section rotating-time-fields">
          <label>
            <span>Giờ bắt đầu</span>
            <input
              type="time"
              value={startTime}
              onChange={(event) => {
                setStartTime(event.target.value);
                setSelectedStaffIds([]);
              }}
            />
          </label>
          <label>
            <span>Giờ kết thúc</span>
            <input
              type="time"
              value={endTime}
              onChange={(event) => {
                setEndTime(event.target.value);
                setSelectedStaffIds([]);
              }}
            />
          </label>
          <span className="rotating-time-result">
            <Clock3 size={15} />
            {range
              ? `${toVietnamTime(range.startTime)} - ${toVietnamTime(range.endTime)}`
              : "Khung giờ chưa hợp lệ"}
          </span>
        </section>

        <section className="rotating-shift-modal__section">
          <div className="rotating-shift-modal__section-heading">
            <div>
              <span className="eyebrow">Phân công</span>
              <h4>Nhân viên được cấu hình xoay ca</h4>
            </div>
            <span className="selected-counter">
              <Users size={15} /> {selectedStaffIds.length} đã chọn
            </span>
          </div>
          <label className="rotating-staff-search">
            <Search size={16} />
            <input
              type="search"
              placeholder="Tìm tên, mã nhân viên, vai trò…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <div className="rotating-staff-list">
            {filteredStaff.map((person) => {
              const selected = selectedStaffIds.includes(person.id);
              const blocked = Boolean(
                range &&
                  hasRotatingShiftOverlap(
                    existingShifts,
                    person.id,
                    range.startTime,
                    range.endTime,
                  ),
              );
              return (
                <button
                  key={person.id}
                  type="button"
                  className={`${selected ? "selected" : ""} ${blocked ? "blocked" : ""}`.trim()}
                  onClick={() => toggleStaff(person.id, blocked)}
                  disabled={blocked}
                >
                  <span className="rotating-staff-list__identity">
                    <strong>{person.name || person.fullName}</strong>
                    <small>
                      {person.employeeCode || "Chưa có mã"} · {person.positionTitle || person.roleName || "Nhân viên"}
                    </small>
                    {blocked ? <em>Đã có ca trùng khung giờ</em> : null}
                  </span>
                  <span className="rotating-staff-list__check">
                    {selected ? <Check size={16} /> : null}
                  </span>
                </button>
              );
            })}
            {!filteredStaff.length ? (
              <div className="rotating-staff-list__empty">
                Không có nhân viên xoay ca phù hợp.
              </div>
            ) : null}
          </div>
        </section>

        <section className="rotating-shift-modal__section compact">
          <label>
            <span>Ghi chú ca</span>
            <textarea
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Ví dụ: luân chuyển khu vực phục vụ"
            />
          </label>
          <label>
            <span>Lý do ghi đè chính sách, khi hệ thống cảnh báo</span>
            <textarea
              rows={2}
              value={overrideReason}
              onChange={(event) => setOverrideReason(event.target.value)}
              placeholder="Chỉ nhập khi quản lý chấp thuận một cảnh báo hợp lệ"
            />
          </label>
        </section>

        {submitError ? (
          <div className="rotating-shift-modal__error" role="alert">
            {submitError}
          </div>
        ) : null}

        <footer className="rotating-shift-modal__footer">
          <button type="button" className="secondary" onClick={onClose} disabled={submitting}>
            Hủy
          </button>
          <button type="submit" className="primary" disabled={submitting}>
            {submitting ? "Đang tạo ca…" : "Tạo ca xoay"}
          </button>
        </footer>
      </form>
    </Modal>
  );
};

export default RotatingShiftModal;
