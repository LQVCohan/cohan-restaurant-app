import React from "react";
import "./TableActions.scss";

export default function TableActions({
  anchorRect,
  onClose,
  onOpenInfo,
  onMoveTable,
  onMergeTable,
  onReserve,
  onFree,
  onDelete, // soft delete (yêu cầu lý do) -> chỉ gửi sự kiện
}) {
  if (!anchorRect) return null;

  const style = {
    position: "fixed",
    top: anchorRect.bottom + 6,
    left: Math.max(8, Math.min(window.innerWidth - 210, anchorRect.left)),
  };

  return (
    <div className="table-actions" style={style} role="menu">
      <button className="table-action-btn" onClick={onOpenInfo}>
        <span>ℹ️</span> Thông tin bàn
      </button>
      <button className="table-action-btn" onClick={onMoveTable}>
        <span>🔁</span> Chuyển bàn
      </button>
      <button className="table-action-btn" onClick={onMergeTable}>
        <span>➕</span> Ghép bàn
      </button>

      <div className="table-actions-divider" />

      <button className="table-action-btn" onClick={onReserve}>
        <span>📌</span> Đặt trước
      </button>
      <button className="table-action-btn" onClick={onFree}>
        <span>✅</span> Trả bàn
      </button>

      <div className="table-actions-divider" />

      <button
        className="table-action-btn table-action-btn--danger"
        onClick={onDelete}
      >
        <span>🗑️</span> Yêu cầu xóa (POS)
      </button>

      <div className="table-actions-divider" />

      <button className="table-action-btn" onClick={onClose}>
        Đóng
      </button>
    </div>
  );
}
