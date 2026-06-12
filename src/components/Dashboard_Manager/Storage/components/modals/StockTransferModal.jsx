import React, { useEffect, useState, useMemo } from "react";
import Modal from "../../../../common/Modal";
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
      title="Điều chuyển kho"
      size="md"
      className="storage-modal-shell storage-modal-transfer"
    >
      <div className="st-container">
        {/* Header Info */}
        <div className="st-header-info">
          <span className="st-hi-label">Vật phẩm:</span>
          <span className="st-hi-name">{supply?.name || "..."}</span>
        </div>

        {/* Transfer Flow Zone */}
        <div className="st-transfer-zone">
          <div className="st-tz-box">
            <label className="st-label">Kho Xuất (Nguồn)</label>
            <select
              className="st-select"
              value={fromWarehouseId}
              onChange={(e) => setFromWarehouseId(e.target.value)}
            >
              <option value="">-- Chọn kho --</option>
              {warehouses.map((w) => (
                <option
                  key={w.id}
                  value={w.id}
                  disabled={w.id === toWarehouseId}
                >
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          <div className="st-tz-arrow">
            <i className="arrow-icon">➔</i>
          </div>

          <div className="st-tz-box">
            <label className="st-label">Kho Nhập (Đích)</label>
            <select
              className="st-select"
              value={toWarehouseId}
              onChange={(e) => setToWarehouseId(e.target.value)}
            >
              <option value="">-- Chọn kho --</option>
              {warehouses.map((w) => (
                <option
                  key={w.id}
                  value={w.id}
                  disabled={w.id === fromWarehouseId}
                >
                  {w.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quantity Input */}
        <div className="st-qty-block">
          <label className="st-label-center">
            Số lượng chuyển ({supply?.unit})
          </label>
          <input
            className="st-input-qty"
            type="number"
            min="0.0001"
            step="any"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="0"
          />
        </div>

        {/* Reason Input */}
        <div className="st-reason-block">
          <label className="st-label">Lý do / Ghi chú</label>
          <input
            className="st-input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="VD: Cân bằng kho, chuyển hàng gấp..."
          />
        </div>

        {/* FIFO Note */}
        <div className="st-fifo-note">
          ⚠️ <strong>Lưu ý:</strong> Hệ thống sẽ tự động trừ hàng từ các lô cũ
          nhất (FIFO) tại kho xuất.
        </div>
      </div>

      <Modal.Footer>
        <button className="st-btn-cancel" onClick={onClose}>
          Huỷ bỏ
        </button>
        <button
          className="st-btn-confirm"
          onClick={confirm}
          disabled={!canSubmit}
        >
          Xác nhận chuyển
        </button>
      </Modal.Footer>
    </Modal>
  );
};

export default StockTransferModal;
