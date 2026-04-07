import React from "react";
import s from "./PrintQueueModal.module.scss";
import useModalKeyboardClose from "./useModalKeyboardClose";

export function PrintQueueModal({
  isOpen,
  queue = [],
  onClearAll,
  onPrintAll,
  onClose,
}) {
  useModalKeyboardClose({ isOpen, onClose });
  if (!isOpen) return null;
  const badge = (st) =>
    `${s.badge} ${
      st === "pending"
        ? s.pending
        : st === "printing"
        ? s.printing
        : st === "completed"
        ? s.completed
        : s.error
    }`;
  const statusLabel = (st) =>
    st === "pending"
      ? "Chờ in"
      : st === "printing"
      ? "Đang in"
      : st === "completed"
      ? "Hoàn tất"
      : "Lỗi";

  return (
    <div className={s.backdrop} onMouseDown={onClose} role="dialog" aria-modal>
      <div
        className={s.modal}
        role="document"
        onMouseDown={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <div className={s.header}>
          <h3 className={s.title}>Hàng đợi in</h3>
          <div className={s.tools}>
            <button className={s.btn} onClick={onClearAll}>
              Xóa tất cả
            </button>
            <button className={`${s.btn} ${s.primary}`} onClick={onPrintAll}>
              In tất cả
            </button>
          </div>
          <button className={s.close} onClick={onClose}>
            ×
          </button>
        </div>

        <div className={s.queue}>
          {queue.length === 0 ? (
            <div style={{ padding: "1rem", color: "#64748b" }}>
              Chưa có đơn chờ in
            </div>
          ) : (
            queue.map((q) => (
              <div key={q.id} className={s.item}>
                <div className={s.itemInfo}>
                  <div className={s.itemTitle}>
                    {q.label || q.type} · {q.table || "N/A"}
                  </div>
                  <div className={s.itemMeta}>
                    Máy in: {q.printerName || "Chưa gán"} ·{" "}
                    {q.count || 0} món
                  </div>
                </div>
                <span className={badge(q.status)}>{statusLabel(q.status)}</span>
              </div>
            ))
          )}
        </div>

        <div className={s.actions}>
          <button className={s.btn} onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
