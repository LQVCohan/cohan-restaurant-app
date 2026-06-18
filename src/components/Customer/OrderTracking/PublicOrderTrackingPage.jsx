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
        proofImages
        requiresProofImage
        proofUploaded
      }
      delivery {
        orderType
        deliveryStatus
        deliveryStatusLabel
        shippingAddress
        eta
        distance
        duration
        driverName
        driverPhone
        driverVehiclePlate
        externalTrackingCode
        timeline {
          status
          label
          at
          note
        }
      }
      payment {
        status
        method
        provider
        canRequestPayment
        totalAmount
      }
      latestRequest {
        requestId
        type
        status
        message
        createdAt
        acknowledgedAt
        resolvedAt
      }
    }
  }
`;
const TRACKING_FIELDS = `
  trackingCode publicStatus publicStatusLabel customerVisibleNote estimatedReadyAt
  timeline { status displayMessage changedAt }
  items { name quantity publicStatus publicStatusLabel proofImages requiresProofImage proofUploaded }
  delivery { orderType deliveryStatus deliveryStatusLabel shippingAddress eta distance duration driverName driverPhone driverVehiclePlate externalTrackingCode timeline { status label at note } }
  payment { status method provider canRequestPayment totalAmount }
  latestRequest { requestId type status message createdAt acknowledgedAt resolvedAt }
