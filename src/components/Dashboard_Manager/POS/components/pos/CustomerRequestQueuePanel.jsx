import React, { useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";

export const Q = gql`
  query CustomerServiceRequests($restaurantId: ID!, $status: String, $type: String, $limit: Int) {
    customerServiceRequests(restaurantId: $restaurantId, status: $status, type: $type, limit: $limit) {
      orderId orderCode tableCode requestId type status message createdAt
    }
  }
`;
export const ACK = gql`mutation A($restaurantId: ID!, $orderId: ID!, $requestId: String!){acknowledgeCustomerServiceRequest(restaurantId:$restaurantId,orderId:$orderId,requestId:$requestId){ok message}}`;
export const RES = gql`mutation R($restaurantId: ID!, $orderId: ID!, $requestId: String!){resolveCustomerServiceRequest(restaurantId:$restaurantId,orderId:$orderId,requestId:$requestId){ok message}}`;

export default function CustomerRequestQueuePanel({ restaurantId, onOpenOrder, onOpenPayment }) {
  const [typeFilter, setTypeFilter] = useState(null);
  const shared = useMemo(() => ({ restaurantId, type: typeFilter, limit: 50 }), [restaurantId, typeFilter]);
  const pollInterval = restaurantId && process.env.NODE_ENV !== "test" ? 10000 : 0;
  const { data, refetch } = useQuery(Q, { variables: { ...shared, status: "PENDING" }, skip: !restaurantId, fetchPolicy: "cache-and-network", pollInterval });
  const { data: ackData, refetch: refetchAck } = useQuery(Q, { variables: { ...shared, status: "ACKNOWLEDGED" }, skip: !restaurantId, fetchPolicy: "cache-and-network", pollInterval });
  const [ack] = useMutation(ACK);
  const [resolve] = useMutation(RES);
  const rows = [...(data?.customerServiceRequests || []), ...(ackData?.customerServiceRequests || [])];
  if (!rows.length) return null;

  const refetchAll = () => Promise.all([refetch(), refetchAck()]);
  const acknowledge = async (request) => {
    await ack({ variables: { restaurantId, orderId: request.orderId, requestId: request.requestId } });
    await refetchAll();
  };

  return <div style={{ border: "1px solid #f2d39c", padding: 10, borderRadius: 8, marginBottom: 10, background: "#fff8ea" }}>
    <b>Hàng đợi yêu cầu khách ({rows.length})</b>
    <div style={{ marginTop: 8 }}>
      <button type="button" onClick={() => setTypeFilter(null)}>Tất cả</button>
      <button type="button" style={{ marginLeft: 8 }} onClick={() => setTypeFilter("STAFF_CALL")}>Gọi nhân viên</button>
      <button type="button" style={{ marginLeft: 8 }} onClick={() => setTypeFilter("PAYMENT_REQUEST")}>Thanh toán</button>
    </div>
    {rows.map((r) => {
      const isStaffCall = r.type === "STAFF_CALL";
      const isAcknowledged = r.status === "ACKNOWLEDGED";
      const isPending = r.status === "PENDING";

      return <div key={r.requestId} style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed #e5c88f" }}>
        <div>{isStaffCall ? "Khách cần hỗ trợ" : "Khách yêu cầu thanh toán"} • Bàn {r.tableCode || "-"} • #{r.orderCode}</div>
        {r.message ? <div style={{ fontSize: 13 }}>{r.message}</div> : null}
        <div style={{ marginTop: 6 }}>
          {isStaffCall && isPending && <button type="button" onClick={async () => { await acknowledge(r); await onOpenOrder?.(r.orderId); }}>Nhận xử lý</button>}
          {isStaffCall && isAcknowledged && <button type="button" onClick={async () => { await resolve({ variables: { restaurantId, orderId: r.orderId, requestId: r.requestId } }); await refetchAll(); }}>Đã hỗ trợ</button>}

          {!isStaffCall && isPending && <button type="button" onClick={async () => { await acknowledge(r); await onOpenPayment?.(r.orderId); }}>Nhận thanh toán</button>}
          {!isStaffCall && isAcknowledged && <>
            <button type="button" onClick={() => onOpenPayment?.(r.orderId)}>Mở thanh toán</button>
            <button type="button" style={{ marginLeft: 8 }} onClick={async () => { await resolve({ variables: { restaurantId, orderId: r.orderId, requestId: r.requestId } }); await refetchAll(); }}>Đánh dấu đã xử lý</button>
          </>}
        </div>
      </div>;
    })}
  </div>;
}
