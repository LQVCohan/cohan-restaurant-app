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

  return (
    <div className="orderTrackingQrCard">
      <h4>QR theo dõi đơn hàng</h4>
      <p>Khách quét mã này để theo dõi trạng thái đơn hàng.</p>
      {!show && <button type="button" onClick={handleShow} disabled={disabled}>Hiển thị QR</button>}
      {loading && <p>Đang tải QR...</p>}
      {error && <p>{String(error.message || "").toLowerCase().includes("permission") ? "Bạn không có quyền xem QR theo dõi đơn này." : "Không tải được mã QR. Vui lòng thử lại."}</p>}
      {show && !loading && data?.orderTrackingQrSvg && (
        <div dangerouslySetInnerHTML={{ __html: data.orderTrackingQrSvg }} />
      )}
    </div>
  );
}
