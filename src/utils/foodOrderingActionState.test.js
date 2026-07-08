import { describe, expect, it } from "vitest";
import {
  FOOD_ORDER_ACTION,
  getFoodOrderingActionState,
} from "./foodOrderingActionState";

const readyState = {
  hasRestaurant: true,
  restaurantCanOrder: true,
  hasSelectedVariant: true,
  hasLiveState: true,
  isAuthenticated: true,
  isCustomer: true,
};

describe("getFoodOrderingActionState", () => {
  it("guides incomplete modifiers instead of disabling the action", () => {
    expect(
      getFoodOrderingActionState({
        ...readyState,
        hasLiveState: false,
        modifierErrorMessage: "Vui lòng chọn kích cỡ.",
      }),
    ).toEqual({
      disabled: false,
      intent: FOOD_ORDER_ACTION.VALIDATE_MODIFIERS,
      label: "Hoàn tất tùy chọn",
    });
  });

  it("lets users reload modifier options after a request error", () => {
    expect(
      getFoodOrderingActionState({
        ...readyState,
        hasLiveState: false,
        modifierLoadError: true,
      }),
    ).toEqual({
      disabled: false,
      intent: FOOD_ORDER_ACTION.RETRY_MODIFIERS,
      label: "Tải lại tùy chọn",
    });
  });

  it("lets users retry after a stock request error", () => {
    expect(
      getFoodOrderingActionState({
        ...readyState,
        hasLiveState: false,
        liveError: true,
      }),
    ).toEqual({
      disabled: false,
      intent: FOOD_ORDER_ACTION.RETRY_STOCK,
      label: "Kiểm tra lại tồn kho",
    });
  });

  it("asks for login only when the dish is actually orderable", () => {
    expect(
      getFoodOrderingActionState({
        ...readyState,
        isAuthenticated: false,
        isCustomer: false,
      }),
    ).toEqual({
      disabled: false,
      intent: FOOD_ORDER_ACTION.LOGIN,
      label: "Đăng nhập để thêm vào giỏ",
    });
  });

  it("does not redirect unauthenticated users when the restaurant is closed", () => {
    expect(
      getFoodOrderingActionState({
        ...readyState,
        restaurantCanOrder: false,
        restaurantBlockedReason: "Nhà hàng đang đóng cửa",
        isAuthenticated: false,
        isCustomer: false,
      }),
    ).toEqual({
      disabled: true,
      intent: FOOD_ORDER_ACTION.BLOCKED,
      label: "Nhà hàng đang đóng cửa",
    });
  });

  it("blocks a sold-out dish for every viewer", () => {
    expect(
      getFoodOrderingActionState({
        ...readyState,
        outOfStock: true,
        isAuthenticated: false,
        isCustomer: false,
      }),
    ).toEqual({
      disabled: true,
      intent: FOOD_ORDER_ACTION.BLOCKED,
      label: "Món hiện đã hết",
    });
  });
});
