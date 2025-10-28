import React from "react";
import s from "./PrintQueueModal.module.scss";

export function PrintQueueModal({
  isOpen,
  queue = [],
  onClearAll,
  onPrintAll,
  onClose,
}) {
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

  return (
    <div className={s.backdrop}>
      <div className={s.modal} role="dialog" aria-modal>
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
                <span>
                  {q.type} · {q.table || "N/A"}
                </span>
                <span className={badge(q.status)}>{q.status}</span>
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
