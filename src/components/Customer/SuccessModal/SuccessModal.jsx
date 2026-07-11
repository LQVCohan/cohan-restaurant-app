import React from "react";
import {
  Armchair,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Hash,
  Mail,
  Phone,
  ReceiptText,
  Store,
  UserRound,
  UsersRound,
  UtensilsCrossed,
  WalletCards,
} from "lucide-react";
import Modal from "@/components/common/Modal";
import { formatCurrency, formatDateTime } from "@/utils/formatters";
import "./SuccessModal.scss";

const PAYMENT_METHOD_LABELS = {
  cash: "Tiền mặt",
  momo: "MoMo",
  vnpay: "VNPAY",
  wallet: "Ví nội bộ",
  transfer: "Chuyển khoản",
  card: "Thanh toán trực tuyến",
};

const formatBookingTime = (booking = {}) => {
  const rawValue = booking.timeTo || booking.timeFromISO;
  if (rawValue) {
    const parsed = new Date(rawValue);
    if (!Number.isNaN(parsed.getTime())) return parsed.toLocaleString("vi-VN");
  }

  if (booking.date && booking.time) {
    const formatted = formatDateTime(booking.date, booking.time);
    return formatted instanceof Date
      ? formatted.toLocaleString("vi-VN")
      : formatted || "-";
  }

  return "-";
};

const getPaymentMethodLabel = (value) =>
  PAYMENT_METHOD_LABELS[String(value || "").toLowerCase()] || value || "Chưa cập nhật";

const SuccessModal = ({
  isOpen,
  onClose,
  mode,
  type,
  booking,
  order,
}) => {
  if (!isOpen) return null;

  const resolvedMode = mode || (type === "order" ? "order" : "booking");
  const isBooking = resolvedMode === "booking";
  const hasLinkedMenu = Boolean(
    booking?.linkedCartItems?.length ||
      booking?.linkedOrders?.length ||
      Number(booking?.linkedMenuSubtotal || 0) > 0,
  );
  const title = isBooking
    ? hasLinkedMenu
      ? "Đặt bàn và món thành công"
      : "Đặt bàn thành công"
    : "Đặt món thành công";
  const message = isBooking
    ? hasLinkedMenu
      ? "Nhà hàng đã ghi nhận bàn, món đặt trước và khoản cọc của bạn."
      : "Nhà hàng đã ghi nhận lịch đặt bàn và sẽ chuẩn bị trước khi bạn đến."
    : "Đơn hàng đã được ghi nhận và chuyển tới nhà hàng xử lý.";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="md"
      closeOnOverlayClick
      closeOnEscape
    >
      <div className="success-modal">
        <header className="success-modal__hero">
          <span className="success-modal__icon" aria-hidden="true">
            <CheckCircle2 size={34} strokeWidth={2.2} />
          </span>
          <div>
            <span className="success-modal__eyebrow">Đã xác nhận</span>
            <p className="success-modal__message">{message}</p>
          </div>
        </header>

        {isBooking ? (
          <BookingConfirmation booking={booking} />
        ) : (
          <OrderConfirmation order={order} />
        )}

        <Modal.Footer>
          <button type="button" className="success-modal__done" onClick={onClose}>
            Hoàn tất
          </button>
        </Modal.Footer>
      </div>
    </Modal>
  );
};

