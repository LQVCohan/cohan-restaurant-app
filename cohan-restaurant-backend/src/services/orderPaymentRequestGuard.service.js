const ACTIVE_ITEM_WORK_STATUSES = new Set(["pending", "confirmed", "preparing", "ready"]);
const TERMINAL_ORDER_STATUSES = new Set(["cancelled", "completed", "failed"]);
const NON_REQUESTABLE_PAYMENT_STATUSES = new Set(["payment_requested", "paid", "failed", "refunded", "partially_refunded"]);
const REQUESTABLE_PAYMENT_STATUSES = new Set(["unpaid", "partial"]);

export function normalizeOrderPaymentStatus(order = {}) {
  return String(order?.orderPaymentStatus || order?.payment?.status || "unpaid").toLowerCase();
}

export function hasPendingOrderItemWork(order = {}) {
  return (order?.items || []).some((item) => ACTIVE_ITEM_WORK_STATUSES.has(String(item?.status || "").toLowerCase()));
}

export function hasPendingOrderAdjustmentRequests(order = {}) {
  return (order?.items || []).some((item) => {
    const hasPendingVoid = (item?.voidRequests || []).some((request) => String(request?.status || "").toLowerCase() === "pending");
    const hasPendingReturn = (item?.returnRequests || []).some((request) => String(request?.status || "").toLowerCase() === "pending");
    return hasPendingVoid || hasPendingReturn;
  });
}

export function getOrderPaymentRequestBlockReason(order = {}) {
  if (!order) return "Order not found";
  const orderStatus = String(order?.currentStatus || "").toLowerCase();
  if (TERMINAL_ORDER_STATUSES.has(orderStatus)) return "ORDER_ALREADY_CLOSED";
  const paymentStatus = normalizeOrderPaymentStatus(order);
  if (paymentStatus === "paid") return "ORDER_ALREADY_PAID";
  if (paymentStatus === "payment_requested") return "PAYMENT_REQUEST_ALREADY_SENT";
  if (NON_REQUESTABLE_PAYMENT_STATUSES.has(paymentStatus)) return "PAYMENT_STATUS_NOT_REQUESTABLE";
  if (hasPendingOrderItemWork(order)) return "ORDER_ITEMS_NOT_SERVED";
  if (hasPendingOrderAdjustmentRequests(order)) return "PENDING_ADJUSTMENT_REQUESTS";
  if (!REQUESTABLE_PAYMENT_STATUSES.has(paymentStatus)) return "PAYMENT_STATUS_NOT_REQUESTABLE";
  return null;
}

export function getOrderPaymentRequestBlockMessage(reason) {
  switch (reason) {
    case "ORDER_ALREADY_CLOSED":
      return "Đơn đã kết thúc, không thể yêu cầu thanh toán.";
    case "ORDER_ALREADY_PAID":
      return "Đơn hàng đã thanh toán.";
    case "PAYMENT_REQUEST_ALREADY_SENT":
      return "Yêu cầu thanh toán đã được gửi trước đó.";
    case "ORDER_ITEMS_NOT_SERVED":
      return "Không thể yêu cầu thanh toán khi còn món chưa phục vụ xong.";
    case "PENDING_ADJUSTMENT_REQUESTS":
      return "Không thể yêu cầu thanh toán khi còn yêu cầu hủy/trả món đang chờ duyệt.";
    case "PAYMENT_STATUS_NOT_REQUESTABLE":
    default:
      return "Hiện chưa thể yêu cầu thanh toán cho đơn này.";
  }
}

export function canOrderRequestPayment(order = {}) {
  return !getOrderPaymentRequestBlockReason(order);
}

export function assertOrderCanRequestPayment(order = {}) {
  const reason = getOrderPaymentRequestBlockReason(order);
  if (reason) throw new Error(getOrderPaymentRequestBlockMessage(reason));
}
