import React, { useCallback, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import {
  BellRing,
  CheckCircle2,
  Clock3,
  CreditCard,
  HandHelping,
} from "lucide-react";
import useSocketOrder from "@/hooks/useSocketOrder";
import styles from "./CustomerRequestQueuePanel.module.scss";

export const Q = gql`
  query CustomerServiceRequests($restaurantId: ID!, $status: String, $type: String, $limit: Int) {
    customerServiceRequests(restaurantId: $restaurantId, status: $status, type: $type, limit: $limit) {
      orderId
      orderCode
      tableCode
      requestId
      type
      status
      message
      createdAt
      acknowledgedAt
    }
  }
`;
export const ACK = gql`
  mutation A($restaurantId: ID!, $orderId: ID!, $requestId: String!) {
    acknowledgeCustomerServiceRequest(
      restaurantId: $restaurantId
      orderId: $orderId
      requestId: $requestId
    ) {
      ok
      message
    }
  }
`;
export const RES = gql`
  mutation R($restaurantId: ID!, $orderId: ID!, $requestId: String!) {
    resolveCustomerServiceRequest(
      restaurantId: $restaurantId
      orderId: $orderId
      requestId: $requestId
    ) {
      ok
      message
    }
  }
`;

const REQUEST_EVENT_TYPES = new Set([
  "CUSTOMER_STAFF_CALL_REQUESTED",
  "CUSTOMER_PAYMENT_REQUESTED",
  "CUSTOMER_REQUEST_ACKNOWLEDGED",
  "CUSTOMER_REQUEST_RESOLVED",
]);

const FILTERS = [
  { key: null, label: "Tất cả" },
  { key: "STAFF_CALL", label: "Gọi nhân viên" },
  { key: "PAYMENT_REQUEST", label: "Thanh toán" },
];

const formatRequestTime = (value) => {
  if (!value) return "Vừa xong";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Vừa xong";
  return date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function CustomerRequestQueuePanel({ restaurantId, onOpenPayment }) {
  const [typeFilter, setTypeFilter] = useState(null);
  const [busyRequestId, setBusyRequestId] = useState(null);
  const [actionError, setActionError] = useState("");
  const shared = useMemo(
    () => ({ restaurantId, type: typeFilter, limit: 50 }),
    [restaurantId, typeFilter],
  );
  const pollInterval =
    restaurantId && process.env.NODE_ENV !== "test" ? 10000 : 0;
  const { data, refetch } = useQuery(Q, {
    variables: { ...shared, status: "PENDING" },
    skip: !restaurantId,
    fetchPolicy: "cache-and-network",
    pollInterval,
  });
  const { data: ackData, refetch: refetchAck } = useQuery(Q, {
    variables: { ...shared, status: "ACKNOWLEDGED" },
    skip: !restaurantId,
    fetchPolicy: "cache-and-network",
    pollInterval,
  });
  const [ack] = useMutation(ACK);
  const [resolve] = useMutation(RES);

  const pendingRows = data?.customerServiceRequests || [];
  const acknowledgedRows = ackData?.customerServiceRequests || [];
  const rows = [...pendingRows, ...acknowledgedRows];

  const refetchAll = useCallback(
    () => Promise.all([refetch(), refetchAck()]),
    [refetch, refetchAck],
  );

  useSocketOrder(restaurantId, {
    onAny: (event) => {
      if (REQUEST_EVENT_TYPES.has(String(event?.type || "").toUpperCase())) {
        void refetchAll();
      }
    },
  });

  const runAction = async (request, action) => {
    setActionError("");
    setBusyRequestId(request.requestId);
    try {
      await action();
      await refetchAll();
      return true;
    } catch (error) {
      setActionError(
        error?.message || "Không thể cập nhật yêu cầu. Vui lòng thử lại.",
      );
      return false;
    } finally {
      setBusyRequestId(null);
    }
  };

  const acknowledge = (request) =>
    runAction(request, async () => {
      const result = await ack({
        variables: {
          restaurantId,
          orderId: request.orderId,
          requestId: request.requestId,
        },
      });
      if (result?.data?.acknowledgeCustomerServiceRequest?.ok === false) {
        throw new Error(
          result.data.acknowledgeCustomerServiceRequest.message ||
            "Không thể nhận yêu cầu.",
        );
      }
    });

  const resolveRequest = (request) =>
    runAction(request, async () => {
      const result = await resolve({
        variables: {
          restaurantId,
          orderId: request.orderId,
          requestId: request.requestId,
        },
      });
      if (result?.data?.resolveCustomerServiceRequest?.ok === false) {
        throw new Error(
          result.data.resolveCustomerServiceRequest.message ||
            "Không thể hoàn tất yêu cầu.",
        );
      }
    });

  const acceptPaymentRequest = async (request) => {
    const accepted = await acknowledge(request);
    if (accepted) onOpenPayment?.(request.orderId);
  };

  if (!rows.length) return null;

  return (
    <section className={styles.panel} aria-labelledby="customer-request-queue-title">
      <header className={styles.header}>
        <div className={styles.headingIcon} aria-hidden="true">
          <BellRing size={19} />
        </div>
        <div className={styles.headingCopy}>
          <div className={styles.titleRow}>
            <h2 id="customer-request-queue-title">Yêu cầu từ khách</h2>
            <span className={styles.totalBadge}>{rows.length}</span>
          </div>
          <p>Chỉ chuyển sang đang xử lý khi có người bấm nhận.</p>
        </div>
      </header>

      <div className={styles.summary} aria-label="Trạng thái yêu cầu">
        <span className={styles.pendingSummary}>
          <Clock3 size={14} /> {pendingRows.length} chờ nhận
        </span>
        <span className={styles.acceptedSummary}>
          <CheckCircle2 size={14} /> {acknowledgedRows.length} đang xử lý
        </span>
      </div>

      <div className={styles.filters} aria-label="Lọc yêu cầu khách">
        {FILTERS.map((filter) => (
          <button
            key={filter.key || "all"}
            type="button"
            className={typeFilter === filter.key ? styles.activeFilter : ""}
            onClick={() => setTypeFilter(filter.key)}
            aria-pressed={typeFilter === filter.key}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {actionError ? (
        <p className={styles.error} role="alert">
          {actionError}
        </p>
      ) : null}

      <div className={styles.list} aria-live="polite">
        {rows.map((request) => {
          const isStaffCall = request.type === "STAFF_CALL";
          const isAcknowledged = request.status === "ACKNOWLEDGED";
          const isPending = request.status === "PENDING";
          const isBusy = busyRequestId === request.requestId;
          const Icon = isStaffCall ? HandHelping : CreditCard;

          return (
            <article
              key={request.requestId}
              className={`${styles.requestCard} ${
                isAcknowledged ? styles.acknowledgedCard : styles.pendingCard
              }`}
            >
              <div className={styles.requestTopline}>
                <div className={styles.requestTitle}>
                  <span className={styles.requestIcon} aria-hidden="true">
                    <Icon size={17} />
                  </span>
                  <div>
                    <h3>
                      {isStaffCall
                        ? "Khách cần hỗ trợ"
                        : "Khách yêu cầu thanh toán"}
                    </h3>
                    <p>
                      Bàn <strong>{request.tableCode || "Chưa rõ"}</strong>
                      {request.orderCode ? ` • #${request.orderCode}` : ""}
                    </p>
                  </div>
                </div>
                <span
                  className={
                    isAcknowledged
                      ? styles.acknowledgedStatus
                      : styles.pendingStatus
                  }
                >
                  {isAcknowledged ? "Đang xử lý" : "Chờ người nhận"}
                </span>
              </div>

              {request.message ? (
                <p className={styles.message}>{request.message}</p>
              ) : null}

              <div className={styles.requestFooter}>
                <span className={styles.time}>
                  <Clock3 size={13} /> {formatRequestTime(request.createdAt)}
                </span>
                <div className={styles.actions}>
                  {isStaffCall && isPending ? (
                    <button
                      type="button"
                      className={styles.primaryAction}
                      disabled={isBusy}
                      onClick={() => void acknowledge(request)}
                    >
                      {isBusy ? "Đang nhận..." : "Nhận xử lý"}
                    </button>
                  ) : null}

                  {isStaffCall && isAcknowledged ? (
                    <button
                      type="button"
                      className={styles.completeAction}
                      disabled={isBusy}
                      onClick={() => void resolveRequest(request)}
                    >
                      {isBusy ? "Đang lưu..." : "Đã hỗ trợ"}
                    </button>
                  ) : null}

                  {!isStaffCall && isPending ? (
                    <button
                      type="button"
                      className={styles.primaryAction}
                      disabled={isBusy}
                      onClick={() => void acceptPaymentRequest(request)}
                    >
                      {isBusy ? "Đang nhận..." : "Nhận thanh toán"}
                    </button>
                  ) : null}

                  {!isStaffCall && isAcknowledged ? (
                    <>
                      {onOpenPayment ? (
                        <button
                          type="button"
                          className={styles.secondaryAction}
                          disabled={isBusy}
                          onClick={() => onOpenPayment(request.orderId)}
                        >
                          Mở thanh toán
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className={styles.completeAction}
                        disabled={isBusy}
                        onClick={() => void resolveRequest(request)}
                      >
                        {isBusy ? "Đang lưu..." : "Đánh dấu đã xử lý"}
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
