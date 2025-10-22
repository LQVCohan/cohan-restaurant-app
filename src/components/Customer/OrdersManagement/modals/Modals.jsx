import React from "react";
import "./Modals.scss";

/* ===== Base Modal ===== */
export const Modal = ({ isOpen, title, children, footer, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay-orders active" onClick={onClose}>
      <div
        className="modal-container-orders"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header-orders">
          <h3 className="modal-title-orders">{title}</h3>
          <button
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Đóng"
          >
            ✖
          </button>
        </header>

        <div className="modal-content-orders">{children}</div>

        {footer && <div className="modal-footer-orders">{footer}</div>}
      </div>
    </div>
  );
};

/* ===== Reservation Detail Layout ===== */
export const ReservationDetails = ({ order }) => {
  const time = order?.timeFrom
    ? new Date(order.timeFrom).toLocaleString("vi-VN")
    : "—";
  return (
    <div className="reservation-detail">
      <div className="detail-header">
        <div className="detail-icon">🍽️</div>
        <div className="detail-info">
          <h4>{order?.restaurantName}</h4>
          <p>Mã đơn: {order?.id}</p>
        </div>
        <span className={`status-tag ${order?.status}`}>{order?.status}</span>
      </div>

      <div className="detail-grid">
        <div className="detail-box">
          <span className="label">Số người</span>
          <strong className="value">{order?.partySize ?? "—"}</strong>
        </div>
        <div className="detail-box">
          <span className="label">Tiền cọc</span>
          <strong className="value">
            {order?.depositAmount
              ? order.depositAmount.toLocaleString("vi-VN") + "đ"
              : "—"}
          </strong>
        </div>
        <div className="detail-box">
          <span className="label">Giờ bắt đầu</span>
          <strong className="value">{time}</strong>
        </div>
      </div>

      <div className="detail-section">
        <h5>Thông tin khách hàng</h5>
        <div className="info-pair">
          <span>📞 SĐT:</span> <span>{order?.phone || "—"}</span>
        </div>
        <div className="info-pair">
          <span>📧 Email:</span> <span>{order?.email || "—"}</span>
        </div>
        <div className="info-pair">
          <span>📝 Ghi chú:</span>{" "}
          <span>{order?.note || "Không có ghi chú"}</span>
        </div>
      </div>
    </div>
  );
};
