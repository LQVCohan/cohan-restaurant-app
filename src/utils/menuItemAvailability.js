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

export const getMenuItemAvailability = (item = {}) => {
  const status = item?.status || "unavailable";
  const baseRule = STATUS_RULES[status] || STATUS_RULES.unavailable;

  const hasRecipeVariants =
    Array.isArray(item?.servingVariants) && item.servingVariants.length > 0;
  const hasDefaultPrice = Number(item?.basePrice || 0) > 0;
  const hasSellableVariant = hasRecipeVariants
    ? item.servingVariants.some((variant) => Number(variant?.price || 0) >= 0)
    : hasDefaultPrice;

  const warnings = [];

  if (status === "available" && !hasSellableVariant) {
    warnings.push("Món đang mở bán nhưng chưa có giá bán hợp lệ.");
  }

  if (status === "available" && !hasRecipeVariants) {
    warnings.push(
      "Món chưa có biến thể/recipe đầy đủ. Sau này nên liên kết tồn kho để tự gợi ý hết hàng.",
    );
  }

  return {
    status,
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
