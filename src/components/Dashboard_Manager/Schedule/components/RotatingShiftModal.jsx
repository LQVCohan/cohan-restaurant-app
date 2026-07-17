import React, { useEffect, useMemo, useState } from "react";
import { Check, Clock3, Search, UserX, Users, X } from "lucide-react";
import Modal from "../../../common/Modal";
import {
  buildVietnamShiftRange,
  hasRotatingShiftOverlap,
} from "../utils/rotatingSchedule";
import { toVietnamDateKey, toVietnamTime } from "../utils/partTimeSchedule";
import "./RotatingShiftModal.scss";

const DEFAULT_START_TIME = "08:00";
const DEFAULT_END_TIME = "16:00";

const getStaffName = (person) =>
  person?.name || person?.fullName || "Nhân viên";

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

  const staffRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return staffList
      .map((person) => ({
        person,
        blocked: Boolean(
          range &&
            hasRotatingShiftOverlap(
              existingShifts,
              person.id,
              range.startTime,
              range.endTime,
            ),
        ),
      }))
      .filter(({ person }) => {
        if (!keyword) return true;
        return [
          getStaffName(person),
          person.employeeCode,
          person.positionTitle,
          person.departmentLabel,
          person.roleName,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      })
      .sort((left, right) => {
        const leftSelected = selectedStaffIds.some(
          (id) => String(id) === String(left.person.id),
        );
        const rightSelected = selectedStaffIds.some(
          (id) => String(id) === String(right.person.id),
        );
        if (leftSelected !== rightSelected) return leftSelected ? -1 : 1;
        if (left.blocked !== right.blocked) return left.blocked ? 1 : -1;
        return getStaffName(left.person).localeCompare(
          getStaffName(right.person),
          "vi",
        );
      });
  }, [existingShifts, range, search, selectedStaffIds, staffList]);

  const selectedStaff = useMemo(
    () =>
      staffList.filter((person) =>
        selectedStaffIds.some((id) => String(id) === String(person.id)),
      ),
    [selectedStaffIds, staffList],
  );

  const blockedCount = staffRows.filter((row) => row.blocked).length;

  const toggleStaff = (staffId, blocked) => {
    if (blocked) return;
    setSubmitError("");
    setSelectedStaffIds((current) =>
      current.some((id) => String(id) === String(staffId))
        ? current.filter((id) => String(id) !== String(staffId))
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Thêm ca xoay"
      size="xl"
      className="rotating-shift-workspace-modal"
    >
      <Modal.Body className="rotating-shift-workspace-body">
        <form
          id="rotating-shift-form"
          className="rotating-shift-modal"
          onSubmit={handleSubmit}
        >
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

          <div className="rotating-shift-modal__workspace">
            <main className="rotating-shift-modal__main">
              {(shiftTemplates || []).length ? (
                <section className="rotating-shift-modal__section template-section">
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
                            startTime === template.startTime &&
                            endTime === template.endTime
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

              <section className="rotating-shift-modal__section staff-section">
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
                {blockedCount > 0 ? (
                  <div className="rotating-blocked-hint">
                    <UserX size={16} />
                    <span>
                      {blockedCount} nhân viên có ca trùng vẫn được hiển thị để
                      quản lý biết lý do không thể chọn.
                    </span>
                  </div>
                ) : null}
                <div className="rotating-staff-list">
                  {staffRows.map(({ person, blocked }) => {
                    const selected = selectedStaffIds.some(
                      (id) => String(id) === String(person.id),
                    );
                    return (
                      <button
                        key={person.id}
                        type="button"
                        className={`${selected ? "selected" : ""} ${blocked ? "blocked" : ""}`.trim()}
                        aria-pressed={blocked ? undefined : selected}
                        aria-label={
                          blocked
                            ? `Không thể chọn ${getStaffName(person)}: đã có ca trùng khung giờ`
                            : `${selected ? "Bỏ chọn" : "Chọn"} ${getStaffName(person)}`
                        }
                        onClick={() => toggleStaff(person.id, blocked)}
                        disabled={blocked}
                      >
                        <span className="rotating-staff-list__identity">
                          <strong>{getStaffName(person)}</strong>
                          <small>
                            {person.employeeCode || "Chưa có mã"} · {person.positionTitle || person.roleName || "Nhân viên"}
                          </small>
                          {blocked ? <em>Đã có ca trùng khung giờ</em> : null}
                        </span>
                        <span className="rotating-staff-list__check">
                          {selected ? <Check size={16} /> : null}
                          {blocked ? <X size={14} /> : null}
                        </span>
                      </button>
                    );
                  })}
                  {!staffRows.length ? (
                    <div className="rotating-staff-list__empty">
                      Không có nhân viên xoay ca phù hợp.
                    </div>
                  ) : null}
                </div>
              </section>
            </main>

            <aside className="rotating-shift-modal__side">
              <section className="rotating-selection-panel">
                <div className="rotating-selection-panel__heading">
                  <div>
                    <span className="eyebrow">Tóm tắt</span>
                    <h4>Nhân viên đã chọn</h4>
                  </div>
                  <strong>{selectedStaff.length}</strong>
                </div>
                <div className="rotating-selected-list">
                  {selectedStaff.length ? (
                    selectedStaff.map((person) => (
                      <div key={person.id} className="rotating-selected-item">
                        <div>
                          <strong>{getStaffName(person)}</strong>
                          <small>{person.positionTitle || person.roleName || "Nhân viên"}</small>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleStaff(person.id, false)}
                          aria-label={`Bỏ ${getStaffName(person)} khỏi ca`}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))
                  ) : (
                    <p>Chọn nhân viên ở danh sách bên trái để xem lại tại đây.</p>
                  )}
                </div>
              </section>

              <details className="rotating-shift-modal__advanced">
                <summary>Tùy chọn nâng cao</summary>
                <label>
                  <span>Ghi chú ca</span>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Ví dụ: luân chuyển khu vực phục vụ"
                  />
                </label>
                <label>
                  <span>Lý do ghi đè chính sách, khi hệ thống cảnh báo</span>
                  <textarea
                    rows={3}
                    value={overrideReason}
                    onChange={(event) => setOverrideReason(event.target.value)}
                    placeholder="Chỉ nhập khi quản lý chấp thuận một cảnh báo hợp lệ"
                  />
                </label>
              </details>
            </aside>
          </div>

          {submitError ? (
            <div className="rotating-shift-modal__error" role="alert">
              {submitError}
            </div>
          ) : null}
        </form>
      </Modal.Body>

      <Modal.Footer className="rotating-shift-modal__footer">
        <div className="rotating-shift-modal__footer-status">
          <Users size={16} />
          <span>
            {selectedStaff.length
              ? `${selectedStaff.length} nhân viên · ${startTime}–${range ? toVietnamTime(range.endTime) : endTime}`
              : "Chưa chọn nhân viên"}
          </span>
        </div>
        <div className="rotating-shift-modal__footer-actions">
          <button type="button" className="secondary" onClick={onClose} disabled={submitting}>
            Hủy
          </button>
          <button
            type="submit"
            form="rotating-shift-form"
            className="primary"
            disabled={submitting}
          >
            {submitting ? "Đang tạo ca…" : "Tạo ca xoay"}
          </button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default RotatingShiftModal;
