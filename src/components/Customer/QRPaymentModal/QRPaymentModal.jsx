import React, { useEffect, useMemo, useState } from "react";
import Modal from "@/components/common/Modal";
import { gql, useLazyQuery, useMutation } from "@apollo/client";
import { usePaymentTimer } from "../../../hooks/usePaymentTimer";
import { useNotification } from "../../../hooks/useNotification";
import { formatCurrency } from "../../../utils/formatters";
import "./QRPaymentModal.scss";

const GET_RESERVATION_STATUS = gql`
  query ReservationStatus($id: ID, $orderCode: String) {
    reservation(id: $id, orderCode: $orderCode) {
      id
      orderCode
      status
      depositStatus
      depositTxnId
      depositAmount
      pendingPaymentExpiresAt
      paymentMethod
      paymentReference
      updatedAt
    }
  }
`;

const CREATE_RESERVATION_PAYMENT = gql`
  mutation CreateReservationPayment($input: CreateReservationPaymentInput!) {
    createReservationPayment(input: $input) {
      id
      provider
      reference
      amount
      status
      callbackStatus
      payUrl
      qrCodeUrl
      deeplink
      createdAt
      metadata
    }
  }
`;

const PROVIDER_OPTIONS = [
  { provider: "momo", label: "MoMo" },
  { provider: "vnpay", label: "VNPAY" },
];

