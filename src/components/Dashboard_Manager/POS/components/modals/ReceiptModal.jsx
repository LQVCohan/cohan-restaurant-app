import React from "react";
import s from "./ReceiptModal.module.scss";
import { formatPrice } from "../../utils/format";
import useModalKeyboardClose from "./useModalKeyboardClose";

export function ReceiptModal({ isOpen, receipt, onPrint, onClose }) {
  useModalKeyboardClose({ isOpen, onClose });
  if (!isOpen) return null;
  return (
    <div
      className={s.backdrop}
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className={s.modal} onMouseDown={(e) => e.stopPropagation()} tabIndex={-1}>
        <h3 className={s.title}>Hóa đơn</h3>
        <div className={s.receipt}>
          {receipt?.items?.map((it) => (
            <div key={it.id}>
              <span>
                {it.name} ×{it.quantity}
              </span>
              <b>{formatPrice(it.total)}</b>
            </div>
          ))}
          <hr />
          <b>Tổng: {formatPrice(receipt?.totals?.total || 0)}</b>
        </div>
        <div className={s.actions}>
          <button className={s.btn} onClick={onClose}>
            Đóng
          </button>
          <button className={`${s.btn} ${s.primary}`} onClick={onPrint}>
            In
          </button>
        </div>
      </div>
    </div>
  );
}
