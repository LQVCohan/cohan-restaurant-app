import React, { useEffect, useState } from "react";
import Modal, { ModalFooter } from "../../../../common/Modal";
import "./StockInModal.scss";

const StockInModal = ({ isOpen, onClose, onConfirm, supply }) => {
  const [qty, setQty] = useState("");
  const [lot, setLot] = useState("");
  const [expiry, setExpiry] = useState("");
  const [costPerBaseUnit, setCostPerBaseUnit] = useState("");
  const [reason, setReason] = useState("");
  const [supplier, setSupplier] = useState("");

  useEffect(() => {
    if (isOpen) {
      setQty("");
      setLot("");
      setExpiry("");
      setCostPerBaseUnit("");
      setReason("");
      setSupplier("");
    }
  }, [isOpen]);

  const canSubmit =
    qty !== "" &&
    Number(qty) > 0 &&
    (costPerBaseUnit === "" || Number(costPerBaseUnit) >= 0);

  const confirm = () => {
    if (!canSubmit) return;
    onConfirm?.({
      qty: Number(qty),
      lot: lot || undefined,
      expiry: expiry ? new Date(expiry).toISOString() : undefined,
      costPerBaseUnit:
        costPerBaseUnit !== "" ? Number(costPerBaseUnit) : undefined,
      supplier: supplier || undefined,
      reason: reason || undefined,
    });
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`📦 Nhập kho — ${supply?.name ?? ""}`}
      size="md"
    >
      <div className="stockin-modal">
        <div className="grid-2">
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
            Giá/đơn vị nhập (tuỳ chọn)
            <input
              type="number"
              min="0"
              step="0.01"
              value={costPerBaseUnit}
              onChange={(e) => setCostPerBaseUnit(e.target.value)}
              placeholder="0"
            />
          </label>
        </div>

        <div className="grid-2">
          <label>
            Lô (tuỳ chọn)
            <input
              value={lot}
              onChange={(e) => setLot(e.target.value)}
              placeholder="K1-2025-10-01"
            />
          </label>

          <label>
            Hạn dùng (tuỳ chọn)
            <input
              type="date"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
            />
          </label>
        </div>

        <label>
          Nhà cung cấp (tuỳ chọn)
          <input
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            placeholder="Công ty ABC"
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
          title={!canSubmit ? "Nhập số lượng hợp lệ" : "Xác nhận nhập kho"}
        >
          Xác nhận
        </button>
      </ModalFooter>
    </Modal>
  );
};

export default StockInModal;
