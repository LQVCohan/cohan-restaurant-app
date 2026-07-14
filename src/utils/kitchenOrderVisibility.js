export const TABLE_QR_ORDER_SOURCE = "customer_table_qr";

const SKIPPED_ITEM_STATUSES = new Set(["cancelled", "returned", "served"]);
const normalize = (value) => String(value || "").trim().toLowerCase();

export const requiresOrderItemProofImage = (item = {}) => {
  const mode = String(
    item?.servingVariant?.mode || item?.variant?.mode || "",
  ).toUpperCase();
  const unit = String(
    item?.unit ||
      item?.servingVariant?.sellUnit ||
      item?.variant?.sellUnit ||
      "",
  ).toLowerCase();

  return mode === "BY_WEIGHT" || unit === "kg" || Number(item?.weightGrams || 0) > 0;
};

export const isTableQrOrder = (order) => {
  const source = normalize(
    order?.clientMeta?.source ||
      order?.clientMeta?.clientSource ||
      order?.clientMeta?.channel,
  );
  return source === TABLE_QR_ORDER_SOURCE;
};

/**
 * QR tại bàn chỉ phải chờ nhân viên/POS khi đơn còn pending và có ít nhất
 * một món cần ảnh minh chứng. Đơn QR không có món cần ảnh được bếp nhận trực tiếp.
 */
export const isTableQrOrderAwaitingStaffConfirmation = (order) => {
  if (!order || !isTableQrOrder(order)) return false;
  if (normalize(order?.currentStatus) !== "pending") return false;

  return (Array.isArray(order?.items) ? order.items : []).some((item) => {
    const status = normalize(item?.status || "pending");
    return !SKIPPED_ITEM_STATUSES.has(status) && requiresOrderItemProofImage(item);
  });
};

/**
 * Các order chờ nhân viên vẫn phải hiện ở màn hình bếp để bếp biết đang chờ,
 * nhưng thao tác nhận sẽ bị khóa bởi UI và backend.
 */
export const filterKitchenVisibleOrders = (orders = []) =>
  Array.isArray(orders) ? orders : [];

export const isStaffKitchenWorkspacePath = (pathname) =>
  normalize(pathname).startsWith("/staff/kitchen");
