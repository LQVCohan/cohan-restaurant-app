// src/components/orders/modals/ChangeTimeModal.jsx
import React, { useEffect, useState, useMemo } from "react";
import Modal, { ModalFooter } from "@/components/common/Modal";

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
  onSubmit, // (payload: {iso, date, time}) => void
  title = "🕐 Đổi thời gian",
  minDate, // yyyy-mm-dd
  initialDate, // yyyy-mm-dd
  initialTime, // HH:mm
}) {
  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  const min = minDate || today;

  const [date, setDate] = useState(initialDate || min);
  const [time, setTime] = useState(initialTime || "19:30");

  useEffect(() => {
    if (isOpen) {
      setDate(initialDate || min);
      setTime(initialTime || "19:30");
    }
  }, [isOpen, initialDate, initialTime, min]);

  const submit = () => {
    const iso = toISOFromDateAndTime(date, time);
    if (!iso) return;
    onSubmit?.({ iso, date, time });
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
          💡 Hệ thống sẽ kiểm tra bàn trống tự động khi xác nhận.
        </div>
      </div>

      <ModalFooter>
        <button className="btn btn--secondary" onClick={onClose}>
          Huỷ
        </button>
        <button className="btn btn--primary" onClick={submit}>
          Xác nhận
        </button>
      </ModalFooter>
    </Modal>
  );
}
