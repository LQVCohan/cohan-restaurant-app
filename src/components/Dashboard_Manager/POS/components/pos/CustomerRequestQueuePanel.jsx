import React, { useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";

const Q = gql`
  query CustomerServiceRequests($restaurantId: ID!, $status: String, $type: String, $limit: Int) {
    customerServiceRequests(restaurantId: $restaurantId, status: $status, type: $type, limit: $limit) {
      orderId orderCode tableCode requestId type status message createdAt
    }
  }
`;
const ACK = gql`mutation A($restaurantId: ID!, $orderId: ID!, $requestId: String!){acknowledgeCustomerServiceRequest(restaurantId:$restaurantId,orderId:$orderId,requestId:$requestId){ok message}}`;
const RES = gql`mutation R($restaurantId: ID!, $orderId: ID!, $requestId: String!){resolveCustomerServiceRequest(restaurantId:$restaurantId,orderId:$orderId,requestId:$requestId){ok message}}`;

export default function CustomerRequestQueuePanel({ restaurantId }) {
  const [typeFilter, setTypeFilter] = useState(null);
  const shared = useMemo(() => ({ restaurantId, type: typeFilter, limit: 50 }), [restaurantId, typeFilter]);
  const { data, refetch } = useQuery(Q, { variables: { ...shared, status: "PENDING" }, skip: !restaurantId, fetchPolicy: "cache-and-network", pollInterval: restaurantId ? 10000 : 0 });
  const { data: ackData, refetch: refetchAck } = useQuery(Q, { variables: { ...shared, status: "ACKNOWLEDGED" }, skip: !restaurantId, fetchPolicy: "cache-and-network", pollInterval: restaurantId ? 10000 : 0 });
  const [ack] = useMutation(ACK);
  const [resolve] = useMutation(RES);
  const rows = [...(data?.customerServiceRequests || []), ...(ackData?.customerServiceRequests || [])];
  if (!rows.length) return null;
  return <div style={{ border: "1px solid #f2d39c", padding: 10, borderRadius: 8, marginBottom: 10, background: "#fff8ea" }}>
    <b>Hàng đợi yêu cầu khách ({rows.length})</b>
    <div style={{ marginTop: 8 }}>
      <button type="button" onClick={() => setTypeFilter(null)}>Tất cả</button>
      <button type="button" style={{ marginLeft: 8 }} onClick={() => setTypeFilter("STAFF_CALL")}>Gọi nhân viên</button>
      <button type="button" style={{ marginLeft: 8 }} onClick={() => setTypeFilter("PAYMENT_REQUEST")}>Thanh toán</button>
    </div>
    {rows.map((r) => <div key={r.requestId} style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed #e5c88f" }}>
      <div>{r.type === "STAFF_CALL" ? "Gọi nhân viên" : "Yêu cầu thanh toán"} • Bàn {r.tableCode || "-"} • #{r.orderCode}</div>
      {r.message ? <div style={{ fontSize: 13 }}>{r.message}</div> : null}
      <div style={{ marginTop: 6 }}>
        {r.status === "PENDING" && <button type="button" onClick={async () => { await ack({ variables: { restaurantId, orderId: r.orderId, requestId: r.requestId } }); await Promise.all([refetch(), refetchAck()]); }}>Nhận xử lý</button>}
        {r.status !== "RESOLVED" && <button type="button" style={{ marginLeft: 8 }} onClick={async () => { await resolve({ variables: { restaurantId, orderId: r.orderId, requestId: r.requestId } }); await Promise.all([refetch(), refetchAck()]); }}>Đã xử lý</button>}
      </div>
    </div>)}
  </div>;
}
