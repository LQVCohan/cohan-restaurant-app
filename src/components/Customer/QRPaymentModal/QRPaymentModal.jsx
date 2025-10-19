import React, { useEffect, useState, useMemo } from "react";
import Modal, { ModalFooter } from "@/components/common/Modal";
import { usePaymentTimer } from "../../../hooks/usePaymentTimer";
import { useNotification } from "../../../hooks/useNotification";
import { formatCurrency } from "../../../utils/formatters";
import "./QRPaymentModal.scss";

/**
 * Props:
 * - isOpen: boolean
 * - onClose: () => void
 * - booking: {
 *     id, deposit, reservationId?, orderCode?, customerName?, ...
 *   }
 * - onPaymentConfirmed: (booking) => void
 * - onCheckPayment?: (booking) => Promise<"paid"|"pending"|"failed">
 *     // TUỲ CHỌN: nếu bạn có API check realtime trạng thái thanh toán
 */
const QRPaymentModal = ({
  isOpen,
  onClose,
  booking,
  onPaymentConfirmed,
  onCheckPayment,
}) => {
  const depositAmount = Number(booking?.deposit) || 0;
  const { timeLeft, formattedTime, startTimer, stopTimer, resetTimer } =
    usePaymentTimer(600);
  const { showNotification } = useNotification();
  const [isChecking, setIsChecking] = useState(false);

  // Bắt đầu/ dừng timer theo open state
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

  // Hết giờ thì đóng & thông báo
  useEffect(() => {
    if (!isOpen) return;
    if (timeLeft === 0) {
      showNotification("Hết thời gian thanh toán! Đơn cọc sẽ bị hủy.", "error");
      onClose?.();
    }
  }, [timeLeft, isOpen, onClose, showNotification]);

  const timerColor = useMemo(() => {
    if (timeLeft <= 60) return "danger";
    if (timeLeft <= 180) return "warning";
    return "normal";
  }, [timeLeft]);

  // Nút “✅ Tôi đã chuyển khoản” —> chỉ CHECK trạng thái, không auto pass
  const handleConfirmPaid = async () => {
    if (!onCheckPayment) {
      showNotification(
        "Đang kiểm tra thanh toán… Vui lòng tích hợp onCheckPayment để kiểm tra trên server.",
        "info"
      );
      return;
    }

    setIsChecking(true);
    try {
      const status = await onCheckPayment(booking);
      if (status === "paid") {
        stopTimer();
        showNotification("Thanh toán thành công!", "success");
        onPaymentConfirmed?.(booking);
      } else if (status === "pending") {
        showNotification(
          "Thanh toán chưa ghi nhận. Vui lòng chờ hoặc thử lại sau ít phút.",
          "warning"
        );
      } else {
        showNotification("Thanh toán thất bại. Vui lòng thử lại!", "error");
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
        "Bạn muốn đóng màn hình thanh toán? Bạn vẫn có thể thanh toán ở trang quản lý đặt bàn trong thời hạn 10 phút."
      )
    ) {
      stopTimer();
      onClose?.();
    }
  };

  // Dùng Modal base — không cần tự overlay nữa
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
        {/* Header ngắn với timer */}
        <div className="qrpay__header">
          <div className="qrpay__timer">
            <span className="timer-text">Thời gian còn lại: </span>
            <span className={`timer-countdown timer-countdown--${timerColor}`}>
              {formattedTime}
            </span>
          </div>
        </div>

        <div className="qrpay__body">
          <QRCodeSection />

          <PaymentInfo booking={booking} amount={depositAmount} />
        </div>

        <ModalFooter>
          <button
            className="btn btn--success"
            onClick={handleConfirmPaid}
            disabled={isChecking}
            title="Chỉ xác nhận sau khi bạn đã chuyển khoản. Hệ thống sẽ kiểm tra trạng thái trên server."
          >
            {isChecking ? (
              <>
                <span className="loading-spinner" />
                Đang kiểm tra...
              </>
            ) : (
              "✅ Tôi đã chuyển khoản"
            )}
          </button>
          <button className="btn btn--secondary" onClick={handleCancel}>
            Đóng
          </button>
        </ModalFooter>
      </div>
    </Modal>
  );
};

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
      <PaymentDetail label="Mã đặt bàn" value={`#${booking?.id ?? "—"}`} />
      {/* Tuỳ chỉnh thông tin tài khoản nhận */}
      <PaymentDetail label="Ngân hàng" value="Vietcombank" />
      <PaymentDetail label="Số tài khoản" value="1234567890" />
      <PaymentDetail label="Chủ tài khoản" value="Golden Dragon Restaurant" />
      {booking?.reservationId && (
        <PaymentDetail
          label="ReservationId"
          value={String(booking.reservationId)}
        />
      )}
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
