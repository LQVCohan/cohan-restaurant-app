import React, { useState } from "react";
import { gql, useLazyQuery } from "@apollo/client";

const ORDER_TRACKING_QR_SVG = gql`
  query OrderTrackingQrSvg($orderId: ID!) {
    orderTrackingQrSvg(orderId: $orderId)
  }
`;

export default function OrderTrackingQrCard({ orderId, disabled = false }) {
  const [show, setShow] = useState(false);
  const [loadQr, { data, loading, error }] = useLazyQuery(ORDER_TRACKING_QR_SVG, { fetchPolicy: "network-only" });

  const handleShow = () => {
    if (!orderId || disabled) return;
    setShow(true);
    loadQr({ variables: { orderId } });
  };

  if (!orderId) return null;
  const permissionDenied = String(error?.message || "").toLowerCase().includes("permission");

  return (
    <div className="orderTrackingQrCard">
      <h4>QR theo dõi đơn hàng</h4>
      <p>Đưa mã này cho khách quét để xem tiến trình đơn hàng theo thời gian thực.</p>
      <button type="button" onClick={handleShow} disabled={disabled || loading} aria-label="Hiển thị hoặc tải lại mã QR theo dõi đơn hàng">
        {loading ? "Đang tải QR..." : show ? "Tải lại QR" : "Hiển thị QR"}
      </button>
      <p className="qr-sub-note">Khách không cần đăng nhập.</p>
      {error && <div className="qr-error" role="alert">{permissionDenied ? "Bạn không có quyền xem QR theo dõi đơn này." : "Không tải được mã QR. Vui lòng thử lại."}</div>}
      {show && !loading && data?.orderTrackingQrSvg && (
        <div className="qr-frame" aria-label="Mã QR theo dõi đơn hàng" dangerouslySetInnerHTML={{ __html: data.orderTrackingQrSvg }} />
      )}
    </div>
  );
}
