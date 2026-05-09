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
  const status = String(
    order?.orderPaymentStatus || order?.payment?.status || "",
  ).toLowerCase();

  return ["paid", "refunded", "partially_refunded"].includes(status);
}

export function isKitchenPayable(order) {
  const status = String(order?.kitchenStatus || order?.currentStatus || "").toLowerCase();

  return status === "served";
}
