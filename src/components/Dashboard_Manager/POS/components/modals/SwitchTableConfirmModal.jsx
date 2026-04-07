import React from "react";
import s from "./SwitchTableConfirmModal.module.scss";
import useModalKeyboardClose from "./useModalKeyboardClose";

export default function SwitchTableConfirmModal({
  isOpen,
  fromLabel,
  toLabel,
  itemCount = 0,
  onCancel,
  onConfirm,
}) {
  useModalKeyboardClose({ isOpen, onClose: onCancel });
  if (!isOpen) return null;

  return (
    <div
      className={s.backdrop}
      onMouseDown={onCancel}
      role="dialog"
      aria-modal="true"
    >
      <div className={s.modal} onMouseDown={(e) => e.stopPropagation()} tabIndex={-1}>
        <div className={s.header}>
          <h3>Xác nhận đổi</h3>
          <button className={s.close} onClick={onCancel}>
            ✕
          </button>
        </div>

        <div className={s.body}>
          <div className={s.row}>
            <span className={s.label}>Từ:</span>
            <span className={s.value}>{fromLabel || "—"}</span>
          </div>
          <div className={s.row}>
            <span className={s.label}>Sang:</span>
            <span className={s.value}>{toLabel || "—"}</span>
          </div>

          <div className={s.note}>
            Bạn đang có <b>{itemCount}</b> món mới chưa lưu. Nếu đổi, món sẽ
            được chuyển sang vị trí mới (chỉ ở FE, chưa lưu server).
          </div>
        </div>

        <div className={s.footer}>
          <button className={s.btnGhost} onClick={onCancel}>
            Ở lại
          </button>
          <button className={s.btnPrimary} onClick={onConfirm}>
            Đổi
          </button>
        </div>
      </div>
    </div>
  );
}
