import React, { useEffect, useState, useMemo } from "react";
import Modal from "@/components/common/Modal";
import { gql } from "@apollo/client";
import { useLazyQuery, useMutation } from "@apollo/client/react";
import { usePaymentTimer } from "../../../hooks/usePaymentTimer";
import { useNotification } from "../../../hooks/useNotification";
import { formatCurrency } from "../../../utils/formatters";
import "./QRPaymentModal.scss";

/* ───────────────── GraphQL ──────────────── */
const SUBMIT_RESERVATION_PAYMENT = gql`
  mutation SubmitReservationPayment($input: SubmitReservationPaymentInput!) {
    submitReservationPayment(input: $input) {
      id
      status
      depositStatus
      depositTxnId
      paymentMethod
      paymentReference
      updatedAt
    }
  }
`;

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
      updatedAt
    }
  }
`;

/**
 * Props:
 * - isOpen: boolean
 * - onClose: () => void
 * - booking: {
 *     id, orderCode?, reservationId?, deposit,
 *   }
 * - onPaymentConfirmed: (reservation) => void
 */
const QRPaymentModal = ({ isOpen, onClose, booking, onPaymentConfirmed }) => {
  const depositAmount = Number(booking?.deposit) || 0;

  const orderCode = booking?.orderCode || null;

  const { timeLeft, formattedTime, startTimer, stopTimer, resetTimer } =
    usePaymentTimer(600);
  const { showNotification } = useNotification();
  const [isChecking, setIsChecking] = useState(false);

  const [fetchStatus] = useLazyQuery(GET_RESERVATION_STATUS, {
    fetchPolicy: "network-only",
  });

  const [submitReservationPayment] = useMutation(SUBMIT_RESERVATION_PAYMENT);



  useEffect(() => {
    if (isOpen && booking) {
      resetTimer(600);
      startTimer();
    } else {
      stopTimer();
    }
    return () => stopTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, booking]);

  useEffect(() => {
    if (!isOpen) return;
    if (timeLeft === 0) {
      submitReservationPayment({
        variables: {
          input: {
            reservationId: booking?.id,
            method: "transfer",
            paymentStatus: "failed",
            externalRef: booking?.orderCode || null,
          },
        },
      }).catch(() => {});
      showNotification(
        "⏰ Hết thời gian thanh toán! Đặt cọc đã bị hủy và bàn được trả về trạng thái trống.",
        "error"
      );
      onClose?.();
    }
  }, [timeLeft, isOpen, onClose, showNotification]);

  const timerColor = useMemo(() => {
    if (timeLeft <= 60) return "danger";
    if (timeLeft <= 180) return "warning";
    return "normal";
  }, [timeLeft]);

  const handleConfirmPaid = async () => {
    if (!orderCode && !booking?.id) {
      showNotification("Không có thông tin mã đặt bàn để kiểm tra.", "error");
      return;
    }

    setIsChecking(true);
    try {
      const variables = { orderCode };

      await submitReservationPayment({
        variables: {
          input: {
            reservationId: booking?.id,
            method: "transfer",
            paymentStatus: "pending",
            externalRef: booking?.orderCode || null,
          },
        },
      });

      const { data } = await fetchStatus({ variables });
      const rs = data?.reservation;
      const isPaid = rs?.depositStatus === "paid";
      const isPending = rs?.depositStatus === "pending";
      const isFailed = ["failed", "cancelled", "refunded"].includes(rs?.depositStatus);
      if (!rs) {
        showNotification("Không tìm thấy đơn đặt bàn để kiểm tra.", "error");
        return;
      }
      console.log("status:", isPaid);
      console.log("status:", isPending);
      console.log("status:", isFailed);
      if (isPaid) {
        stopTimer();
        showNotification("✅ Thanh toán thành công!", "success");
        onPaymentConfirmed?.(rs);
      } else if (isPending) {
        showNotification(
          "Thanh toán chưa được ghi nhận. Vui lòng chờ thêm vài phút.",
          "warning"
        );
      } else if (isFailed) {
        showNotification("Thanh toán thất bại hoặc bị hủy.", "error");
      } else {
        showNotification(
          "Trạng thái chưa xác định. Vui lòng thử lại sau.",
          "info"
        );
      }
    } catch (err) {
      showNotification(
        err?.message || "Không thể kiểm tra trạng thái thanh toán.",
        "error"
      );
    } finally {
      setIsChecking(false);
    }
  };

  const handleCancel = () => {
    if (
      window.confirm(
        "Bạn muốn đóng màn hình thanh toán? Bạn vẫn có thể thanh toán trong vòng 10 phút kể từ khi đặt bàn."
      )
    ) {
      stopTimer();
      onClose?.();
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title="💳 Thanh toán đặt cọc"
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
          <QRCodeSection />
          <PaymentInfo booking={booking} amount={depositAmount} />
        </div>

        <Modal.Footer>
          <button
            className="btn btn--success"
            onClick={handleConfirmPaid}
            disabled={isChecking}
          >
            {isChecking ? (
              <>
                <span className="loading-spinner" /> Kiểm tra...
              </>
            ) : (
              "✅ Tôi đã chuyển khoản"
            )}
          </button>
          <button className="btn btn--secondary" onClick={handleCancel}>
            Đóng
          </button>
        </Modal.Footer>
      </div>
    </Modal>
  );
};

/* ───────────────── Subcomponents ──────────────── */

const QRCodeSection = () => (
  <div className="qr-code-container">
    <div className="qr-code">
      <QRPlaceholder />
    </div>
    <p className="qr-instruction">Quét mã QR để thanh toán</p>
  </div>
);

const QRPlaceholder = () => (
  <div className="qr-placeholder">
    <div className="qr-squares">
      {Array.from({ length: 9 }, (_, i) => (
        <div key={i} className="qr-square" />
      ))}
    </div>
  </div>
);

const PaymentInfo = ({ booking, amount }) => (
  <div className="payment-info">
    <div className="payment-amount">
      <span className="amount-label">Số tiền cần thanh toán:</span>
      <span className="amount-value">{formatCurrency(amount)}</span>
    </div>

    <div className="payment-details">
      <PaymentDetail
        label="Mã đặt bàn (Order Code)"
        value={`#${booking?.orderCode || booking?.id || "—"}`}
      />
      <PaymentDetail label="Ngân hàng" value="Vietcombank" />
      <PaymentDetail label="Số tài khoản" value="1234567890" />
      <PaymentDetail label="Chủ tài khoản" value="Golden Dragon Restaurant" />
    </div>

    <PaymentWarning />
  </div>
);

const PaymentDetail = ({ label, value }) => (
  <div className="detail-item">
    <span>{label}:</span>
    <span>{value}</span>
  </div>
);

const PaymentWarning = () => (
  <div className="payment-warning">
    <p>
      ⚠️ <strong>Lưu ý:</strong> Vui lòng chuyển khoản trong vòng{" "}
      <strong>10 phút</strong>.
    </p>
    <p>Nếu không thanh toán đúng hạn, đặt cọc sẽ tự động hủy.</p>
  </div>
);

export default QRPaymentModal;