const QRPaymentModal = ({ isOpen, onClose, booking, onPaymentConfirmed }) => {
  const depositAmount = Number(booking?.depositAmount ?? booking?.deposit ?? 0);

  const [provider, setProvider] = useState("momo");
  const [activePayment, setActivePayment] = useState(null);
  const [polling, setPolling] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  const { timeLeft, formattedTime, startTimer, stopTimer, resetTimer } =
    usePaymentTimer(600);
  const { showNotification } = useNotification();

  const [fetchStatus] = useLazyQuery(GET_RESERVATION_STATUS, {
    fetchPolicy: "network-only",
  });
  const [createReservationPayment, { loading: creating }] = useMutation(
    CREATE_RESERVATION_PAYMENT,
  );

  useEffect(() => {
    if (!isOpen) return;
    resetTimer(600);
    startTimer();
    setActivePayment(null);
    setProvider("momo");
    return () => stopTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, booking?.id]);

  useEffect(() => {
    if (!isOpen || !booking?.id || !polling) return;
    const id = setInterval(async () => {
      try {
        const { data } = await fetchStatus({ variables: { id: booking.id } });
        const reservation = data?.reservation;
        if (!reservation) return;
        if (reservation.depositStatus === "paid") {
          setPolling(false);
          stopTimer();
          showNotification("Thanh toán thành công.", "success");
          onPaymentConfirmed?.(reservation);
        } else if (["failed", "cancelled"].includes(reservation.depositStatus)) {
          setPolling(false);
          showNotification("Giao dịch không thành công hoặc đã được hủy.", "error");
        }
      } catch {
        // Lỗi kiểm tra tạm thời sẽ được thử lại ở nhịp tiếp theo.
      }
    }, 3000);

    return () => clearInterval(id);
  }, [booking?.id, fetchStatus, isOpen, onPaymentConfirmed, polling, showNotification, stopTimer]);

  useEffect(() => {
    if (!isOpen) return;
    if (timeLeft === 0) {
      setPolling(false);
      showNotification(
        "Đã hết thời gian thanh toán. Lịch giữ chỗ tạm thời đã kết thúc.",
        "error",
      );
      onClose?.();
    }
  }, [timeLeft, isOpen, onClose, showNotification]);

  const timerColor = useMemo(() => {
    if (timeLeft <= 60) return "danger";
    if (timeLeft <= 180) return "warning";
    return "normal";
  }, [timeLeft]);

  const createPayment = async () => {
    if (!booking?.id) return;
    try {
      const { data } = await createReservationPayment({
        variables: {
          input: {
            reservationId: booking.id,
            provider,
          },
        },
      });
      const payment = data?.createReservationPayment;
      if (!payment) throw new Error("PAYMENT_CREATE_FAILED");

      setActivePayment(payment);
      setPolling(true);
      if (payment.payUrl) {
        window.open(payment.payUrl, "_blank", "noopener,noreferrer");
      }
      showNotification(
        `Đã mở bước thanh toán bằng ${provider.toUpperCase()}.`,
        "success",
      );
    } catch {
      showNotification(
        "Chưa thể tạo giao dịch. Vui lòng thử lại sau ít phút.",
        "error",
      );
    }
  };

  const handleManualCheck = async () => {
    setIsChecking(true);
    try {
      const { data } = await fetchStatus({ variables: { id: booking?.id } });
      const reservation = data?.reservation;
      if (!reservation) throw new Error("RESERVATION_NOT_FOUND");
      if (reservation.depositStatus === "paid") {
        stopTimer();
        onPaymentConfirmed?.(reservation);
      } else {
        showNotification(
          "Hệ thống chưa ghi nhận thanh toán. Vui lòng chờ một chút rồi kiểm tra lại.",
          "warning",
        );
      }
    } catch {
      showNotification(
        "Chưa thể kiểm tra thanh toán lúc này. Vui lòng thử lại.",
        "error",
      );
    } finally {
      setIsChecking(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Thanh toán đặt cọc"
      size="sm"
      closeOnOverlayClick
      closeOnEscape
    >
      <div className="qrpay">
        <div className="qrpay__header">
          <div className="qrpay__timer">
            <span>Thời gian còn lại: </span>
            <span className={`timer-countdown timer-countdown--${timerColor}`}>
              {formattedTime}
            </span>
          </div>
        </div>

        <div className="qrpay__body">
          <div className="provider-picker" aria-label="Chọn phương thức thanh toán">
            {PROVIDER_OPTIONS.map((item) => (
              <button
                key={item.provider}
                className={`provider-btn ${provider === item.provider ? "active" : ""}`}
                onClick={() => setProvider(item.provider)}
                type="button"
                disabled={creating}
                aria-pressed={provider === item.provider}
              >
                {item.label}
              </button>
            ))}
          </div>

          <PaymentInfo booking={booking} amount={depositAmount} activePayment={activePayment} />
        </div>

        <Modal.Footer>
          <button className="btn btn--primary" onClick={createPayment} disabled={creating}>
            {creating ? "Đang chuẩn bị..." : `Thanh toán bằng ${provider.toUpperCase()}`}
          </button>
          <button className="btn btn--success" onClick={handleManualCheck} disabled={isChecking}>
            {isChecking ? "Đang kiểm tra..." : "Kiểm tra thanh toán"}
          </button>
          <button className="btn btn--secondary" onClick={onClose}>
            Đóng
          </button>
        </Modal.Footer>
      </div>
    </Modal>
  );
};

const PaymentInfo = ({ booking, amount, activePayment }) => {
  const [expandedOrders, setExpandedOrders] = useState(false);
  const linkedOrders = Array.isArray(booking?.linkedOrders)
    ? booking.linkedOrders.filter(Boolean)
    : booking?.linkedOrder
      ? [booking.linkedOrder]
      : [];

  return (
    <div className="payment-info">
      <div className="payment-amount">
        <span className="amount-label">Số tiền cần thanh toán:</span>
        <span className="amount-value">{formatCurrency(amount)}</span>
      </div>

      <div className="payment-details">
        <PaymentDetail
          label="Mã đặt bàn"
          value={`#${booking?.orderCode || booking?.id || "—"}`}
        />
        {linkedOrders.length > 0 && (
          <PaymentDetail
            label="Mã món đi kèm"
            value={linkedOrders.map((order) => `#${order.orderCode || order.id}`).join(", ")}
          />
        )}
        <PaymentDetail
          label="Trạng thái"
          value={activePayment ? "Đang chờ xác nhận" : "Chưa tạo giao dịch"}
        />
        <PaymentDetail
          label="Phương thức"
          value={activePayment?.provider?.toUpperCase() || "Chưa chọn"}
        />
        {activePayment?.reference ? (
          <PaymentDetail label="Mã giao dịch" value={activePayment.reference} />
        ) : null}
      </div>

      {linkedOrders.length > 0 && (
        <div className="payment-details" style={{ marginTop: 10 }}>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => setExpandedOrders((previous) => !previous)}
          >
            {expandedOrders ? "Ẩn danh sách món" : "Xem danh sách món"}
          </button>
          {expandedOrders && linkedOrders.map((order) => (
            <div key={order.id || order.orderCode} className="detail-item" style={{ display: "block" }}>
              <strong>Mã món #{order.orderCode || order.id}</strong>
              <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                {(order.items || []).map((item) => (
                  <li key={item._id || item.name}>
                    {item.name} × {item.quantity || 1}
                    {Number(item.lineSubtotal || item.unitPrice || item.basePrice || 0) > 0
                      ? ` · ${formatCurrency(item.lineSubtotal || Number(item.unitPrice || item.basePrice || 0) * Number(item.quantity || 1))}`
                      : ""}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {booking?.linkedOrderError && (
        <div className="payment-warning">
          <p>Món đi kèm chưa được đồng bộ đầy đủ. Vui lòng liên hệ nhà hàng nếu cần hỗ trợ.</p>
        </div>
      )}

      <div className="payment-warning">
        <p>
          Sau khi thanh toán, hệ thống sẽ tự kiểm tra và xác nhận đặt bàn.
        </p>
        <p>Bạn cũng có thể bấm “Kiểm tra thanh toán” nếu đã hoàn tất trên MoMo hoặc VNPAY.</p>
      </div>
    </div>
  );
};

const PaymentDetail = ({ label, value }) => (
  <div className="detail-item">
    <span>{label}:</span>
    <span>{value}</span>
  </div>
);

export default QRPaymentModal;
