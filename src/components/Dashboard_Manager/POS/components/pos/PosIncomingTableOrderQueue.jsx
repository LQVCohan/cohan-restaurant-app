import React, { useContext, useEffect, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import {
  Camera,
  Check,
  ChevronDown,
  ClipboardList,
  ImageOff,
  KeyRound,
  RotateCcw,
  ShieldCheck,
  X,
} from "lucide-react";

import { AuthContext } from "@/context/AuthContext";
import StaffProofCaptureModal from "@/components/Staff/components/StaffProofCaptureModal";
import useSocketOrder from "@/hooks/useSocketOrder";
import { useNotification } from "@/hooks/useNotification";
import { hasAnyPermission } from "@/utils/frontendPermissionAccess";
import {
  isProofImageWaived,
  normalizeProofImages,
  requiresProofImage,
} from "@/utils/orderProofRules";

import styles from "./PosIncomingTableOrderQueue.module.scss";

const QR_ORDER_SOURCE = "customer_table_qr";
const REJECT_PERMISSIONS = ["order.cancel", "payment.write"];
const CUSTOMER_WAIVER_REASON = "Khách hàng xác nhận không cần ảnh minh chứng.";

const POS_INCOMING_TABLE_ORDERS = gql`
  query PosIncomingTableOrders($restaurantId: ID!, $limit: Int) {
    tableQrOrderAccessRequests(restaurantId: $restaurantId) {
      requestId
      requestLabel
      tableId
      tableCode
      requestedAt
      expiresAt
      confirmationCode
    }
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
            proofImages
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

const SET_POS_ORDER_ITEM_PROOF_WAIVER = gql`
  mutation SetPosOrderItemProofWaiver($input: SetOrderItemProofWaiverInput!) {
    setOrderItemProofWaiver(input: $input) {
      order { id clientMeta updatedAt }
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

const formatTime = (value) => {
  if (!value) return "--:--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getErrorMessage = (error, fallback) =>
  error?.graphQLErrors?.[0]?.message ||
  error?.networkError?.result?.errors?.[0]?.message ||
  error?.message ||
  fallback;

const requiresWeight = (item) =>
  String(item?.servingVariant?.mode || "").toUpperCase() === "BY_WEIGHT";

const hasValidWeight = (item) => {
  if (!requiresWeight(item)) return true;
  const grams = Number(item?.weightGrams);
  return Number.isInteger(grams) && grams > 0;
};

const getProofIssues = (order) => {
  const proofWaivers = order?.clientMeta?.proofWaivers || {};
  return (order?.items || []).flatMap((item) => {
    const proofRequired = requiresProofImage(item);
    const proofWaived = isProofImageWaived(item, proofWaivers);
    const missingProof =
      proofRequired &&
      !proofWaived &&
      normalizeProofImages(item?.proofImages).length === 0;
    const missingWeight = !hasValidWeight(item);
    return missingProof || missingWeight
      ? [{ item, missingProof, missingWeight, proofWaived }]
      : [];
  });
};

const getWaivedProofItems = (order) => {
  const proofWaivers = order?.clientMeta?.proofWaivers || {};
  return (order?.items || []).filter(
    (item) =>
      requiresProofImage(item) &&
      isProofImageWaived(item, proofWaivers) &&
      normalizeProofImages(item?.proofImages).length === 0,
  );
};

export default function PosIncomingTableOrderQueue({
  restaurantId,
  allowReject,
}) {
  const { user } = useContext(AuthContext) || {};
  const { showNotification } = useNotification();
  const canReject =
    typeof allowReject === "boolean"
      ? allowReject
      : hasAnyPermission(user, REJECT_PERMISSIONS);
  const [busyOrderId, setBusyOrderId] = useState("");
  const [waiverBusyItemId, setWaiverBusyItemId] = useState("");
  const [rejectOrderId, setRejectOrderId] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [revealedRequestId, setRevealedRequestId] = useState("");
  const [actionError, setActionError] = useState("");
  const [proofTarget, setProofTarget] = useState(null);

  const { data, loading, refetch } = useQuery(POS_INCOMING_TABLE_ORDERS, {
    variables: { restaurantId, limit: 200 },
    skip: !restaurantId,
    fetchPolicy: "cache-and-network",
    pollInterval: 12000,
    notifyOnNetworkStatusChange: true,
  });
  const [confirmOrder] = useMutation(CONFIRM_POS_TABLE_ORDER);
  const [rejectOrder] = useMutation(REJECT_POS_TABLE_ORDER);
  const [setProofWaiver] = useMutation(SET_POS_ORDER_ITEM_PROOF_WAIVER);

  useSocketOrder(restaurantId, {
    onAny: (event) => {
      if (
        [
          "TABLE_QR_ORDER_ACCESS_REQUESTED",
          "TABLE_QR_ORDER_ACCESS_CONFIRMED",
        ].includes(event?.type)
      ) {
        void refetch?.();
      }
    },
    onCreated: (order) => {
      if (String(order?.clientMeta?.source || "").toLowerCase() === QR_ORDER_SOURCE) {
        void refetch?.();
      }
    },
    onUpdated: () => void refetch?.(),
    onCancelled: () => void refetch?.(),
  });

  const accessRequests = useMemo(
    () =>
      [...(data?.tableQrOrderAccessRequests || [])].sort(
        (left, right) =>
          new Date(left?.requestedAt || 0).getTime() -
          new Date(right?.requestedAt || 0).getTime(),
      ),
    [data?.tableQrOrderAccessRequests],
  );

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

  const pendingCount = accessRequests.length + pendingOrders.length;
  const actionBusy = Boolean(busyOrderId || waiverBusyItemId);

  useEffect(() => {
    if (
      revealedRequestId &&
      !accessRequests.some(
        (request) => request.requestId === revealedRequestId,
      )
    ) {
      setRevealedRequestId("");
    }
  }, [accessRequests, revealedRequestId]);

  const openProofCapture = (order, item) => {
    if (!order?.id || !item?._id) return;
    setActionError("");
    setProofTarget({
      ...item,
      id: item._id,
      persisted: true,
      restaurantId,
      orderId: order.id,
      orderItemId: item._id,
    });
  };

  const handleSetProofWaiver = async (order, item, waived) => {
    if (!order?.id || !item?._id || actionBusy) return;
    const message = waived
      ? `Xác nhận khách hàng không cần ảnh minh chứng cho món ${item.name}? Thao tác này sẽ được ghi lại.`
      : `Yêu cầu lại ảnh minh chứng cho món ${item.name}?`;
    if (!window.confirm(message)) return;

    setWaiverBusyItemId(item._id);
    setActionError("");
    try {
      await setProofWaiver({
        variables: {
          input: {
            restaurantId,
            orderId: order.id,
            orderItemId: item._id,
            waived,
            reason: waived ? CUSTOMER_WAIVER_REASON : undefined,
          },
        },
      });
      showNotification(
        waived
          ? `Đã ghi nhận khách không cần ảnh cho ${item.name}.`
          : `Đã yêu cầu lại ảnh minh chứng cho ${item.name}.`,
        waived ? "warning" : "success",
      );
      await refetch?.();
    } catch (error) {
      const errorMessage = getErrorMessage(
        error,
        "Không thể cập nhật lựa chọn ảnh minh chứng.",
      );
      setActionError(errorMessage);
      showNotification(errorMessage, "error");
      await refetch?.();
    } finally {
      setWaiverBusyItemId("");
    }
  };

  const handleConfirm = async (order) => {
    if (!order?.id || actionBusy) return;

    const issues = getProofIssues(order);
    if (issues.length) {
      const details = issues
        .slice(0, 3)
        .map(({ item, missingProof, missingWeight }) => {
          const missing = [
            missingWeight ? "cân nặng" : null,
            missingProof ? "ảnh minh chứng" : null,
          ]
            .filter(Boolean)
            .join(" và ");
          return `${item.name}: thiếu ${missing}`;
        })
        .join("; ");
      setActionError(`Chưa thể chuyển bếp. ${details}.`);
      return;
    }

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
    if (!canReject || !order?.id || actionBusy) return;
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
    <>
      <details className={styles.queue} open={pendingCount > 0}>
        <summary className={styles.summary}>
          <span className={styles.summaryIcon} aria-hidden="true">
            <ClipboardList size={18} />
          </span>
          <span className={styles.summaryCopy}>
            <strong>QR tại bàn cần xử lý</strong>
            <small>
              {loading && !pendingCount
                ? "Đang kiểm tra…"
                : pendingCount
                  ? `${accessRequests.length} xác nhận · ${pendingOrders.length} order`
                  : "Không có yêu cầu QR đang chờ"}
            </small>
          </span>
          {pendingCount ? (
            <span className={styles.count} aria-label={`${pendingCount} yêu cầu QR đang chờ`}>
              {pendingCount}
            </span>
          ) : null}
          <ChevronDown className={styles.chevron} aria-hidden="true" />
        </summary>

        <div className={styles.body} aria-live="polite">
          {actionError ? <p className={styles.error} role="alert">{actionError}</p> : null}

          {accessRequests.map((request) => {
            const isRevealed = revealedRequestId === request.requestId;
            return (
              <article
                className={`${styles.card} ${styles.accessCard}`}
                key={request.requestId}
              >
                <header className={styles.accessHeader}>
                  <span className={styles.accessIcon} aria-hidden="true">
                    <ShieldCheck size={18} />
                  </span>
                  <div>
                    <span>Khách chờ xác nhận tại bàn</span>
                    <strong>Bàn {request.tableCode || "--"}</strong>
                  </div>
                  <em>#{request.requestLabel}</em>
                </header>

                <p className={styles.securityNote}>
                  Tới đúng bàn, yêu cầu khách mở màn hình có mã <strong>#{request.requestLabel}</strong>, rồi mới hiện và đọc mã 6 số.
                </p>

                <div className={styles.accessMeta}>
                  <span>Yêu cầu lúc {formatTime(request.requestedAt)}</span>
                  <span>Hết hạn {formatTime(request.expiresAt)}</span>
                </div>

                {isRevealed ? (
                  <div className={styles.confirmationCode} role="status">
                    <span>Mã xác nhận tại bàn</span>
                    <strong>{request.confirmationCode}</strong>
                    <small>Chỉ đọc cho khách đang cầm thiết bị có mã yêu cầu khớp.</small>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={styles.revealCode}
                    onClick={() => setRevealedRequestId(request.requestId)}
                  >
                    <KeyRound size={17} aria-hidden="true" />
                    Đã tới đúng bàn – hiện mã
                  </button>
                )}
              </article>
            );
          })}

          {pendingOrders.map((order) => {
            const isBusy = busyOrderId === order.id;
            const isRejecting = canReject && rejectOrderId === order.id;
            const issues = getProofIssues(order);
            const firstMissingProofItem =
              issues.find((issue) => issue.missingProof)?.item || null;
            const firstWaivedProofItem = getWaivedProofItems(order)[0] || null;
            const proofWaivers = order?.clientMeta?.proofWaivers || {};

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
                  {(order.items || []).map((item) => {
                    const proofImages = normalizeProofImages(item?.proofImages);
                    const proofRequired = requiresProofImage(item);
                    const proofWaived = isProofImageWaived(item, proofWaivers);
                    const weightMissing = !hasValidWeight(item);
                    return (
                      <li key={item._id || `${order.id}-${item.name}`}>
                        <div>
                          <strong>{item.name}</strong>
                          {item.note ? <small>{item.note}</small> : null}
                          {proofRequired ? (
                            <small>
                              {proofImages.length
                                ? `Đã có ${proofImages.length} ảnh minh chứng`
                                : proofWaived
                                  ? "Khách đã xác nhận không cần ảnh minh chứng"
                                  : "Cần ảnh minh chứng trước khi chuyển bếp"}
                            </small>
                          ) : null}
                          {weightMissing ? (
                            <small>Thiếu cân nặng thực tế, chưa thể chuyển bếp</small>
                          ) : null}
                        </div>
                        <span>{formatQuantity(item)}</span>
                      </li>
                    );
                  })}
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
                    {firstMissingProofItem ? (
                      <>
                        <button
                          type="button"
                          className={styles.secondary}
                          onClick={() => openProofCapture(order, firstMissingProofItem)}
                          disabled={actionBusy}
                        >
                          <Camera size={16} aria-hidden="true" />
                          Bổ sung ảnh {firstMissingProofItem.name}
                        </button>
                        <button
                          type="button"
                          className={styles.secondary}
                          onClick={() =>
                            void handleSetProofWaiver(order, firstMissingProofItem, true)
                          }
                          disabled={actionBusy}
                        >
                          <ImageOff size={16} aria-hidden="true" />
                          {waiverBusyItemId === firstMissingProofItem._id
                            ? "Đang ghi nhận…"
                            : `Khách không cần ảnh ${firstMissingProofItem.name}`}
                        </button>
                      </>
                    ) : null}
                    {!firstMissingProofItem && firstWaivedProofItem ? (
                      <button
                        type="button"
                        className={styles.secondary}
                        onClick={() =>
                          void handleSetProofWaiver(order, firstWaivedProofItem, false)
                        }
                        disabled={actionBusy}
                      >
                        <RotateCcw size={16} aria-hidden="true" />
                        Yêu cầu lại ảnh {firstWaivedProofItem.name}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={styles.accept}
                      onClick={() => void handleConfirm(order)}
                      disabled={actionBusy || issues.length > 0}
                    >
                      <Check size={16} aria-hidden="true" />
                      {isBusy ? "Đang nhận…" : "Nhận & chuyển bếp"}
                    </button>
                    {canReject ? (
                      <button
                        type="button"
                        className={styles.secondary}
                        onClick={() => {
                          setRejectOrderId(order.id);
                          setRejectReason("");
                          setActionError("");
                        }}
                        disabled={actionBusy}
                      >
                        Từ chối
                      </button>
                    ) : null}
                  </div>
                )}
              </article>
            );
          })}

          {!pendingCount ? (
            <p className={styles.empty}>
              Yêu cầu xác nhận tại bàn và order khách gửi từ QR sẽ xuất hiện tại đây.
            </p>
          ) : null}
        </div>
      </details>

      {proofTarget ? (
        <StaffProofCaptureModal
          open
          item={proofTarget}
          onClose={() => setProofTarget(null)}
          onSave={(images) => {
            setProofTarget(null);
            setActionError("");
            showNotification(
              `Đã lưu ${normalizeProofImages(images).length} ảnh minh chứng cho ${proofTarget.name}.`,
              "success",
            );
            void refetch?.();
          }}
        />
      ) : null}
    </>
  );
}
