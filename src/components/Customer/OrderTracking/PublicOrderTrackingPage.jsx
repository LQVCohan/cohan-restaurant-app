import React, { useEffect, useMemo, useRef, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
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
const TRACKING_FIELDS = `
  trackingCode publicStatus publicStatusLabel customerVisibleNote estimatedReadyAt
  timeline { status displayMessage changedAt }
  items { name quantity publicStatus publicStatusLabel }
  payment { status canRequestPayment totalAmount }
`;
export const REQUEST_PAYMENT_FROM_TRACKING = gql`mutation RequestPaymentFromTracking($trackingToken: String!){requestPaymentFromTracking(trackingToken:$trackingToken){success message tracking{${TRACKING_FIELDS}}}}`;
export const CALL_STAFF_FROM_TRACKING = gql`mutation CallStaffFromTracking($trackingToken: String!,$reason: String){callStaffFromTracking(trackingToken:$trackingToken,reason:$reason){success message tracking{${TRACKING_FIELDS}}}}`;

const paymentStatusLabel = {
  UNPAID: "Chưa thanh toán",
  PARTIAL: "Thanh toán một phần",
  PAYMENT_REQUESTED: "Đang chờ xử lý thanh toán",
  PAID: "Đã thanh toán",
};

const finalStatuses = new Set(["PAID", "CANCELLED"]);

const socketUrl = import.meta.env.VITE_SOCKET_URL || "http://localhost:4000";

export default function PublicOrderTrackingPage() {
  const { trackingToken } = useParams();
  const [socketReady, setSocketReady] = useState(false);
  const [liveData, setLiveData] = useState(null);
  const [actionMessage, setActionMessage] = useState("");
  const socketRef = useRef(null);
  const [requestPayment, { loading: requestingPayment }] = useMutation(REQUEST_PAYMENT_FROM_TRACKING);
  const [callStaff, { loading: callingStaff }] = useMutation(CALL_STAFF_FROM_TRACKING);

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
  if (error) {
    const message = String(error.message || "").toLowerCase();
    if (message.includes("expired") || message.includes("hết hiệu lực")) {
      return (
        <div className="track-order-page">
          <h2>Liên kết theo dõi đơn hàng đã hết hiệu lực.</h2>
          <p>Vui lòng liên hệ nhân viên nếu bạn cần kiểm tra lại đơn hàng.</p>
        </div>
      );
    }

    return (
      <div className="track-order-page">
        <h2>Không thể tải dữ liệu</h2>
        <p>Vui lòng thử lại sau hoặc liên hệ nhân viên.</p>
        <button type="button" onClick={() => refetch()}>
          Thử lại
        </button>
      </div>
    );
  }
  if (!tracking) return <div className="track-order-page"><h2>Không tìm thấy đơn hàng</h2><p>Vui lòng kiểm tra lại mã QR hoặc liên hệ nhân viên.</p></div>;
  const paymentStatus = String(tracking.payment?.status || "").toUpperCase();
  const publicStatus = String(tracking.publicStatus || "").toUpperCase();
  const isCancelled = publicStatus === "CANCELLED";
  const isPaid = publicStatus === "PAID" || paymentStatus === "PAID";
  const paymentRequested = paymentStatus === "PAYMENT_REQUESTED";
  const canRequestPayment = Boolean(tracking.payment?.canRequestPayment);
  const disableActions = requestingPayment || callingStaff || isCancelled;

  const handleActionResult = async (executor) => {
    try {
      const result = await executor();
      const actionResult = result?.data?.requestPaymentFromTracking || result?.data?.callStaffFromTracking;
      setActionMessage(actionResult?.message || "Đã gửi yêu cầu.");
      if (actionResult?.tracking) setLiveData(actionResult.tracking);
      else await refetch();
    } catch {
      setActionMessage("Không thể gửi yêu cầu lúc này. Vui lòng thử lại sau.");
    }
  };

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
        {canRequestPayment && <p>Bạn có thể gọi nhân viên để thanh toán.</p>}
        <button type="button" disabled={disableActions || isPaid || paymentRequested || !canRequestPayment} onClick={() => handleActionResult(() => requestPayment({ variables: { trackingToken } }))}>Yêu cầu thanh toán</button>
        {paymentRequested && <p>Yêu cầu thanh toán đã được gửi.</p>}
        {!canRequestPayment && !isPaid && !paymentRequested && <p>Hiện chưa thể yêu cầu thanh toán cho đơn này.</p>}
      </div>
      <div className="section">
        <h3>Cần hỗ trợ?</h3>
        <button type="button" disabled={disableActions} onClick={() => handleActionResult(() => callStaff({ variables: { trackingToken } }))}>Gọi nhân viên</button>
      </div>
      {actionMessage && <p className="action-message">{actionMessage}</p>}
      <button type="button" onClick={() => refetch()}>Làm mới</button>
      <small>Trạng thái sẽ tự cập nhật khi nhà hàng xử lý đơn.</small>
    </div>
  );
}
