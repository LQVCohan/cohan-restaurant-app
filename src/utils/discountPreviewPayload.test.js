import { describe, expect, it } from "vitest";
import {
  buildDiscountPricingInput,
  buildOrderDiscountPreviewInput,
  getDiscountBreakdownTotal,
  mapCartItemToOrderItemInput,
  mapCartItemToReservationOrderItemInput,
  mapDeliveryMethodToOrderType,
  normalizeCouponCode,
} from "./discountPreviewPayload";

describe("discountPreviewPayload", () => {
  it("normalizes coupon code", () => {
    expect(normalizeCouponCode("  stack10 ")).toBe("STACK10");
    expect(normalizeCouponCode("")).toBeNull();
    expect(normalizeCouponCode(null)).toBeNull();
  });

  it("maps delivery method to order type", () => {
    expect(mapDeliveryMethodToOrderType("delivery")).toBe("delivery");
    expect(mapDeliveryMethodToOrderType("pickup")).toBe("takeaway");
    expect(mapDeliveryMethodToOrderType("dinein")).toBe("dine_in");
  });

  it("maps cart item to OrderItemInput shape", () => {
    const item = mapCartItemToOrderItemInput({
      id: "item-1",
      dishId: "dish-1",
      menuId: "menu-1",
      categoryId: "cat-1",
      name: "Phở bò",
      price: 100000,
      quantity: 2,
      modifiers: [{ groupId: "g1", optionId: "o1" }],
    });

    expect(item).toEqual(
      expect.objectContaining({
        dishId: "dish-1",
        menuId: "menu-1",
        categoryId: "cat-1",
        name: "Phở bò",
        basePrice: 100000,
        quantity: 2,
        servingKey: "portion",
      }),
    );

    expect(item.selectedModifiers).toEqual([{ groupId: "g1", optionId: "o1" }]);
  });

  it("builds safe pricing input without client discount totals", () => {
    const pricing = buildDiscountPricingInput({
      taxRate: 0.1,
      serviceRate: 0.05,
      shippingFee: 15000,
      couponCode: " sale10 ",
      couponDiscount: 999999,
      promotionDiscount: 999999,
      finalTotal: 1,
    });

    expect(pricing).toEqual({
      taxRate: 0.1,
      serviceRate: 0.05,
      shippingFee: 15000,
      voucherCode: "SALE10",
    });

    expect(pricing).not.toHaveProperty("couponDiscount");
    expect(pricing).not.toHaveProperty("promotionDiscount");
    expect(pricing).not.toHaveProperty("finalTotal");
  });

  it("builds preview input", () => {
    const input = buildOrderDiscountPreviewInput({
      restaurantId: "r1",
      orderType: "delivery",
      items: [{ dishId: "d1", name: "Món", price: 50000, quantity: 2 }],
      taxRate: 0.1,
      shippingFee: 10000,
      couponCode: "v10",
      promotionIds: ["p1"],
    });

    expect(input.restaurantId).toBe("r1");
    expect(input.pricing.voucherCode).toBe("V10");
    expect(input.promotionIds).toEqual(["p1"]);
    expect(input.items).toHaveLength(1);
  });

  it("returns backend breakdown payable total", () => {
    expect(getDiscountBreakdownTotal({ grandTotal: 90000 }, 100000)).toBe(
      90000,
    );
    expect(getDiscountBreakdownTotal({ finalTotal: 80000 }, 100000)).toBe(
      80000,
    );
    expect(getDiscountBreakdownTotal(null, 100000)).toBe(100000);
  });
});

describe("checkout/order payload safety", () => {
  it("does not leak analytics, FOR YOU local data, or hold refs unless explicitly requested", () => {
    const item = mapCartItemToOrderItemInput({
      id: "dish-1",
      name: "Phở bò",
      price: 70000,
      quantity: 1,
      backendCartId: "cart-1",
      backendCartItemId: "cart-item-1",
      analytics: { source: "for_you" },
      forYouReason: "preference",
      behaviorScore: 100,
      selectedModifiers: [{ groupId: "g1", optionId: "o1", label: "extra" }],
    });

    expect(item).toEqual(
      expect.objectContaining({
        dishId: "dish-1",
        menuId: "dish-1",
        selectedModifiers: [{ groupId: "g1", optionId: "o1" }],
      }),
    );
    expect(item).not.toHaveProperty("analytics");
    expect(item).not.toHaveProperty("forYouReason");
    expect(item).not.toHaveProperty("behaviorScore");
    expect(item).not.toHaveProperty("cartId");
    expect(item).not.toHaveProperty("cartItemId");
  });

  it("builds a schema-safe reservation add-on item with cart hold references", () => {
    const item = mapCartItemToReservationOrderItemInput({
      id: "dish-1",
      name: "Phở bò",
      price: 70000,
      backendCartId: "cart-1",
      backendCartItemId: "cart-item-1",
      analytics: { source: "for_you" },
    });

    expect(item).toEqual(
      expect.objectContaining({
        dishId: "dish-1",
        cartId: "cart-1",
        cartItemId: "cart-item-1",
      }),
    );
    expect(item).not.toHaveProperty("analytics");
    expect(item).not.toHaveProperty("restaurantId");
  });

  it("includes backend cart hold references only for checkout calls that opt in", () => {
    const item = mapCartItemToOrderItemInput(
      {
        id: "dish-1",
        name: "Phở bò",
        price: 70000,
        restaurantId: "restaurant-1",
        backendCartId: "cart-1",
        backendCartItemId: "cart-item-1",
      },
      { includeCartHoldRef: true },
    );

    expect(item.restaurantId).toBe("restaurant-1");
    expect(item.cartId).toBe("cart-1");
    expect(item.cartItemId).toBe("cart-item-1");
  });
});
