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
  const d = new Date(dateStr);
  d.setHours(h || 0, m || 0, 0, 0);
  return d.toISOString();
}

export default function ChangeTimeModal({
  isOpen,
  onClose,
  onSubmit, // (payload: {timeTo, iso, date, time}) => void
  title = "🕐 Đổi thời gian",
  minDate, // yyyy-mm-dd
  initialDate, // yyyy-mm-dd
  initialTime, // HH:mm
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

  const submit = () => {
    const iso = toISOFromDateAndTime(date, time);
    if (!iso) return;
    onSubmit?.({ timeTo: iso, iso, date, time });
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="time-modal">
        <div className="form-row">
          <label>Ngày mới</label>
          <input
            type="date"
            min={min}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="form-row">
          <label>Giờ mới</label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>

        <div className="hint">
          💡 Đã tự gợi ý khung an toàn gần nhất. Hệ thống sẽ kiểm tra bàn trống khi xác nhận.
        </div>
      </div>

      <Modal.Footer>
        <button className="btn btn--secondary" onClick={onClose}>
          Huỷ
        </button>
        <button className="btn btn--primary" onClick={submit}>
          Xác nhận
        </button>
      </Modal.Footer>
    </Modal>
  );
}
