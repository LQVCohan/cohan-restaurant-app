import { describe, expect, it } from "vitest";
import { __testables } from "./useCoupons";

describe("useCoupons coupon constraint normalization", () => {
  it("normalizes advanced Coupon constraints", () => {
    const coupon = __testables.normalizeCoupon({
      id: "coupon-1",
      code: "SAVE20",
      discountType: "PERCENT",
      constraints: {
        conditions: ["Đơn tối thiểu"],
        stackable: true,
        combinableWithPromotions: true,
        exclusive: false,
        priority: 3,
        perUserLimit: 2,
        orderTypes: ["dine_in", "delivery"],
        paymentMethods: ["cash", "e_wallet"],
        firstOrderOnly: true,
      },
    });

    expect(coupon).toMatchObject({
      perUserLimit: 2,
      orderTypes: ["dine_in", "delivery"],
      paymentMethods: ["cash", "e_wallet"],
      firstOrderOnly: true,
      stackable: true,
      combinableWithPromotions: true,
      priority: 3,
    });
  });

  it("builds Coupon input with advanced constraints and existing stacking fields", () => {
    const input = __testables.buildCouponInput(
      {
        name: "Coupon A",
        code: "A",
        category: "order",
        description: "demo",
        discountType: "fixed",
        discountValue: 10000,
        minOrderValue: 50000,
        maxDiscount: 0,
        usageLimit: 100,
        conditions: ["Điều kiện"],
        stackable: true,
        combinableWithPromotions: false,
        exclusive: true,
        priority: 7,
        perUserLimit: 1,
        orderTypes: ["takeaway"],
        paymentMethods: ["card", "bank_transfer"],
        firstOrderOnly: true,
        status: "active",
      },
      "restaurant-1",
    );

    expect(input.constraints).toEqual({
      conditions: ["Điều kiện"],
      stackable: true,
      combinableWithPromotions: false,
      exclusive: true,
      priority: 7,
      perUserLimit: 1,
      orderTypes: ["takeaway"],
      paymentMethods: ["card", "bank_transfer"],
      firstOrderOnly: true,
      customerRanks: [],
    });
  });
});
