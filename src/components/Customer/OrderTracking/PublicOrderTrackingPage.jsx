import React, { useEffect, useMemo, useRef, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import { useParams } from "react-router-dom";
import { io } from "socket.io-client";
import "./publicOrderTracking.scss";

export const CUSTOMER_TRACK_ORDER = gql`
  query CustomerTrackOrder($trackingToken: String!) {
    customerTrackOrder(trackingToken: $trackingToken) {
      trackingCode
      publicStatus
      publicStatusLabel
      customerVisibleNote
      estimatedReadyAt
      trackingQrRevokedAt
      timeline {
        status
        displayMessage
        changedAt
      }
      items {
        name
        quantity
        publicStatus
        publicStatusLabel
      }
      payment {
        status
        canRequestPayment
        totalAmount
      }
    }
  }
`;

const paymentStatusLabel = {
  UNPAID: "Chưa thanh toán",
  PARTIAL: "Thanh toán một phần",
  PAYMENT_REQUESTED: "Đang chờ xử lý thanh toán",
  PAID: "Đã thanh toán",
};

const finalStatuses = new Set(["PAID", "CANCELLED"]);

const socketUrl = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function PublicOrderTrackingPage() {
  const { trackingToken } = useParams();
  const [socketReady, setSocketReady] = useState(false);
  const [liveData, setLiveData] = useState(null);
  const socketRef = useRef(null);

  const { data, loading, error, refetch, startPolling, stopPolling } = useQuery(CUSTOMER_TRACK_ORDER, {
    skip: !trackingToken,
    variables: { trackingToken },
    fetchPolicy: "cache-and-network",
  });

  const tracking = liveData || data?.customerTrackOrder || null;

  const isFinal = useMemo(() => {
    const orderStatus = tracking?.publicStatus ? String(tracking.publicStatus).toUpperCase() : "";
    const paymentStatus = tracking?.payment?.status ? String(tracking.payment.status).toUpperCase() : "";
    return finalStatuses.has(orderStatus) || finalStatuses.has(paymentStatus);
  }, [tracking]);

  useEffect(() => {
    if (!trackingToken) return;
    const socket = io(socketUrl, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      setSocketReady(true);
      socket.emit("join-order-tracking", { trackingToken });
    });
    socket.on("disconnect", () => setSocketReady(false));
    socket.on("connect_error", () => setSocketReady(false));
    socket.on("customer-order-tracking-updated", (payload) => {
      setLiveData(payload || null);
    });

    return () => {
      socket.emit("leave-order-tracking", { trackingToken });
      socket.off("customer-order-tracking-updated");
      socket.disconnect();
      socketRef.current = null;
    };
  }, [trackingToken]);

  useEffect(() => {
    const hidden = document.hidden;
    if (!trackingToken || socketReady || isFinal || hidden) {
      stopPolling();
      return;
    }
    startPolling(12000);
    return () => stopPolling();
  }, [trackingToken, socketReady, isFinal, startPolling, stopPolling]);

  if (!trackingToken) return <div className="track-order-page">Không tìm thấy đơn hàng.</div>;
  if (loading && !tracking) return <div className="track-order-page">Đang tải trạng thái đơn hàng...</div>;
  if (error) return <div className="track-order-page">Không thể tải dữ liệu. Vui lòng thử lại sau.</div>;
  if (!tracking) return <div className="track-order-page"><h2>Không tìm thấy đơn hàng</h2><p>Vui lòng kiểm tra lại mã QR hoặc liên hệ nhân viên.</p></div>;

  if (tracking.trackingQrRevokedAt) {
    return <div className="track-order-page"><h2>Liên kết theo dõi đơn hàng đã hết hiệu lực.</h2></div>;
  }

  return (
    <div className="track-order-page">
      <h1>Theo dõi đơn hàng</h1>
      <p className="tracking-code">Mã đơn: {tracking.trackingCode || "-"}</p>
      <div className="status-card">
        <div className="status-badge">{tracking.publicStatusLabel || "Đang xử lý"}</div>
        {tracking.estimatedReadyAt && (
          <p>Dự kiến sẵn sàng: {new Date(tracking.estimatedReadyAt).toLocaleString("vi-VN")}</p>
        )}
        {tracking.customerVisibleNote && <p className="note">{tracking.customerVisibleNote}</p>}
      </div>
      <div className="section">
        <h3>Tiến trình</h3>
        {(tracking.timeline || []).length === 0 ? <p>Chưa có cập nhật tiến trình.</p> : (
          <ul>{tracking.timeline.map((item, idx) => <li key={`${item.changedAt}-${idx}`}><strong>{item.displayMessage}</strong><br />{item.changedAt ? new Date(item.changedAt).toLocaleString("vi-VN") : ""}</li>)}</ul>
        )}
      </div>
      <div className="section">
        <h3>Món đã gọi</h3>
        {(tracking.items || []).length === 0 ? <p>Chưa có món trong đơn.</p> : (
          <ul>{tracking.items.map((item, idx) => <li key={`${item.name}-${idx}`}>{item.name} x{item.quantity} - {item.publicStatusLabel || "Đang xử lý"}</li>)}</ul>
        )}
      </div>
      <div className="section">
        <h3>Thanh toán</h3>
        <p>Tổng tiền: {(Number(tracking.payment?.totalAmount || 0)).toLocaleString("vi-VN", { style: "currency", currency: "VND" })}</p>
        <p>Trạng thái: {paymentStatusLabel[String(tracking.payment?.status || "").toUpperCase()] || "Đang cập nhật"}</p>
        {tracking.payment?.canRequestPayment && <p>Bạn có thể gọi nhân viên để thanh toán.</p>}
      </div>
      <button type="button" onClick={() => refetch()}>Làm mới</button>
      <small>Trạng thái sẽ tự cập nhật khi nhà hàng xử lý đơn.</small>
    </div>
  );
}
