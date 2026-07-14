const ACTIVE_ITEM_STATUSES = new Set([
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "cooking",
]);

const hasPendingRequest = (requests = []) =>
  (requests || []).some(
    (request) => String(request?.status || "").toLowerCase() === "pending",
  );

export function getStaffCartCheckoutReadiness(cart = []) {
  const items = Array.isArray(cart) ? cart : [];

  if (!items.length) {
    return {
      enabled: false,
      label: "Thanh toán",
      reason: "Chưa có món trong đơn.",
    };
  }

  const hasUnsentItems = items.some(
    (item) => !item?.persisted || !item?.orderId,
  );
  if (hasUnsentItems) {
    return {
      enabled: false,
      label: "Gửi đơn trước",
      reason:
        "Hãy gửi các món đang chọn vào hệ thống trước khi yêu cầu thanh toán.",
    };
  }

  const hasActiveItemWork = items.some((item) =>
    ACTIVE_ITEM_STATUSES.has(String(item?.status || "").toLowerCase()),
  );
  if (hasActiveItemWork) {
    return {
      enabled: false,
      label: "Chờ phục vụ",
      reason:
        "Chỉ có thể yêu cầu thanh toán sau khi tất cả món đã phục vụ xong.",
    };
  }

  const hasPendingAdjustments = items.some(
    (item) =>
      hasPendingRequest(item?.voidRequests) ||
      hasPendingRequest(item?.returnRequests),
  );
  if (hasPendingAdjustments) {
    return {
      enabled: false,
      label: "Chờ xử lý",
      reason:
        "Chưa thể thanh toán khi còn yêu cầu hủy hoặc trả món đang chờ xử lý.",
    };
  }

  return {
    enabled: true,
    label: "Thanh toán",
    reason: "",
  };
}
