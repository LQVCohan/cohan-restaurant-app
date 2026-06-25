import React from "react";
import { gql, useQuery } from "@apollo/client";

const TRANSFER_QUEUE_COUNT = gql`
  query TransferQueueCount($restaurantId: ID!, $statuses: [TransferVerificationStatus!], $limit: Int) {
    transferPaymentQueue(restaurantId: $restaurantId, statuses: $statuses, limit: $limit) {
      id
      status
    }
  }
`;

export default function TransferQueueBell({ restaurantId }) {
  const { data, loading } = useQuery(TRANSFER_QUEUE_COUNT, {
    variables: {
      restaurantId,
      statuses: ["SUBMITTED", "VERIFYING"],
      limit: 99,
    },
    skip: !restaurantId,
    pollInterval: 15000,
    fetchPolicy: "cache-and-network",
  });

  const count = Array.isArray(data?.transferPaymentQueue)
    ? data.transferPaymentQueue.length
    : 0;
  const hasPending = count > 0;

  return (
    <button
      type="button"
      title={`POS chuyển khoản chờ xác minh: ${count} phiên`}
      aria-label={`POS chuyển khoản chờ xác minh: ${count} phiên`}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        minHeight: 38,
        border: hasPending ? "1px solid #fed7aa" : "1px solid #e2e8f0",
        borderRadius: 999,
        padding: "0.48rem 0.82rem",
        background: hasPending ? "#fff7ed" : "#ffffff",
        color: hasPending ? "#c2410c" : "#475569",
        fontWeight: 850,
        cursor: "default",
        boxShadow: "0 6px 16px rgba(15, 23, 42, 0.05)",
        whiteSpace: "nowrap",
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 16 }}>💬</span>
      <span style={{ fontSize: 13 }}>Chuyển khoản</span>
      <span
        style={{
          minWidth: 20,
          height: 20,
          padding: "0 6px",
          borderRadius: 999,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: hasPending ? "#f97316" : "#e2e8f0",
          color: hasPending ? "#fff" : "#475569",
          fontSize: 12,
          fontWeight: 900,
          lineHeight: 1,
        }}
      >
        {loading && !data ? "…" : count}
      </span>
    </button>
  );
}
