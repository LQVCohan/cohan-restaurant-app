export const MENU_ITEM_VISIBILITY = {
  CUSTOMER_VISIBLE: "customer_visible",
  STAFF_ONLY: "staff_only",
  HIDDEN: "hidden",
};

export const MENU_ITEM_ORDERABILITY = {
  ORDERABLE: "orderable",
  BLOCKED: "blocked",
  NEEDS_STOCK_CHECK: "needs_stock_check",
};

export const MENU_ITEM_INVENTORY_STATUS = {
  NOT_TRACKED: "NOT_TRACKED",
  IN_STOCK: "IN_STOCK",
  LOW_STOCK: "LOW_STOCK",
  OUT_OF_STOCK: "OUT_OF_STOCK",
  ERROR: "ERROR",
};

const STATUS_RULES = {
  available: {
    label: "Sẵn sàng",
    badgeClassName: "available",
    visibility: MENU_ITEM_VISIBILITY.CUSTOMER_VISIBLE,
    orderability: MENU_ITEM_ORDERABILITY.ORDERABLE,
    customerMessage: "Khách có thể đặt món này.",
    staffMessage: "Món đang mở bán.",
  },
  out_of_stock: {
    label: "Hết hàng",
    badgeClassName: "out-of-stock",
    visibility: MENU_ITEM_VISIBILITY.STAFF_ONLY,
    orderability: MENU_ITEM_ORDERABILITY.BLOCKED,
    customerMessage: "Tạm hết hàng, khách chưa thể đặt.",
    staffMessage: "Món hết hàng. Cần kiểm tra nguyên liệu hoặc recipe.",
  },
  unavailable: {
    label: "Tạm dừng",
    badgeClassName: "unavailable",
    visibility: MENU_ITEM_VISIBILITY.STAFF_ONLY,
    orderability: MENU_ITEM_ORDERABILITY.BLOCKED,
    customerMessage: "Món tạm dừng phục vụ.",
    staffMessage: "Món tạm dừng vì lý do vận hành.",
  },
  hidden: {
    label: "Ẩn khỏi menu",
    badgeClassName: "hidden",
    visibility: MENU_ITEM_VISIBILITY.HIDDEN,
    orderability: MENU_ITEM_ORDERABILITY.BLOCKED,
    customerMessage: "Món không hiển thị cho khách.",
    staffMessage: "Món đang bị ẩn khỏi menu khách hàng.",
  },
};

const normalizeStockWarnings = (item = {}) =>
  Array.isArray(item.stockWarnings)
    ? item.stockWarnings.filter(Boolean).map(String)
    : [];

const getInventoryOverride = (item = {}) => {
  if (item?.status !== "available") return null;

  const inventoryStatus = item?.inventoryStatus;
  const stockWarnings = normalizeStockWarnings(item);

  if (inventoryStatus === MENU_ITEM_INVENTORY_STATUS.OUT_OF_STOCK) {
    return {
      label: "Hết nguyên liệu",
      badgeClassName: "out-of-stock",
      visibility: MENU_ITEM_VISIBILITY.STAFF_ONLY,
      orderability: MENU_ITEM_ORDERABILITY.BLOCKED,
      customerMessage: "Món tạm hết nguyên liệu, khách chưa thể đặt.",
      staffMessage: stockWarnings[0] || "Món không đủ nguyên liệu để bán.",
    };
  }

  if (inventoryStatus === MENU_ITEM_INVENTORY_STATUS.LOW_STOCK) {
    return {
      label: "Sắp hết",
      badgeClassName: "out-of-stock",
      visibility: MENU_ITEM_VISIBILITY.CUSTOMER_VISIBLE,
      orderability: MENU_ITEM_ORDERABILITY.ORDERABLE,
      customerMessage: "Món vẫn đặt được nhưng số lượng còn ít.",
      staffMessage: stockWarnings[0] || "Nguyên liệu của món đang gần mức tối thiểu.",
    };
  }

  if (inventoryStatus === MENU_ITEM_INVENTORY_STATUS.ERROR) {
    return {
      label: "Cần kiểm kho",
      badgeClassName: "unavailable",
      visibility: MENU_ITEM_VISIBILITY.STAFF_ONLY,
      orderability: MENU_ITEM_ORDERABILITY.NEEDS_STOCK_CHECK,
      customerMessage: "Món cần kiểm tra tồn kho trước khi bán.",
      staffMessage: stockWarnings[0] || "Không thể kiểm tra tồn kho món.",
    };
  }

  return null;
};

export const getMenuItemAvailability = (item = {}) => {
  const status = item?.status || "unavailable";
  const inventoryOverride = getInventoryOverride(item);
  const baseRule = inventoryOverride || STATUS_RULES[status] || STATUS_RULES.unavailable;

  const hasRecipeVariants =
    Array.isArray(item?.servingVariants) && item.servingVariants.length > 0;
  const hasDefaultPrice = Number(item?.basePrice || 0) > 0;
  const hasSellableVariant = hasRecipeVariants
    ? item.servingVariants.some((variant) => Number(variant?.price || 0) >= 0)
    : hasDefaultPrice;

  const warnings = [];
  const stockWarnings = normalizeStockWarnings(item);

  if (inventoryOverride && stockWarnings.length) {
    warnings.push(...stockWarnings.slice(0, 2));
  }

  if (status === "available" && !hasSellableVariant) {
    warnings.push("Món đang mở bán nhưng chưa có giá bán hợp lệ.");
  }

  if (status === "available" && !hasRecipeVariants) {
    warnings.push("Món chưa có biến thể/recipe đầy đủ để kiểm tra tồn kho chính xác.");
  }

  return {
    status,
    inventoryStatus: item?.inventoryStatus || MENU_ITEM_INVENTORY_STATUS.NOT_TRACKED,
    maxAvailable: Number.isFinite(Number(item?.maxAvailable))
      ? Number(item.maxAvailable)
      : 0,
    ...baseRule,
    hasRecipeVariants,
    hasSellableVariant,
    warnings,
  };
};

export const shouldShowMenuItemToCustomer = (item) =>
  getMenuItemAvailability(item).visibility === MENU_ITEM_VISIBILITY.CUSTOMER_VISIBLE;

export const canCustomerOrderMenuItem = (item) =>
  getMenuItemAvailability(item).orderability === MENU_ITEM_ORDERABILITY.ORDERABLE;
