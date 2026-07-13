// src/components/orders/modals/ChangeTimeModal.jsx
import React, { useEffect, useState, useMemo } from "react";
import Modal from "@/components/common/Modal";

function toDateInput(date) {
  return date.toLocaleDateString("en-CA");
}

function toTimeInput(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function getNextSafeSlot() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(19, 30, 0, 0);
  return d;
}

function toISOFromDateAndTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const [h, m] = timeStr.split(":").map(Number);
  const d = new Date(`${dateStr}T00:00:00`);
  d.setHours(h || 0, m || 0, 0, 0);
  return d.toISOString();
}

export default function ChangeTimeModal({
  isOpen,
  onClose,
  onSubmit,
  title = "Đổi thời gian đặt bàn",
  minDate,
  initialDate,
  initialTime,
}) {
  const suggestedSlot = useMemo(getNextSafeSlot, []);
  const today = useMemo(() => toDateInput(new Date()), []);
  const min = minDate || today;

  const defaultDate = initialDate || toDateInput(suggestedSlot);
  const defaultTime = initialTime || toTimeInput(suggestedSlot);
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState(defaultTime);

  useEffect(() => {
    if (isOpen) {
      setDate(defaultDate);
      setTime(defaultTime);
    }
  }, [isOpen, defaultDate, defaultTime]);

  const iso = useMemo(() => toISOFromDateAndTime(date, time), [date, time]);
  const selectedDate = iso ? new Date(iso) : null;
  const isPast = !selectedDate || selectedDate.getTime() <= Date.now();
  const preview = selectedDate && !Number.isNaN(selectedDate.getTime())
    ? selectedDate.toLocaleString("vi-VN", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    : "Chưa chọn thời gian";

  const submit = () => {
    if (!iso || isPast) return;
    onSubmit?.({ timeTo: iso, iso, date, time });
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="time-modal">
        <div className="form-row">
          <label htmlFor="reservation-change-date">Ngày mới</label>
          <input
            id="reservation-change-date"
            type="date"
            min={min}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="form-row">
          <label htmlFor="reservation-change-time">Giờ mới</label>
          <input
            id="reservation-change-time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>

        <div className={`change-time-review ${isPast ? "is-error" : ""}`} role="status">
          <span>Thời gian đề nghị</span>
          <strong>{preview}</strong>
          <small>
            {isPast
              ? "Vui lòng chọn thời gian trong tương lai."
              : "Nhà hàng sẽ kiểm tra bàn trống trước khi duyệt."}
          </small>
        </div>
      </div>

      <Modal.Footer>
        <button className="btn btn--secondary" onClick={onClose}>
          Hủy
        </button>
        <button className="btn btn--primary" onClick={submit} disabled={isPast}>
          Gửi yêu cầu đổi giờ
        </button>
      </Modal.Footer>
    </Modal>
  );
}
