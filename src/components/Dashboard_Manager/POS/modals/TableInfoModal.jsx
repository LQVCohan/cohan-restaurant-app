import React from "react";
import Modal from "../../../common/Modal";
import Button from "../../../common/Button";
import "./TableInfoModal.scss";

export default function TableInfoModal({ open, onClose, table, onCall }) {
  if (!table) return null;

  const {
    code,
    capacity,
    status,
    customerName,
    phone,
    note,
    reservedAt,
    checkinAt,
  } = table;

  const getStatusText = (s) => {
    switch (s) {
      case "available":
        return "Còn trống";
      case "reserved":
        return "Đã đặt";
      case "occupied":
        return "Đang sử dụng";
      default:
        return "Không rõ";
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Thông tin bàn ${code}`}
      size="md"
      footer={
        <div className="modal-actions">
          {phone ? (
            <Button onClick={() => onCall?.(phone)}>Gọi {phone}</Button>
          ) : null}
          <Button variant="secondary" onClick={onClose}>
            Đóng
          </Button>
        </div>
      }
    >
      <div className="table-info-modal">
        <div className="table-status-section">
          <div
            className={`status-indicator status-indicator--${status || "gray"}`}
          />
          <div className="status-text">{getStatusText(status)}</div>
          <div className="capacity-info">Sức chứa: {capacity} chỗ</div>
        </div>

        <div className="customer-section">
          <h4>Khách hàng</h4>
          <div className="customer-details">
            <div className="detail-row">
              <div className="detail-label">Tên</div>
              <div className="detail-value">{customerName || "-"}</div>
            </div>
            <div className="detail-row">
              <div className="detail-label">SĐT</div>
              <div className="detail-value">{phone || "-"}</div>
            </div>
          </div>
        </div>

        <div className="time-section">
          <h4>Thời gian</h4>
          <div className="detail-row">
            <div className="detail-label">Check-in</div>
            <div className="detail-value">
              {checkinAt ? new Date(checkinAt).toLocaleString("vi-VN") : "-"}
            </div>
          </div>
          <div className="detail-row">
            <div className="detail-label">Giữ chỗ</div>
            <div className="detail-value">
              {reservedAt ? new Date(reservedAt).toLocaleString("vi-VN") : "-"}
            </div>
          </div>
        </div>

        {note ? (
          <div className="note-section">
            <h4>Ghi chú</h4>
            <div className="note-content">{note}</div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
