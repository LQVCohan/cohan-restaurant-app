export const FOOD_ORDER_ACTION = Object.freeze({
  ADD: "add",
  LOGIN: "login",
  VALIDATE_MODIFIERS: "validate_modifiers",
  RETRY_MODIFIERS: "retry_modifiers",
  RETRY_STOCK: "retry_stock",
  BLOCKED: "blocked",
});

export function getFoodOrderingActionState({
  adding = false,
  restaurantLoading = false,
  hasRestaurant = false,
  restaurantCanOrder = false,
  restaurantBlockedReason = "Nhà hàng hiện chưa nhận đơn",
  modifierLoading = false,
  modifierLoadError = false,
  modifierErrorMessage = "",
  hasSelectedVariant = false,
  liveLoading = false,
  liveError = false,
  hasLiveState = false,
  liveBlocked = false,
  outOfStock = false,
  quantityExceedsAvailable = false,
  isAuthenticated = false,
  isCustomer = false,
} = {}) {
  if (adding) {
    return {
      disabled: true,
      intent: FOOD_ORDER_ACTION.BLOCKED,
      label: "Đang giữ món…",
    };
  }
  if (restaurantLoading) {
    return {
      disabled: true,
      intent: FOOD_ORDER_ACTION.BLOCKED,
      label: "Đang kiểm tra nhà hàng…",
    };
  }
  if (!hasRestaurant) {
    return {
      disabled: true,
      intent: FOOD_ORDER_ACTION.BLOCKED,
      label: "Nhà hàng không khả dụng",
    };
  }
  if (!restaurantCanOrder) {
    return {
      disabled: true,
      intent: FOOD_ORDER_ACTION.BLOCKED,
      label: restaurantBlockedReason || "Nhà hàng hiện chưa nhận đơn",
    };
  }
  if (modifierLoading) {
    return {
      disabled: true,
      intent: FOOD_ORDER_ACTION.BLOCKED,
      label: "Đang tải tùy chọn…",
    };
  }
  if (modifierLoadError) {
    return {
      disabled: false,
      intent: FOOD_ORDER_ACTION.RETRY_MODIFIERS,
      label: "Tải lại tùy chọn",
    };
  }
  if (!hasSelectedVariant) {
    return {
      disabled: true,
      intent: FOOD_ORDER_ACTION.BLOCKED,
      label: "Chưa có khẩu phần khả dụng",
    };
  }
  if (liveBlocked) {
    return {
      disabled: true,
      intent: FOOD_ORDER_ACTION.BLOCKED,
      label: "Tạm chặn giữ món",
    };
  }
  if (outOfStock) {
    return {
      disabled: true,
      intent: FOOD_ORDER_ACTION.BLOCKED,
      label: "Món hiện đã hết",
    };
  }
  if (quantityExceedsAvailable) {
    return {
      disabled: true,
      intent: FOOD_ORDER_ACTION.BLOCKED,
      label: "Số lượng vượt quá tồn kho",
    };
  }
  if (modifierErrorMessage) {
    return {
      disabled: false,
      intent: FOOD_ORDER_ACTION.VALIDATE_MODIFIERS,
      label: "Hoàn tất tùy chọn",
    };
  }
  if (liveError) {
    return {
      disabled: false,
      intent: FOOD_ORDER_ACTION.RETRY_STOCK,
      label: "Kiểm tra lại tồn kho",
    };
  }
  if (liveLoading || !hasLiveState) {
    return {
      disabled: true,
      intent: FOOD_ORDER_ACTION.BLOCKED,
      label: "Đang kiểm tra tồn kho…",
    };
  }
  if (!isAuthenticated || !isCustomer) {
    return {
      disabled: false,
      intent: FOOD_ORDER_ACTION.LOGIN,
      label: "Đăng nhập để thêm vào giỏ",
    };
  }

  return {
    disabled: false,
    intent: FOOD_ORDER_ACTION.ADD,
    label: "Thêm vào giỏ",
  };
}
