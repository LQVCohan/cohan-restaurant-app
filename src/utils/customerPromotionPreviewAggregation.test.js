import { describe, expect, it } from "vitest";
import {
  aggregateCustomerPromotionBreakdowns,
  buildCustomerPromotionPreviewInput,
  resolveCheckoutGroupShippingFee,
} from "./customerPromotionPreviewAggregation";

describe("customerPromotionPreviewAggregation", () => {
  it("builds a server-priced preview input with cart hold references", () => {
    const input = buildCustomerPromotionPreviewInput({
      group: {
        restaurantId: "restaurant-1",
        items: [
          {
            id: "dish-1",
            name: "Phở bò",
            quantity: 2,
            backendCartId: "cart-1",
            backendCartItemId: "cart-item-1",
            selectedModifiers: [{ groupId: "g1", optionId: "o1" }],
          },
        ],
      },
      orderType: "delivery",
      paymentMethod: "wallet",
      couponCode: "SAVE10",
      shippingFee: 10000,
      groupCount: 3,
    });

    expect(input).toEqual(
      expect.objectContaining({
        restaurantId: "restaurant-1",
        orderType: "delivery",
        paymentMethod: "wallet",
        promotionIds: [],
        pricing: expect.objectContaining({
          taxRate: 0.1,
          serviceRate: 0,
          shippingFee: 3333,
          voucherCode: "SAVE10",
        }),
      }),
    );
    expect(input.items[0]).toEqual(
      expect.objectContaining({
        dishId: "dish-1",
        cartId: "cart-1",
        cartItemId: "cart-item-1",
        selectedModifiers: [{ groupId: "g1", optionId: "o1" }],
      }),
    );
  });

  it("mirrors backend shipping allocation rounding", () => {
    expect(
      resolveCheckoutGroupShippingFee({
        orderType: "delivery",
        shippingFee: 10000,
        groupCount: 3,
      }),
    ).toBe(3333);
    expect(
      resolveCheckoutGroupShippingFee({
        orderType: "takeaway",
        shippingFee: 10000,
        groupCount: 3,
      }),
    ).toBe(10000);
  });

  it("aggregates restaurant pricing without duplicating shipping fee", () => {
    const result = aggregateCustomerPromotionBreakdowns(
      [
        {
          subtotal: 120000,
          promotionDiscount: 20000,
          couponDiscount: 10000,
          tax: 9000,
          grandTotal: 99000,
          appliedPromotions: ["promo-1"],
        },
        {
          subtotal: 80000,
          promotionDiscount: 5000,
          voucherDiscount: 0,
          tax: 7500,
          grandTotal: 82500,
          appliedPromotions: ["promo-2", "promo-1"],
        },
      ],
      15000,
    );

    expect(result).toEqual({
      subtotal: 200000,
      promotionDiscount: 25000,
      couponDiscount: 10000,
      service: 0,
      tax: 16500,
      shippingFee: 15000,
      total: 196500,
      appliedPromotions: ["promo-1", "promo-2"],
    });
  });

  it("uses the same rounded multi-restaurant shipping total as checkout", () => {
    const result = aggregateCustomerPromotionBreakdowns(
      [{ grandTotal: 1000 }, { grandTotal: 2000 }, { grandTotal: 3000 }],
      10000,
    );

    expect(result.shippingFee).toBe(9999);
    expect(result.total).toBe(15999);
  });

  it("normalizes invalid numeric values and never returns a negative total", () => {
    const result = aggregateCustomerPromotionBreakdowns(
      [{ subtotal: "bad", grandTotal: -100, promotionDiscount: null }],
      -200,
    );

    expect(result.subtotal).toBe(0);
    expect(result.promotionDiscount).toBe(0);
    expect(result.shippingFee).toBe(0);
    expect(result.total).toBe(0);
  });
});
