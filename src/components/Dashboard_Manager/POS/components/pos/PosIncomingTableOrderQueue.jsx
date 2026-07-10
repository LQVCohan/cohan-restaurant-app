import React, { useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { Check, ChevronDown, ClipboardList, X } from "lucide-react";

import useSocketOrder from "@/hooks/useSocketOrder";
import { useNotification } from "@/hooks/useNotification";

import styles from "./PosIncomingTableOrderQueue.module.scss";

const QR_ORDER_SOURCE = "customer_table_qr";

const POS_INCOMING_TABLE_ORDERS = gql`
  query PosIncomingTableOrders($restaurantId: ID!, $limit: Int) {
    ordersByRestaurantNow(restaurantId: $restaurantId, limit: $limit) {
      edges {
        node {
          id
          orderCode
          tableCode
          currentStatus
          createdAt
          note
          clientMeta
          totals { grandTotal }
          items {
            _id
            name
            quantity
            unit
            weightGrams
            note
            servingVariant { mode sellUnit }
          }
        }
      }
    }
  }
`;

const CONFIRM_POS_TABLE_ORDER = gql`
  mutation ConfirmPosTableOrder($input: ConfirmIncomingOrderInput!) {
    confirmIncomingOrder(input: $input) {
      order { id currentStatus updatedAt }
    }
  }
`;

const REJECT_POS_TABLE_ORDER = gql`
  mutation RejectPosTableOrder($input: RejectIncomingOrderInput!) {
    rejectIncomingOrder(input: $input) {
      order { id currentStatus updatedAt }
    }
  }
`;

const formatMoney = (value) =>
  `${Number(value || 0).toLocaleString("vi-VN")}đ`;

const formatQuantity = (item) => {
  const mode = String(item?.servingVariant?.mode || "").toUpperCase();
  if (mode === "BY_WEIGHT" || Number(item?.weightGrams || 0) > 0) {
    return `${Number(item?.weightGrams || 0).toLocaleString("vi-VN")} g dự kiến`;
  }
  const quantity = Number(item?.quantity || 0);
  const clean = Number.isInteger(quantity) ? quantity : quantity.toFixed(2);
  return `${clean} ${item?.unit || "phần"}`;
};

const getErrorMessage = (error, fallback) =>
  error?.graphQLErrors?.[0]?.message ||
  error?.networkError?.result?.errors?.[0]?.message ||
  error?.message ||
  fallback;

export default function PosIncomingTableOrderQueue({
  restaurantId,
  allowReject = true,
}) {
  const { showNotification } = useNotification();
  const [busyOrderId, setBusyOrderId] = useState("");
  const [rejectOrderId, setRejectOrderId] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [actionError, setActionError] = useState("");

  const { data, loading, refetch } = useQuery(POS_INCOMING_TABLE_ORDERS, {
    variables: { restaurantId, limit: 60 },
    skip: !restaurantId,
    fetchPolicy: "cache-and-network",
    pollInterval: 12000,
    notifyOnNetworkStatusChange: true,
  });
  const [confirmOrder] = useMutation(CONFIRM_POS_TABLE_ORDER);
  const [rejectOrder] = useMutation(REJECT_POS_TABLE_ORDER);

  useSocketOrder(restaurantId, {
    onCreated: (order) => {
      if (String(order?.clientMeta?.source || "").toLowerCase() === QR_ORDER_SOURCE) {
        void refetch?.();
      }
    },
    onUpdated: () => void refetch?.(),
    onCancelled: () => void refetch?.(),
  });

  const pendingOrders = useMemo(
    () =>
      (data?.ordersByRestaurantNow?.edges || [])
        .map((edge) => edge?.node)
        .filter(
          (order) =>
            order &&
            String(order.currentStatus || "").toLowerCase() === "pending" &&
            String(order.clientMeta?.source || "").toLowerCase() === QR_ORDER_SOURCE,
        )
        .sort(
          (left, right) =>
            new Date(left.createdAt || 0).getTime() -
            new Date(right.createdAt || 0).getTime(),
        ),
    [data?.ordersByRestaurantNow?.edges],
  );

  const handleConfirm = async (order) => {
    if (!order?.id || busyOrderId) return;
    setBusyOrderId(order.id);
    setActionError("");
    try {
      await confirmOrder({
        variables: { input: { id: order.id, restaurantId } },
      });
      showNotification(
        `Đã nhận order của bàn ${order.tableCode || "--"} và chuyển món vào bếp.`,
        "success",
      );
      await refetch?.();
    } catch (error) {
      const message = getErrorMessage(error, "Không thể nhận order này.");
      setActionError(message);
      showNotification(message, "error");
      await refetch?.();
    } finally {
      setBusyOrderId("");
    }
  };

  const handleReject = async (order) => {
    const reason = rejectReason.trim();
    if (!allowReject || !order?.id || busyOrderId) return;
    if (reason.length < 3) {
      setActionError("Vui lòng nhập lý do từ chối rõ ràng.");
      return;
    }

    setBusyOrderId(order.id);
    setActionError("");
    try {
      await rejectOrder({
        variables: {
          input: { id: order.id, restaurantId, reason },
        },
      });
      showNotification(
        `Đã từ chối order của bàn ${order.tableCode || "--"}. Tồn kho giữ cho order sẽ được hoàn lại.`,
        "warning",
      );
      setRejectOrderId("");
      setRejectReason("");
      await refetch?.();
    } catch (error) {
      const message = getErrorMessage(error, "Không thể từ chối order này.");
      setActionError(message);
      showNotification(message, "error");
      await refetch?.();
    } finally {
      setBusyOrderId("");
    }
  };

  if (!restaurantId) return null;

  return (
    <details className={styles.queue} open={pendingOrders.length > 0}>
      <summary className={styles.summary}>
        <span className={styles.summaryIcon} aria-hidden="true">
          <ClipboardList size={18} />
        </span>
        <span className={styles.summaryCopy}>
          <strong>Order QR chờ nhận</strong>
          <small>
            {loading && !pendingOrders.length
              ? "Đang kiểm tra…"
              : pendingOrders.length
                ? `${pendingOrders.length} order cần kiểm tra`
                : "Không có order QR đang chờ"}
          </small>
        </span>
        {pendingOrders.length ? (
          <span className={styles.count} aria-label={`${pendingOrders.length} order chờ nhận`}>
            {pendingOrders.length}
          </span>
        ) : null}
        <ChevronDown className={styles.chevron} aria-hidden="true" />
      </summary>

      <div className={styles.body} aria-live="polite">
        {actionError ? <p className={styles.error} role="alert">{actionError}</p> : null}
        {!pendingOrders.length ? (
          <p className={styles.empty}>Order khách gửi từ QR sẽ xuất hiện tại đây trước khi vào bếp.</p>
        ) : (
          pendingOrders.map((order) => {
            const isBusy = busyOrderId === order.id;
            const isRejecting = allowReject && rejectOrderId === order.id;
            return (
              <article className={styles.card} key={order.id}>
                <header className={styles.cardHeader}>
                  <div>
                    <span>Bàn</span>
                    <strong>{order.tableCode || "--"}</strong>
                  </div>
                  <div className={styles.cardMeta}>
                    <span>{order.orderCode}</span>
                    <strong>{formatMoney(order.totals?.grandTotal)}</strong>
                  </div>
                </header>

                <ul className={styles.items}>
                  {(order.items || []).map((item) => (
                    <li key={item._id || `${order.id}-${item.name}`}>
                      <div>
                        <strong>{item.name}</strong>
                        {item.note ? <small>{item.note}</small> : null}
                      </div>
                      <span>{formatQuantity(item)}</span>
                    </li>
                  ))}
                </ul>

                {order.note ? (
                  <p className={styles.note}><strong>Ghi chú:</strong> {order.note}</p>
                ) : null}

                {isRejecting ? (
                  <form
                    className={styles.rejectForm}
                    onSubmit={(event) => {
                      event.preventDefault();
                      void handleReject(order);
                    }}
                  >
                    <label htmlFor={`pos-reject-order-${order.id}`}>Lý do từ chối</label>
                    <textarea
                      id={`pos-reject-order-${order.id}`}
                      value={rejectReason}
                      onChange={(event) => setRejectReason(event.target.value.slice(0, 300))}
                      placeholder="Ví dụ: món đã hết, cần khách chọn lại…"
                      rows={2}
                      autoFocus
                      disabled={isBusy}
                    />
                    <div className={styles.actions}>
                      <button type="submit" className={styles.rejectConfirm} disabled={isBusy}>
                        <X size={16} aria-hidden="true" />
                        {isBusy ? "Đang từ chối…" : "Xác nhận từ chối"}
                      </button>
                      <button
                        type="button"
                        className={styles.secondary}
                        onClick={() => {
                          setRejectOrderId("");
                          setRejectReason("");
                          setActionError("");
                        }}
                        disabled={isBusy}
                      >
                        Hủy
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.accept}
                      onClick={() => void handleConfirm(order)}
                      disabled={Boolean(busyOrderId)}
                    >
                      <Check size={16} aria-hidden="true" />
                      {isBusy ? "Đang nhận…" : "Nhận & chuyển bếp"}
                    </button>
                    {allowReject ? (
                      <button
                        type="button"
                        className={styles.secondary}
                        onClick={() => {
                          setRejectOrderId(order.id);
                          setRejectReason("");
                          setActionError("");
                        }}
                        disabled={Boolean(busyOrderId)}
                      >
                        Từ chối
                      </button>
                    ) : null}
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>
    </details>
  );
}
