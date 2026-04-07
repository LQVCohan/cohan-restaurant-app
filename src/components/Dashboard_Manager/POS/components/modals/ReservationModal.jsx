import React, { useState } from "react";
import s from "./ReservationModal.module.scss";
import useModalKeyboardClose from "./useModalKeyboardClose";

export function ReservationModal({ isOpen, onConfirm, onClose }) {
  useModalKeyboardClose({ isOpen, onClose });
  const [form, setForm] = useState({
    name: "",
    phone: "",
    guests: 1,
    time: "",
    note: "",
  });
  if (!isOpen) return null;

  const change = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div
      className={s.backdrop}
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className={s.modal} onMouseDown={(e) => e.stopPropagation()} tabIndex={-1}>
        <h3 className={s.title}>Đặt bàn</h3>
        <input
          className={s.input}
          placeholder="Tên khách"
          onChange={(e) => change("name", e.target.value)}
        />
        <input
          className={s.input}
          placeholder="SĐT"
          onChange={(e) => change("phone", e.target.value)}
        />
        <input
          className={s.input}
          type="number"
          min={1}
          placeholder="Số khách"
          onChange={(e) => change("guests", Number(e.target.value))}
        />
        <input
          className={s.input}
          type="datetime-local"
          onChange={(e) => change("time", e.target.value)}
        />
        <textarea
          className={s.textarea}
          placeholder="Ghi chú"
          onChange={(e) => change("note", e.target.value)}
        />
        <div className={s.actions}>
          <button onClick={onClose}>Hủy</button>
          <button onClick={() => onConfirm?.(form)}>Xác nhận</button>
        </div>
      </div>
    </div>
  );
}