`;
export const REQUEST_PAYMENT_FROM_TRACKING = gql`mutation RequestPaymentFromTracking($trackingToken: String!){requestPaymentFromTracking(trackingToken:$trackingToken){success message tracking{${TRACKING_FIELDS}}}}`;
export const CALL_STAFF_FROM_TRACKING = gql`mutation CallStaffFromTracking($trackingToken: String!,$reason: String){callStaffFromTracking(trackingToken:$trackingToken,reason:$reason){success message tracking{${TRACKING_FIELDS}}}}`;

const paymentStatusLabel = { UNPAID: "Chưa thanh toán", PARTIAL: "Thanh toán một phần", PAYMENT_REQUESTED: "Đang chờ xử lý thanh toán", PENDING: "Đang chờ thanh toán", FAILED: "Thanh toán chưa hợp lệ", REJECTED: "Bằng chứng bị từ chối", PAID: "Đã thanh toán" };

const resolveTrackingPaymentPanel = (payment = {}) => {
  const method = String(payment?.method || payment?.provider || "").toLowerCase();
  if (!["transfer", "bank_transfer"].includes(method)) return null;
  const status = String(payment?.status || "").toUpperCase();
  if (["PAID", "VERIFIED", "SUCCESS"].includes(status)) {
    return { key: "verified", title: "Đã xác minh thanh toán", description: "Nhà hàng đã nhận đơn và đang xử lý." };
  }
  if (["SUBMITTED", "PAYMENT_REQUESTED", "RECEIVED", "VERIFYING"].includes(status)) {
    return { key: "submitted", title: "Đã nhận minh chứng", description: "Thời gian chờ đã tạm dừng để nhà hàng kiểm tra. Bạn sẽ nhận cập nhật khi POS xác minh hoặc từ chối." };
  }
  if (["REJECTED", "FAILED"].includes(status)) {
    return { key: "rejected", title: "Minh chứng chưa hợp lệ", description: "Vui lòng kiểm tra lý do từ chối và gửi lại đúng thông tin nếu phiên thanh toán vẫn còn lượt." };
  }
  if (["EXPIRED", "CANCELLED"].includes(status)) {
    return { key: "expired", title: "Phiên thanh toán đã hết hạn", description: "Hệ thống chưa ghi nhận giao dịch và chưa có minh chứng thanh toán. Đơn nháp đã được hủy." };
  }
  if (["PENDING", "UNPAID", "PARTIAL"].includes(status)) {
    return { key: "pending", title: "Đang chờ xác minh chuyển khoản", description: "Hệ thống tự kiểm tra giao dịch. Nếu đã chuyển khoản nhưng chưa được ghi nhận, hãy gửi minh chứng để nhà hàng xác minh nhanh hơn." };
  }
  return null;
};
const requestStatusLabel = { PENDING: "Đã gửi yêu cầu", ACKNOWLEDGED: "Nhân viên đã nhận yêu cầu", RESOLVED: "Yêu cầu đã được xử lý", CANCELLED: "Yêu cầu đã huỷ" };
const requestTypeLabel = { STAFF_CALL: "Yêu cầu hỗ trợ", PAYMENT_REQUEST: "Yêu cầu thanh toán" };
const finalStatuses = new Set(["PAID", "CANCELLED", "DELIVERED", "DELIVERY_CANCELLED", "DELIVERY_FAILED"]);
const socketUrl = import.meta.env.VITE_SOCKET_URL || "http://localhost:4000";

const formatDistance = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return `${number.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} km`;
};

const formatDuration = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return `${Math.round(number).toLocaleString("vi-VN")} phút`;
};

const DeliveryInfoRow = ({ label, value }) => {
  if (value === null || value === undefined || value === "") return null;
  return <div className="delivery-info-row"><span>{label}</span><strong>{value}</strong></div>;
};

const resolveLatestTimelineIndex = (timelineItems = []) => {
  if (!timelineItems.length) return -1;
  let latestIndex = 0;
  let latestTime = Number.NEGATIVE_INFINITY;

  timelineItems.forEach((item, index) => {
    const time = Date.parse(item?.changedAt || "");
    if (Number.isFinite(time) && time >= latestTime) {
      latestTime = time;
      latestIndex = index;
    }
  });

  return latestTime === Number.NEGATIVE_INFINITY ? timelineItems.length - 1 : latestIndex;
};

const ItemProofPreview = ({ item }) => {
  const images = Array.isArray(item?.proofImages) ? item.proofImages.filter(Boolean) : [];
  const requiresProof = Boolean(item?.requiresProofImage);
  if (!requiresProof && images.length === 0) return null;

  return (
    <div className="item-proof-preview">
      <span className={`proof-chip ${images.length ? "proof-chip--done" : "proof-chip--waiting"}`}>
        {images.length ? "Đã có ảnh cân ký" : "Đang chờ ảnh cân ký"}
      </span>
      {images.length > 0 && (
        <div className="item-proof-gallery" aria-label={`Ảnh minh chứng cân ký của ${item.name}`}>
          {images.slice(0, 4).map((src, index) => (
            <a href={src} target="_blank" rel="noreferrer" key={`${src}-${index}`}>
              <img src={src} alt={`Ảnh cân ký ${item.name} ${index + 1}`} />
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

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

  useEffect(() => {
    setLiveData(null);
    setActionMessage("");
    setSocketReady(false);
  }, [trackingToken]);

  const isFinal = useMemo(() => {
    const orderStatus = tracking?.publicStatus ? String(tracking.publicStatus).toUpperCase() : "";
    const payStatus = tracking?.payment?.status ? String(tracking.payment.status).toUpperCase() : "";
    return finalStatuses.has(orderStatus) || finalStatuses.has(payStatus);
  }, [tracking]);

  useEffect(() => {
    if (!trackingToken) return;
    const socket = io(socketUrl, { transports: ["websocket", "polling"] });
    socketRef.current = socket;
    socket.on("connect", () => { setSocketReady(true); socket.emit("join-order-tracking", { trackingToken }); });
    socket.on("disconnect", () => setSocketReady(false));
    socket.on("connect_error", () => setSocketReady(false));
    socket.on("customer-order-tracking-updated", (payload) => setLiveData(payload || null));
    return () => {
      socket.emit("leave-order-tracking", { trackingToken });
      socket.off("customer-order-tracking-updated");
      socket.disconnect();
      socketRef.current = null;
    };
  }, [trackingToken]);

  useEffect(() => {
    const hidden = document.hidden;
    if (!trackingToken || socketReady || isFinal || hidden) { stopPolling(); return; }
    startPolling(12000);
    return () => stopPolling();
  }, [trackingToken, socketReady, isFinal, startPolling, stopPolling]);

  const handleActionResult = async (executor) => {
    try {
      const result = await executor();
      const actionResult = result?.data?.requestPaymentFromTracking || result?.data?.callStaffFromTracking;
      setActionMessage(actionResult?.message || "Đã gửi yêu cầu.");
      if (actionResult?.tracking) setLiveData(actionResult.tracking); else await refetch();
    } catch {
      setActionMessage("Không thể gửi yêu cầu lúc này. Vui lòng thử lại sau.");
    }
  };

  if (!trackingToken) {
    return <div className="track-order-page"><section className="track-card error" role="alert"><h2>Không tìm thấy đơn hàng</h2><p>Vui lòng kiểm tra lại mã QR hoặc liên hệ nhân viên.</p></section></div>;
  }

  if (loading && !tracking) {
    return <div className="track-order-page"><section className="track-card loading" role="status"><h2>Đang tải trạng thái đơn hàng...</h2><p className="skeleton-line" /><p className="skeleton-line short" /></section></div>;
  }

  if (error) {
    const message = String(error.message || "").toLowerCase();
    const isExpired = message.includes("expired") || message.includes("hết hiệu lực");
    if (isExpired) return <div className="track-order-page"><section className="track-card error" role="alert"><h2>Liên kết theo dõi đã hết hiệu lực</h2><p>Vui lòng liên hệ nhân viên để kiểm tra lại đơn hàng.</p></section></div>;
    return <div className="track-order-page"><section className="track-card error" role="alert"><h2>Không thể tải trạng thái đơn hàng</h2><p>Vui lòng thử lại sau hoặc liên hệ nhân viên.</p><button type="button" className="secondary-btn" onClick={() => refetch()}>Thử lại</button></section></div>;
  }

  if (!tracking) return <div className="track-order-page"><section className="track-card error" role="alert"><h2>Không tìm thấy đơn hàng</h2><p>Vui lòng kiểm tra lại mã QR hoặc liên hệ nhân viên.</p></section></div>;

  const paymentStatus = String(tracking.payment?.status || "").toUpperCase();
  const publicStatus = String(tracking.publicStatus || "").toUpperCase();
  const latestRequest = tracking.latestRequest || null;
  const latestType = String(latestRequest?.type || "").toUpperCase();
  const latestStatus = String(latestRequest?.status || "").toUpperCase();
  const activeReq = latestStatus === "PENDING" || latestStatus === "ACKNOWLEDGED";
  const paymentReqActive = activeReq && latestType === "PAYMENT_REQUEST";
  const staffReqActive = activeReq && latestType === "STAFF_CALL";

  const isCancelled = publicStatus === "CANCELLED";
  const isPaid = publicStatus === "PAID" || paymentStatus === "PAID";
  const canRequestPayment = Boolean(tracking.payment?.canRequestPayment);
  const paymentAlreadyRequested = paymentStatus === "PAYMENT_REQUESTED";
  const trackingPaymentPanel = resolveTrackingPaymentPanel(tracking.payment);
  const paymentActionLocked = paymentReqActive || paymentAlreadyRequested;

  const timelineItems = Array.isArray(tracking.timeline) ? tracking.timeline : [];
  const latestTimelineIndex = resolveLatestTimelineIndex(timelineItems);
  const delivery = tracking.delivery || null;
  const deliveryTimeline = Array.isArray(delivery?.timeline) ? delivery.timeline : [];

  const updateModeLabel = isFinal
    ? "Đơn hàng đã hoàn tất"
    : socketReady
      ? "Đang cập nhật trực tiếp"
      : "Tự động làm mới mỗi 12 giây";

  return (
    <div className="track-order-page">
      <div className="track-order-shell">
        <section className="track-card hero-card">
          <div className="hero-head"><h1>Theo dõi đơn hàng</h1><span className={`status-badge ${publicStatus.toLowerCase()}`}>{tracking.publicStatusLabel || "Đang xử lý"}</span></div>
          <p className="tracking-code">Mã theo dõi: <strong>{tracking.trackingCode || "-"}</strong></p>
          <p className={`live-indicator ${isFinal ? "live-indicator--final" : socketReady ? "live-indicator--live" : "live-indicator--polling"}`} role="status">{updateModeLabel}</p>
          {tracking.estimatedReadyAt && <p>Dự kiến sẵn sàng: {new Date(tracking.estimatedReadyAt).toLocaleString("vi-VN")}</p>}
          {tracking.customerVisibleNote && <p className="note">{tracking.customerVisibleNote}</p>}
        </section>


        {trackingPaymentPanel && (
          <section className={`tracking-payment-panel tracking-payment-panel--${trackingPaymentPanel.key}`}>
            <div>
              <p className="tracking-payment-eyebrow">Thanh toán</p>
              <h3>{trackingPaymentPanel.title}</h3>
              <p>{trackingPaymentPanel.description}</p>
            </div>
          </section>
        )}

        <section className="track-card"><h3>Tiến trình đơn hàng</h3>{timelineItems.length === 0 ? <p>Chưa có cập nhật tiến trình.</p> : <ol className="timeline">{timelineItems.map((item, idx) => <li key={`${item.changedAt}-${idx}`} className={idx === latestTimelineIndex ? "current" : ""}><div><strong>{item.displayMessage}</strong><p>{item.changedAt ? new Date(item.changedAt).toLocaleString("vi-VN") : ""}</p></div></li>)}</ol>}</section>

        {delivery && (
          <section className="track-card delivery-card">
            <div className="delivery-card__head">
              <h3>Thông tin giao hàng</h3>
              <span className={`status-badge delivery-status ${String(delivery.deliveryStatus || "").toLowerCase()}`}>{delivery.deliveryStatusLabel || "Đang cập nhật"}</span>
            </div>
            <div className="delivery-info-grid">
              <DeliveryInfoRow label="ETA" value={delivery.eta ? new Date(delivery.eta).toLocaleString("vi-VN") : null} />
              <DeliveryInfoRow label="Khoảng cách" value={formatDistance(delivery.distance)} />
              <DeliveryInfoRow label="Thời lượng dự kiến" value={formatDuration(delivery.duration)} />
              <DeliveryInfoRow label="Địa chỉ giao" value={delivery.shippingAddress} />
              <DeliveryInfoRow label="Người giao" value={delivery.driverName} />
              <DeliveryInfoRow label="SĐT người giao" value={delivery.driverPhone} />
              <DeliveryInfoRow label="Biển số xe" value={delivery.driverVehiclePlate} />
              <DeliveryInfoRow label="Mã vận đơn ngoài" value={delivery.externalTrackingCode} />
            </div>
            <div className="delivery-timeline-wrap">
              <h4>Tiến trình giao hàng</h4>
              {deliveryTimeline.length === 0 ? (
                <p className="helper">Chưa có cập nhật giao hàng.</p>
              ) : (
                <ol className="timeline delivery-timeline">
                  {deliveryTimeline.map((item) => (
                    <li key={item.status} className={item.status === delivery.deliveryStatus ? "current" : ""}>
                      <div>
                        <strong>{item.label}</strong>
                        {item.at && <p>{new Date(item.at).toLocaleString("vi-VN")}</p>}
                        {item.note && <p>{item.note}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>
        )}

        <section className="track-card"><h3>Món đã gọi</h3>{(tracking.items || []).length === 0 ? <p>Chưa có món trong đơn.</p> : <ul className="item-list">{tracking.items.map((item, idx) => <li key={`${item.name}-${idx}`}><div className="item-list__main"><strong>{item.name}</strong><p>Số lượng: {item.quantity}</p><ItemProofPreview item={item} /></div><span className={`status-badge ${String(item.publicStatus || "").toLowerCase()}`}>{item.publicStatusLabel || "Đang xử lý"}</span></li>)}</ul>}</section>

        <section className="track-card"><h3>Thanh toán</h3><p className="amount">{Number(tracking.payment?.totalAmount || 0).toLocaleString("vi-VN", { style: "currency", currency: "VND" })}</p><p>Trạng thái: <span className={`status-badge ${paymentStatus.toLowerCase()}`}>{paymentStatusLabel[paymentStatus] || "Đang cập nhật"}</span></p>
          <button type="button" className="primary-btn" disabled={requestingPayment || callingStaff || isCancelled || isPaid || !canRequestPayment || paymentActionLocked} onClick={() => handleActionResult(() => requestPayment({ variables: { trackingToken } }))}>{requestingPayment ? "Đang gửi yêu cầu..." : "Yêu cầu thanh toán"}</button>
          {paymentActionLocked && <p className="helper">Yêu cầu thanh toán đang được xử lý.</p>}
          {!canRequestPayment && !isPaid && !paymentActionLocked && <p className="helper">Hiện chưa thể yêu cầu thanh toán cho đơn này.</p>}
        </section>

        <section className="track-card"><h3>Cần hỗ trợ?</h3><button type="button" className="secondary-btn" disabled={requestingPayment || callingStaff || isCancelled || staffReqActive} onClick={() => handleActionResult(() => callStaff({ variables: { trackingToken } }))}>{callingStaff ? "Đang gọi nhân viên..." : "Gọi nhân viên hỗ trợ"}</button>{staffReqActive && <p className="helper">Nhân viên đã nhận yêu cầu hỗ trợ.</p>}</section>

        {latestRequest && <section className="track-card"><h3>Yêu cầu gần nhất</h3><p><strong>Loại yêu cầu:</strong> {requestTypeLabel[latestType] || "Yêu cầu"}</p><p><strong>Trạng thái:</strong> {requestStatusLabel[latestStatus] || "Đã gửi yêu cầu"}</p>{latestRequest.message && <p><strong>Nội dung:</strong> {latestRequest.message}</p>}{latestRequest.createdAt && <p><strong>Tạo lúc:</strong> {new Date(latestRequest.createdAt).toLocaleString("vi-VN")}</p>}</section>}

        {actionMessage && <p className="action-message" role="status">{actionMessage}</p>}
        <button type="button" className="refresh-btn" onClick={() => refetch()}>Làm mới</button>
      </div>
    </div>
  );
}
