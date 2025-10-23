import React, { useEffect, useState, useMemo } from "react";
import Modal, { ModalFooter } from "../../../../common/Modal";
import "./StockTransferModal.scss";

const StockTransferModal = ({
  isOpen,
  onClose,
  onConfirm,
  supply,
  warehouses = [],
}) => {
  const [fromWarehouseId, setFromWarehouseId] = useState("");
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (isOpen) {
      setFromWarehouseId("");
      setToWarehouseId("");
      setQty("");
      setReason("");
    }
  }, [isOpen]);

  const canSubmit = useMemo(() => {
    return (
      fromWarehouseId &&
      toWarehouseId &&
      fromWarehouseId !== toWarehouseId &&
      qty !== "" &&
      Number(qty) > 0
    );
  }, [fromWarehouseId, toWarehouseId, qty]);

  const confirm = () => {
    if (!canSubmit) return;
    onConfirm?.({
      restaurantId: supply.restaurantId,
      supplyId: supply.id,
      fromWarehouseId,
      toWarehouseId,
      qty: Number(qty),
      reason: reason || undefined,
    });
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`🔄 Chuyển kho — ${supply?.name}`}
      size="md"
    >
      <div className="stocktransfer-modal">
        <label>
          Kho xuất
          <select
            value={fromWarehouseId}
            onChange={(e) => setFromWarehouseId(e.target.value)}
          >
            <option value="">Chọn kho</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Kho nhận
          <select
            value={toWarehouseId}
            onChange={(e) => setToWarehouseId(e.target.value)}
          >
            <option value="">Chọn kho</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Số lượng ({supply.unit})
          <input
            type="number"
            min="0.0001"
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
            placeholder="Chuyển kho do..."
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
          title={
            !canSubmit ? "Chọn kho hợp lệ và số lượng > 0" : "Xác nhận chuyển"
          }
        >
          Xác nhận chuyển
        </button>
      </ModalFooter>
    </Modal>
  );
};

export default StockTransferModal;
