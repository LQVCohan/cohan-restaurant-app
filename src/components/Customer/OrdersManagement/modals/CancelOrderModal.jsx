// src/components/orders/modals/CancelOrderModal.jsx
import React, { useState, useEffect } from "react";
import Modal from "@/components/common/Modal";

const REASONS = [
  "Tôi đặt nhầm",
  "Đổi ý/đổi kế hoạch",
  "Thời gian chờ quá lâu",
  "Muốn đổi sang nhà hàng khác",
  "Lý do khác",
];

export default function CancelOrderModal({
  isOpen,
  onClose,
  onConfirm, // (payload: {reason, note}) => void
  title = "❌ Hủy đơn",
  defaultReason = "Tôi đặt nhầm",
}) {
  const [reason, setReason] = useState(defaultReason);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (isOpen) {
      setReason(defaultReason);
      setNote("");
    }
  }, [isOpen, defaultReason]);

  const submit = () => {
    if (!reason) return;
    onConfirm?.({ reason, note: note.trim() || undefined });
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="cancel-modal">
        <p>Vui lòng chọn lý do hủy:</p>
        <div className="cancel-reasons">
          {REASONS.map((r) => (
            <label
              key={r}
              className={`reason-chip ${r === reason ? "active" : ""}`}
            >
              <input
                type="radio"
                name="cancelReason"
                value={r}
                checked={r === reason}
                onChange={() => setReason(r)}
              />
              <span>{r}</span>
            </label>
          ))}
        </div>

        <div className="form-group" style={{ marginTop: 12 }}>
          <label>Ghi chú thêm (tuỳ chọn)</label>
          <textarea
            rows={3}
            className="form-input"
            placeholder="Nhập ghi chú cho nhà hàng…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>

      <Modal.Footer>
        <button className="btn btn--secondary" onClick={onClose}>
          Đóng
        </button>
        <button className="btn btn--danger" onClick={submit}>
          Xác nhận hủy
        </button>
      </Modal.Footer>
    </Modal>
  );
}