const BookingConfirmation = ({ booking }) => {
  if (!booking) return null;

  const linkedItems = Array.isArray(booking.linkedCartItems)
    ? booking.linkedCartItems
    : [];
  const linkedOrders = Array.isArray(booking.linkedOrders)
    ? booking.linkedOrders
    : [];
  const linkedItemCount = linkedItems.reduce(
    (sum, item) => sum + Number(item?.quantity || 1),
    0,
  );
  const linkedOrderCodes = linkedOrders
    .map((item) => item?.orderCode)
    .filter(Boolean);
  const hasLinkedMenu = Boolean(
    linkedItems.length ||
      linkedOrders.length ||
      Number(booking.linkedMenuSubtotal || 0) > 0,
  );
  const confirmationCode = booking.orderCode || booking.id || "-";
  const tableCode =
    booking.tableCode || linkedOrders[0]?.tableCode || booking.tableId || "-";
  const contactName = booking.fullName || booking.customerName || "-";
  const depositAmount = Number(booking.depositAmount || 0);

  return (
    <section className="success-modal__confirmation" aria-label="Thông tin đặt bàn">
      <div className="success-modal__code-block">
        <span>Mã xác nhận</span>
        <strong>{confirmationCode}</strong>
        <small>Giữ mã này để tra cứu hoặc làm việc với nhà hàng.</small>
      </div>

      <div className="success-modal__detail-grid">
        <ConfirmationItem icon={Store} label="Nhà hàng" value={booking.restaurantName || "-"} />
        <ConfirmationItem icon={Armchair} label="Bàn" value={tableCode} />
        <ConfirmationItem icon={CalendarClock} label="Thời gian" value={formatBookingTime(booking)} />
        <ConfirmationItem
          icon={UsersRound}
          label="Số khách"
          value={`${booking.partySize || "-"} người`}
        />
      </div>

      <div className="success-modal__contact">
        <ConfirmationItem icon={UserRound} label="Người đặt" value={contactName} compact />
        {booking.customerPhone ? (
          <ConfirmationItem icon={Phone} label="Điện thoại" value={booking.customerPhone} compact />
        ) : null}
        {booking.customerEmail ? (
          <ConfirmationItem icon={Mail} label="Email" value={booking.customerEmail} compact />
        ) : null}
      </div>

      {hasLinkedMenu ? (
        <div className="success-modal__addon">
          <div className="success-modal__addon-heading">
            <span className="success-modal__addon-icon" aria-hidden="true">
              <UtensilsCrossed size={20} />
            </span>
            <div>
              <strong>Món đặt trước đã được ghi nhận</strong>
              <small>
                {linkedItemCount > 0 ? `${linkedItemCount} món` : "Đơn món đi kèm"}
                {Number(booking.linkedMenuSubtotal || 0) > 0
                  ? ` · ${formatCurrency(booking.linkedMenuSubtotal)}`
                  : ""}
              </small>
            </div>
          </div>
          {linkedOrderCodes.length ? (
            <div className="success-modal__order-codes" aria-label="Mã đơn món đi kèm">
              {linkedOrderCodes.map((code) => (
                <span key={code}>
                  <ReceiptText size={14} aria-hidden="true" />
                  {code}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {depositAmount > 0 ? (
        <div className="success-modal__payment-summary">
          <span>
            <CircleDollarSign size={19} aria-hidden="true" />
            Tiền cọc đã ghi nhận
          </span>
          <strong>{formatCurrency(depositAmount)}</strong>
        </div>
      ) : null}
    </section>
  );
};

const OrderConfirmation = ({ order }) => {
  if (!order) return null;

  const confirmationCode = order.orderCode || order.id || "-";
  const total = Number(order.total || order?.totals?.grandTotal || 0);

  return (
    <section className="success-modal__confirmation" aria-label="Thông tin đơn hàng">
      <div className="success-modal__code-block">
        <span>Mã đơn hàng</span>
        <strong>{confirmationCode}</strong>
        <small>Nhà hàng dùng mã này để xác nhận và hỗ trợ đơn của bạn.</small>
      </div>

      <div className="success-modal__detail-grid">
        <ConfirmationItem icon={UserRound} label="Khách hàng" value={order.customerName || "-"} />
        <ConfirmationItem icon={Phone} label="Điện thoại" value={order.phone || "-"} />
        <ConfirmationItem
          icon={WalletCards}
          label="Thanh toán"
          value={getPaymentMethodLabel(order.paymentMethod)}
        />
        <ConfirmationItem icon={Hash} label="Trạng thái" value={order.status || "Đã ghi nhận"} />
      </div>

      {order.email ? (
        <div className="success-modal__contact">
          <ConfirmationItem icon={Mail} label="Email" value={order.email} compact />
        </div>
      ) : null}

      <div className="success-modal__payment-summary">
        <span>
          <CircleDollarSign size={19} aria-hidden="true" />
          Tổng tiền
        </span>
        <strong>{formatCurrency(total)}</strong>
      </div>
    </section>
  );
};

const ConfirmationItem = ({ icon: Icon, label, value, compact = false }) => (
  <div className={`success-modal__detail ${compact ? "is-compact" : ""}`.trim()}>
    <span className="success-modal__detail-icon" aria-hidden="true">
      <Icon size={18} strokeWidth={1.9} />
    </span>
    <span className="success-modal__detail-copy">
      <small>{label}</small>
      <strong>{value}</strong>
    </span>
  </div>
);

export default SuccessModal;
