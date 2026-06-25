import React, { useEffect, useMemo, useState } from "react";
import Modal from "@/components/common/Modal";
import { gql } from "@apollo/client";
import { useLazyQuery } from "@apollo/client/react";
import { usePaymentTimer } from "../../../hooks/usePaymentTimer";
import { useNotification } from "../../../hooks/useNotification";
import { formatCurrency } from "../../../utils/formatters";
import { readStorageValue } from "@/lib/browserStorage";
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

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:4000/graphql").replace(/\/graphql$/i, "");

const PROVIDER_OPTIONS = [
  { provider: "momo", label: "MoMo" },
  { provider: "vnpay", label: "VNPAY" },
];

const QRPaymentModal = ({ isOpen, onClose, booking, onPaymentConfirmed }) => {
  const depositAmount = Number(booking?.depositAmount ?? booking?.deposit ?? 0);
  const orderCode = booking?.orderCode || null;

  const [provider, setProvider] = useState("momo");
  const [creating, setCreating] = useState(false);
  const [activePayment, setActivePayment] = useState(null);
  const [polling, setPolling] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  const { timeLeft, formattedTime, startTimer, stopTimer, resetTimer } =
    usePaymentTimer(600);
  const { showNotification } = useNotification();

  const [fetchStatus] = useLazyQuery(GET_RESERVATION_STATUS, {
    fetchPolicy: "network-only",
  });

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
        const rs = data?.reservation;
        if (!rs) return;
        if (rs.depositStatus === "paid") {
          setPolling(false);
          stopTimer();
          showNotification("✅ Thanh toán thành công!", "success");
          onPaymentConfirmed?.(rs);
        } else if (["failed", "cancelled"].includes(rs.depositStatus)) {
          setPolling(false);
          showNotification("Thanh toán thất bại hoặc đã hủy.", "error");
        }
      } catch {
        // ignore intermittent poll failures
      }
    }, 3000);

    return () => clearInterval(id);
  }, [booking?.id, fetchStatus, isOpen, onPaymentConfirmed, polling, showNotification, stopTimer]);

  useEffect(() => {
    if (!isOpen) return;
    if (timeLeft === 0) {
      setPolling(false);
      showNotification(
        "⏰ Hết thời gian thanh toán! Đặt cọc đã bị hủy tự động.",
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

  const createPayment = async () => {
    if (!booking?.id) return;
    setCreating(true);
    try {
      const token = readStorageValue("auth_token") || readStorageValue("token");
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const res = await fetch(`${API_BASE}/api/payments/reservations/${booking.id}/create`, {
        method: "POST",
        headers,
        body: JSON.stringify({ provider }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.message || "Tạo payment thất bại");
      setActivePayment(json.payment);
      setPolling(true);
      if (json.payment?.payUrl) {
        window.open(json.payment.payUrl, "_blank", "noopener,noreferrer");
      }
      showNotification(`Đã tạo giao dịch ${provider.toUpperCase()}.`, "success");
    } catch (err) {
      showNotification(err?.message || "Không thể tạo payment", "error");
    } finally {
      setCreating(false);
    }
  };

  const handleManualCheck = async () => {
    setIsChecking(true);
    try {
      const { data } = await fetchStatus({ variables: { id: booking?.id } });
      const rs = data?.reservation;
      if (!rs) throw new Error("Không tìm thấy trạng thái đặt bàn");
      if (rs.depositStatus === "paid") {
        stopTimer();
        onPaymentConfirmed?.(rs);
      } else {
        showNotification("Giao dịch vẫn đang chờ callback xác nhận.", "warning");
      }
    } catch (err) {
      showNotification(err?.message || "Không thể query trạng thái", "error");
    } finally {
      setIsChecking(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
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
          <div className="provider-picker">
            {PROVIDER_OPTIONS.map((item) => (
              <button
                key={item.provider}
                className={`provider-btn ${provider === item.provider ? "active" : ""}`}
                onClick={() => setProvider(item.provider)}
                type="button"
                disabled={creating}
              >
                {item.label}
              </button>
            ))}
          </div>

          <PaymentInfo booking={booking} amount={depositAmount} activePayment={activePayment} />
        </div>

        <Modal.Footer>
          <button className="btn btn--primary" onClick={createPayment} disabled={creating}>
            {creating ? "Đang tạo giao dịch..." : `Thanh toán với ${provider.toUpperCase()}`}
          </button>
          <button className="btn btn--success" onClick={handleManualCheck} disabled={isChecking}>
            {isChecking ? "Đang kiểm tra..." : "Query trạng thái"}
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
            label="Order kèm"
            value={linkedOrders.map((order) => `#${order.orderCode || order.id}`).join(", ")}
          />
        )}
        <PaymentDetail label="Trạng thái" value={activePayment?.status || "pending"} />
        <PaymentDetail label="Provider" value={activePayment?.provider || "-"} />
        <PaymentDetail label="Reference" value={activePayment?.reference || "-"} />
      </div>

      {linkedOrders.length > 0 && (
        <div className="payment-details" style={{ marginTop: 10 }}>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => setExpandedOrders((prev) => !prev)}
          >
            {expandedOrders ? "Ẩn món ăn" : "Mở rộng món ăn"}
          </button>
          {expandedOrders && linkedOrders.map((order) => (
            <div key={order.id || order.orderCode} className="detail-item" style={{ display: "block" }}>
              <strong>Order #{order.orderCode || order.id}</strong>
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
          <p>⚠️ {booking.linkedOrderError}</p>
        </div>
      )}

      <div className="payment-warning">
        <p>
          ⚠️ <strong>Lưu ý:</strong> Redirect không phải xác nhận cuối cùng.
        </p>
        <p>Hệ thống chỉ xác nhận khi backend nhận callback/IPN hợp lệ.</p>
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
