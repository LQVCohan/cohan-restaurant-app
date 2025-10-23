import React, { useState, useEffect } from "react";
import Modal, { ModalFooter } from "../../../../common/Modal";
import "./StockOutModal.scss";

const StockOutModal = ({ isOpen, onClose, onConfirm, supply }) => {
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (isOpen) {
      setQty("");
      setReason("");
    }
  }, [isOpen]);

  const canSubmit = qty !== "" && Number(qty) > 0;

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
      title={`📤 Xuất kho — ${supply?.name ?? ""}`}
      size="md"
    >
      <div className="stockout-modal">
        <label>
          Số lượng ({supply?.unit})
          <input
            type="number"
            min="0.00001"
            step="0.01"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="0"
          />
        </label>

        <label>
          Lý do (tuỳ chọn)
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ghi chú..."
          />
        </label>
      </div>

      <ModalFooter>
        <button className="btn btn--secondary" onClick={onClose}>
          Hủy
        </button>
        <button
          className="btn btn--primary"
          onClick={confirm}
          disabled={!canSubmit}
          title={!canSubmit ? "Nhập số lượng hợp lệ" : "Xác nhận xuất"}
        >
          Xác nhận
        </button>
      </ModalFooter>
    </Modal>
  );
};

export default StockOutModal;
