import React, { useEffect, useState } from "react";
import Modal from "../../../../common/Modal";
import "./StockOutModal.scss";

const StockOutModal = ({ isOpen, onClose, onConfirm, supply, isSubmitting = false }) => {
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");

  // Reset form khi mở modal
  useEffect(() => {
    if (isOpen) {
      setQty("");
      setReason("");
    }
  }, [isOpen]);

  const canSubmit = qty !== "" && Number(qty) > 0 && !isSubmitting;

  const confirm = () => {
    if (!canSubmit) return;
    onConfirm?.({
      qty: Number(qty),
      reason: reason || undefined,
    });
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Xuất kho hàng hoá"
      size="md"
      className="storage-modal-shell storage-modal-stock-out"
    >
      <div className="so-container">
        {/* Header Info Block */}
        <div className="so-product-info">
          <div className="so-pi-row">
            <span className="so-pi-label">Sản phẩm:</span>
            <span className="so-pi-name">{supply?.name || "..."}</span>
          </div>
          <div className="so-pi-fifo">
            <i className="fifo-icon">🔄</i>
            <span>Xuất FIFO: Hệ thống tự động trừ lô cũ nhất trước.</span>
          </div>
        </div>

        {/* --- Main Input: Quantity --- */}
        <div className="so-main-action">
          <label className="so-field-center">
            <span className="so-label">
              Số lượng xuất ({supply?.unit || "unit"})
            </span>
            <input
              className="so-input-huge"
              type="number"
              min="0.00001"
              step="any"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="0"
              autoFocus
            />
          </label>
        </div>

        {/* --- Reason Input --- */}
        <div className="so-reason-block">
          <label className="so-field">
            <span className="so-label">Lý do / Ghi chú (Tuỳ chọn)</span>
            <input
              className="so-input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="VD: Hư hỏng, sử dụng nội bộ..."
            />
          </label>
        </div>
      </div>

      <Modal.Footer>
        <button className="so-btn-cancel" onClick={onClose}>
          Huỷ bỏ
        </button>
        <button
          className="so-btn-confirm"
          onClick={confirm}
          disabled={!canSubmit}
        >
          {isSubmitting ? "Đang xử lý..." : "Xác nhận xuất"}
        </button>
      </Modal.Footer>
    </Modal>
  );
};

export default StockOutModal;
