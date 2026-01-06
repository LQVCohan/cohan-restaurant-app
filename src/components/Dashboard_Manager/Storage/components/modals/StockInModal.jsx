import React, { useEffect, useState } from "react";
import Modal, { ModalFooter } from "../../../../common/Modal";
import "./StockInModal.scss";

const StockInModal = ({ isOpen, onClose, onConfirm, supply }) => {
  const [qty, setQty] = useState("");
  const [costPerBaseUnit, setCostPerBaseUnit] = useState("");
  const [lot, setLot] = useState("");
  const [expiry, setExpiry] = useState("");
  const [supplier, setSupplier] = useState("");
  const [reason, setReason] = useState("");

  // Reset form khi mở modal
  useEffect(() => {
    if (isOpen) {
      setQty("");
      setCostPerBaseUnit("");
      setLot("");
      setExpiry("");
      setSupplier("");
      setReason("");
    }
  }, [isOpen]);

  // Logic validate
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
      title="📦 Nhập Kho Hàng Hoá"
      size="md"
    >
      <div className="si-container">
        {/* Header Info Block */}
        <div className="si-product-info">
          <div className="si-pi-label">Đang nhập kho cho:</div>
          <div className="si-pi-name">{supply?.name || "Sản phẩm chưa rõ"}</div>
          <div className="si-pi-meta">
            Đơn vị tính: <strong>{supply?.unit || "unit"}</strong>
          </div>
        </div>

        {/* --- Block 1: Định lượng (Quan trọng nhất) --- */}
        <div className="si-grid-2">
          <label className="si-field">
            <span className="si-label">
              Số lượng nhập <b className="req">*</b>
            </span>
            <input
              className="si-input si-input-lg"
              type="number"
              min="0.00001"
              step="any"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="0.0"
              autoFocus
            />
          </label>

          <label className="si-field">
            <span className="si-label">Giá nhập / đơn vị</span>
            <input
              className="si-input"
              type="number"
              min="0"
              step="1"
              value={costPerBaseUnit}
              onChange={(e) => setCostPerBaseUnit(e.target.value)}
              placeholder="VNĐ (Tuỳ chọn)"
            />
          </label>
        </div>

        {/* --- Block 2: Quản lý Lô/Hạn (FIFO) --- */}
        <div className="si-section-divider">
          <span>Thông tin lô hàng (FIFO)</span>
        </div>

        <div className="si-grid-2">
          <label className="si-field">
            <span className="si-label">Mã Lô (Batch/Lot)</span>
            <input
              className="si-input"
              value={lot}
              onChange={(e) => setLot(e.target.value)}
              placeholder="VD: L01-OCT25"
            />
          </label>

          <label className="si-field">
            <span className="si-label">Hạn sử dụng</span>
            <input
              className="si-input"
              type="date"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
            />
          </label>
        </div>

        {/* --- Block 3: Metadata --- */}
        <div className="si-grid-2">
          <label className="si-field">
            <span className="si-label">Nhà cung cấp</span>
            <input
              className="si-input"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="Tên NCC..."
            />
          </label>

          <label className="si-field">
            <span className="si-label">Lý do / Ghi chú</span>
            <input
              className="si-input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Nhập hàng mới..."
            />
          </label>
        </div>
      </div>

      <ModalFooter>
        <button className="si-btn-cancel" onClick={onClose}>
          Huỷ bỏ
        </button>
        <button
          className="si-btn-confirm"
          onClick={confirm}
          disabled={!canSubmit}
        >
          Xác nhận nhập
        </button>
      </ModalFooter>
    </Modal>
  );
};

export default StockInModal;
