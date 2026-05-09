export const ORDER_KIND = Object.freeze({
  TABLE_SESSION: "table_session",
  ORDER_BATCH: "order_batch",
  SPLIT_BILL: "split_bill",
});

export const SESSION_STATUS = Object.freeze({
  OPEN: "open",
  DINING: "dining",
  READY_TO_PAY: "ready_to_pay",
  CLOSED: "closed",
  CANCELLED: "cancelled",
});

export const KITCHEN_STATUS = Object.freeze({
  DRAFT: "draft",
  PENDING: "pending",
  CONFIRMED: "confirmed",
  CUSTOMER_ATTACHED: "customer_attached",
  PREPARING: "preparing",
  READY: "ready",
  SERVED: "served",
  CANCELLED: "cancelled",
  FAILED: "failed",
});

export const ORDER_PAYMENT_STATUS = Object.freeze({
  UNPAID: "unpaid",
  PAYMENT_REQUESTED: "payment_requested",
  PARTIAL: "partial",
  PAID: "paid",
  FAILED: "failed",
  REFUNDED: "refunded",
  PARTIALLY_REFUNDED: "partially_refunded",
});

export const SPLIT_STATUS = Object.freeze({
  NONE: "none",
  ROOT: "root",
  ROOT_HIDDEN: "root_hidden",
  PARTIAL: "partial",
});

function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase();
}

function isBlankStatus(value) {
  return value == null || String(value).trim() === "";
}


export const ACTIVE_SESSION_STATUSES = [
  SESSION_STATUS.OPEN,
  SESSION_STATUS.DINING,
  SESSION_STATUS.READY_TO_PAY,
];

export function buildActiveTableSessionKey({ restaurantId, tableId }) {
  if (!restaurantId || !tableId) return null;
  return `${String(restaurantId)}:${String(tableId)}:active`;
}

export function activeTableSessionKeyFilter({ restaurantId, tableId }) {
  const activeSessionKey = buildActiveTableSessionKey({ restaurantId, tableId });
  return activeSessionKey ? { activeSessionKey } : {};
}

export function orderBatchOrLegacyFilter() {
  return {
    $or: [
      { orderKind: ORDER_KIND.ORDER_BATCH },
      { orderKind: { $exists: false } },
      { orderKind: null },
    ],
  };
}

export function activeTableSessionFilter({ restaurantId, tableId }) {
  return {
    restaurantId,
    tableId,
    orderKind: ORDER_KIND.TABLE_SESSION,
    sessionStatus: { $in: ACTIVE_SESSION_STATUSES },
    orderPaymentStatus: { $ne: ORDER_PAYMENT_STATUS.PAID },
  };
}

const CLOSED_PAYMENT_STATUSES = new Set([
  ORDER_PAYMENT_STATUS.PAID,
  ORDER_PAYMENT_STATUS.REFUNDED,
  ORDER_PAYMENT_STATUS.PARTIALLY_REFUNDED,
]);

export function isTableSession(order) {
  return order?.orderKind === ORDER_KIND.TABLE_SESSION;
}

export function isOrderBatch(order) {
  return !order?.orderKind || order?.orderKind === ORDER_KIND.ORDER_BATCH;
}

export function isSplitBill(order) {
  return order?.orderKind === ORDER_KIND.SPLIT_BILL;
}

export function isSessionActive(order) {
  return (
    isTableSession(order) &&
    ["open", "dining", "ready_to_pay"].includes(
      String(order?.sessionStatus || ""),
    )
  );
}

export function isPaymentClosed(order) {
  const orderPaymentStatus = normalizeStatus(order?.orderPaymentStatus);

  if (
    !isBlankStatus(order?.orderPaymentStatus) &&
    orderPaymentStatus !== ORDER_PAYMENT_STATUS.UNPAID
  ) {
    return CLOSED_PAYMENT_STATUSES.has(orderPaymentStatus);
  }

  const legacyPaymentStatus = normalizeStatus(order?.payment?.status);
  return CLOSED_PAYMENT_STATUSES.has(legacyPaymentStatus);
}

export function isKitchenPayable(order) {
  if (!isOrderBatch(order)) return false;

  const kitchenStatus = normalizeStatus(order?.kitchenStatus);

  if (
    !isBlankStatus(order?.kitchenStatus) &&
    kitchenStatus !== KITCHEN_STATUS.PENDING
  ) {
    return kitchenStatus === KITCHEN_STATUS.SERVED;
  }

  const legacyStatus = normalizeStatus(order?.currentStatus);
  return legacyStatus === KITCHEN_STATUS.SERVED;
}
