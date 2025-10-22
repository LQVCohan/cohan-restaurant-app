import React from "react";
import Modal, { ModalFooter } from "@/components/common/Modal";
import { formatCurrency, formatDateTime } from "@/utils/formatters";
import "./SuccessModal.scss";

const SuccessModal = ({
  isOpen,
  onClose,
  mode = "booking",
  booking,
  order,
}) => {
  if (!isOpen) return null;

  const isBooking = mode === "booking";
  const title = isBooking ? "Đặt bàn thành công!" : "Đặt món thành công!";
  const sub = isBooking
    ? "Cảm ơn bạn đã đặt bàn. Hẹn gặp bạn tại nhà hàng!"
    : "Cảm ơn bạn đã đặt món. Chúng tôi sẽ xử lý đơn hàng ngay!";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      closeOnOverlayClick
      closeOnEscape
    >
      <div className="success-modal">
        <div className="success-icon">🎉</div>
        <p className="success-message">{sub}</p>

        {isBooking ? (
          <BookingConfirmation booking={booking} />
        ) : (
          <OrderConfirmation order={order} />
        )}

        <ModalFooter>
          <button
            className="action-btn action-btn--secondary"
            onClick={onClose}
          >
            Đóng
          </button>
        </ModalFooter>
      </div>
    </Modal>
  );
};

const BookingConfirmation = ({ booking }) => {
  if (!booking) return null;

  // dt có thể là Date hoặc string (từ formatDateTime)
  const dt = booking.timeFromISO
    ? new Date(booking.timeFromISO)
    : booking.date && booking.time
    ? formatDateTime(booking.date, booking.time)
    : "-";

  return (
    <div className="booking-confirmation">
      <h3>📋 Thông tin đặt bàn</h3>
      <div className="confirmation-details">
        <ConfirmationItem
          label="🏪 Nhà hàng"
          value={booking.restaurantName || "-"}
        />
        <ConfirmationItem
          label="👤 Người đặt"
          value={booking.fullName || booking.customerName || "-"}
        />
        <ConfirmationItem
          label="📞 Điện thoại"
          value={booking.customerPhone || "-"}
        />
        <ConfirmationItem
          label="✉️ Email"
          value={booking.customerEmail || "-"}
        />
        <ConfirmationItem label="🪑 Bàn" value={booking.tableCode || "-"} />
        <ConfirmationItem
          label="👥 Số người"
          value={`${booking.partySize || "-"} người`}
        />
        <ConfirmationItem
          label="📅 Thời gian"
          value={typeof dt === "string" ? dt : dt.toLocaleString("vi-VN")}
        />
        <ConfirmationItem
          label="🆔 Mã đặt bàn"
          value={`#${booking.id || "-"}`}
        />
        {booking.orderCode && (
          <ConfirmationItem label="🔖 Order code" value={booking.orderCode} />
        )}
      </div>
    </div>
  );
};

const OrderConfirmation = ({ order }) => {
  if (!order) return null;
  return (
    <div className="booking-confirmation order">
      <h3>🧾 Thông tin đơn hàng</h3>
      <div className="confirmation-details">
        <ConfirmationItem
          label="🆔 Mã đơn"
          value={order.orderCode || order.id || "-"}
        />
        <ConfirmationItem label="👤 Khách" value={order.customerName || "-"} />
        <ConfirmationItem label="📞 Điện thoại" value={order.phone || "-"} />
        <ConfirmationItem label="✉️ Email" value={order.email || "-"} />
        <ConfirmationItem
          label="💳 Thanh toán"
          value={order.paymentMethod || "-"}
        />
        <ConfirmationItem
          label="💰 Tổng tiền"
          value={formatCurrency(order.total || 0)}
          highlight
        />
      </div>
    </div>
  );
};

const ConfirmationItem = ({ label, value, highlight = false }) => (
  <div className={`summary-item ${highlight ? "summary-item--highlight" : ""}`}>
    <span className="summary-label">{label}:</span>
    <span className="summary-value">{value}</span>
  </div>
);

export default SuccessModal;
