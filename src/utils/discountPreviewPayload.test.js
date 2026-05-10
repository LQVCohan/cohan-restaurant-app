import { describe, expect, it } from "vitest";
import {
  buildDiscountPricingInput,
  buildOrderDiscountPreviewInput,
  getDiscountBreakdownTotal,
  mapCartItemToOrderItemInput,
  mapDeliveryMethodToOrderType,
  normalizeVoucherCode,
} from "./discountPreviewPayload";

describe("discountPreviewPayload", () => {
  it("normalizes voucher code", () => {
    expect(normalizeVoucherCode("  stack10 ")).toBe("STACK10");
    expect(normalizeVoucherCode("")).toBeNull();
    expect(normalizeVoucherCode(null)).toBeNull();
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
      voucherCode: " sale10 ",
      voucherDiscount: 999999,
      promotionDiscount: 999999,
      finalTotal: 1,
    });

    expect(pricing).toEqual({
      taxRate: 0.1,
      serviceRate: 0.05,
      shippingFee: 15000,
      voucherCode: "SALE10",
    });

    expect(pricing).not.toHaveProperty("voucherDiscount");
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
      voucherCode: "v10",
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
