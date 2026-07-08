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
    label: "Đang bán",
    badgeClassName: "available",
    visibility: MENU_ITEM_VISIBILITY.CUSTOMER_VISIBLE,
    orderability: MENU_ITEM_ORDERABILITY.ORDERABLE,
    customerMessage: "Khách có thể đặt món này.",
    staffMessage: "Món đang được mở bán.",
  },
  out_of_stock: {
    label: "Hết món",
    badgeClassName: "out-of-stock",
    visibility: MENU_ITEM_VISIBILITY.CUSTOMER_VISIBLE,
    orderability: MENU_ITEM_ORDERABILITY.BLOCKED,
    customerMessage:
      "Món hiện đã hết. Bạn vẫn có thể xem chi tiết hoặc đăng ký nhận nhắc khi món có lại.",
    staffMessage:
      "Món đã hết. Hãy kiểm tra tồn kho và định lượng nguyên liệu trước khi mở bán lại.",
  },
  unavailable: {
    label: "Tạm ngưng bán",
    badgeClassName: "unavailable",
    visibility: MENU_ITEM_VISIBILITY.STAFF_ONLY,
    orderability: MENU_ITEM_ORDERABILITY.BLOCKED,
    customerMessage: "Món đang tạm ngưng phục vụ.",
    staffMessage: "Món đang tạm ngưng bán vì lý do vận hành.",
  },
  hidden: {
    label: "Ẩn khỏi thực đơn",
    badgeClassName: "hidden",
    visibility: MENU_ITEM_VISIBILITY.HIDDEN,
    orderability: MENU_ITEM_ORDERABILITY.BLOCKED,
    customerMessage: "Món không hiển thị trên thực đơn của khách.",
    staffMessage: "Món đang được ẩn khỏi thực đơn dành cho khách.",
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
      visibility: MENU_ITEM_VISIBILITY.CUSTOMER_VISIBLE,
      orderability: MENU_ITEM_ORDERABILITY.BLOCKED,
      customerMessage:
        "Món tạm hết nguyên liệu. Bạn vẫn có thể xem chi tiết hoặc đăng ký nhận nhắc khi món có lại.",
      staffMessage:
        stockWarnings[0] ||
        "Không đủ nguyên liệu để tiếp tục bán món này.",
    };
  }

  if (inventoryStatus === MENU_ITEM_INVENTORY_STATUS.LOW_STOCK) {
    return {
      label: "Nguyên liệu sắp hết",
      badgeClassName: "out-of-stock",
      visibility: MENU_ITEM_VISIBILITY.CUSTOMER_VISIBLE,
      orderability: MENU_ITEM_ORDERABILITY.ORDERABLE,
      customerMessage: "Món vẫn có thể đặt nhưng số lượng còn ít.",
      staffMessage:
        stockWarnings[0] ||
        "Nguyên liệu của món đang gần mức tồn kho tối thiểu.",
    };
  }

  if (inventoryStatus === MENU_ITEM_INVENTORY_STATUS.ERROR) {
    return {
      label: "Cần kiểm tra tồn kho",
      badgeClassName: "unavailable",
      visibility: MENU_ITEM_VISIBILITY.STAFF_ONLY,
      orderability: MENU_ITEM_ORDERABILITY.NEEDS_STOCK_CHECK,
      customerMessage: "Cần kiểm tra tồn kho trước khi bán món này.",
      staffMessage:
        stockWarnings[0] ||
        "Hệ thống chưa xác định được tồn kho của món.",
    };
  }

  return null;
};

export const getMenuItemAvailability = (item = {}) => {
  const status = item?.status || "unavailable";
  const inventoryOverride = getInventoryOverride(item);
  const baseRule =
    inventoryOverride || STATUS_RULES[status] || STATUS_RULES.unavailable;

  const hasRecipeVariants =
    Array.isArray(item?.servingVariants) && item.servingVariants.length > 0;
  const hasDefaultPrice = Number(item?.basePrice || 0) > 0;
  const hasSellableVariant = hasRecipeVariants
    ? item.servingVariants.some(
        (variant) => Number(variant?.price || 0) >= 0,
      )
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
    warnings.push(
      "Món chưa có cách chế biến và định lượng nguyên liệu để kiểm tra tồn kho chính xác.",
    );
  }

  return {
    status,
    inventoryStatus:
      item?.inventoryStatus || MENU_ITEM_INVENTORY_STATUS.NOT_TRACKED,
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
  getMenuItemAvailability(item).visibility ===
  MENU_ITEM_VISIBILITY.CUSTOMER_VISIBLE;

export const canCustomerOrderMenuItem = (item) =>
  getMenuItemAvailability(item).orderability ===
  MENU_ITEM_ORDERABILITY.ORDERABLE;
