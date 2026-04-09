import React, { useState } from "react";
import s from "./ReservationModal.module.scss";
import useModalClosePipeline from "../../../../../hooks/useModalClosePipeline";
import useModalDraft from "../../../../../hooks/useModalDraft";
import { useNotification } from "../../../../../hooks/useNotification";

export function ReservationModal({ isOpen, onConfirm, onClose }) {
  const { showNotification } = useNotification();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    guests: 1,
    time: "",
    note: "",
  });
  const hasDirtyForm =
    !!form.name.trim() ||
    !!form.phone.trim() ||
    !!form.note.trim() ||
    !!form.time ||
    Number(form.guests || 0) > 1;

  const { requestCloseWithDraft, clearDraft } = useModalDraft({
    enabled: isOpen,
    draftIdentity: {
      module: "pos",
      modal: "reservation-modal",
      route: typeof window !== "undefined" ? window.location.pathname : "unknown",
      mode: "create",
      entityType: "reservation",
      recordId: null,
      context: "pos-right-panel",
      schemaVersion: "1",
    },
    formValue: form,
    isDirty: hasDirtyForm,
    sanitize: (v) => ({
      guests: Number(v?.guests || 1),
      time: v?.time || "",
      note: v?.note || "",
    }),
    onRestore: (draft) => {
      setForm((prev) => ({ ...prev, ...draft }));
      showNotification(
        "Một số thông tin nhạy cảm (tên/SĐT khách) không được khôi phục tự động.",
        "info",
        2800,
      );
    },
    notify: showNotification,
  });

  const { requestClose, onBackdropMouseDown } = useModalClosePipeline({
    isOpen,
    onClose: () => requestCloseWithDraft(() => onClose?.()),
  });

  if (!isOpen) return null;

  const change = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div
      className={s.backdrop}
      onMouseDown={onBackdropMouseDown}
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
          <button onClick={() => requestClose("cancel")}>Hủy</button>
          <button
            onClick={() => {
              onConfirm?.(form);
              clearDraft();
            }}
          >
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  );
}
