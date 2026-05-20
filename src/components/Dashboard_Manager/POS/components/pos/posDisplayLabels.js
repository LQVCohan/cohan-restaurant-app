export const VIRTUAL_TABLE_CODES = new Set([
  "TAKEAWAY",
  "DELIVERY",
  "REMOTE",
  "ONLINE",
]);

export const normalizeOrderType = (orderType) =>
  String(orderType || "")
    .trim()
    .toLowerCase();

export const isOffPremiseOrderType = (orderType) =>
  ["delivery", "takeaway", "remote", "online", "pickup"].includes(
    normalizeOrderType(orderType),
  );

export const isRealDineInOrderType = (orderType) =>
  normalizeOrderType(orderType) === "dine_in";

export const getVirtualTableCodeLabel = (tableCode) => {
  const normalizedCode = String(tableCode || "").trim().toUpperCase();
  if (normalizedCode === "DELIVERY") return "Giao hàng";
  if (normalizedCode === "TAKEAWAY") return "Mang đi";
  if (normalizedCode === "REMOTE" || normalizedCode === "ONLINE")
    return "Đặt từ xa";
  return "";
};

export const isRealTableCode = (orderType, tableCode) => {
  const normalizedCode = String(tableCode || "").trim().toUpperCase();
  return (
    isRealDineInOrderType(orderType) &&
    Boolean(normalizedCode) &&
    !VIRTUAL_TABLE_CODES.has(normalizedCode)
  );
};

export const getOrderTypeDisplayLabel = (orderType) => {
  switch (normalizeOrderType(orderType)) {
    case "delivery":
      return "Giao hàng";
    case "takeaway":
      return "Mang đi";
    case "pickup":
      return "Nhận tại quầy";
    case "remote":
    case "online":
      return "Đặt từ xa";
    case "dine_in":
      return "Tại bàn";
    default:
      return "Không gắn bàn";
  }
};

export const getPaymentRequestGroupLabel = (req) => {
  const normalizedOrderType = normalizeOrderType(req?.orderType);
  const safeTableCode = String(req?.tableCode || "").trim();
  const virtualTableLabel = getVirtualTableCodeLabel(safeTableCode);

  if (req?.isTableGroup && isRealTableCode(normalizedOrderType, safeTableCode)) {
    return `Bàn ${safeTableCode}`;
  }

  if (isOffPremiseOrderType(normalizedOrderType)) {
    return getOrderTypeDisplayLabel(normalizedOrderType);
  }

  return virtualTableLabel || req?.orderCode || req?.orderId || "Không gắn bàn";
};
