import { describe, expect, it } from "vitest";

import { __testables, useCoupons } from "./useCoupons";

describe("useCoupons input builders", () => {
  it("exports the coupon hook directly", () => {
    expect(typeof useCoupons).toBe("function");
  });
  it("normalizes coupon datetime-local values to ISO in Vietnam timezone", () => {
    const input = __testables.buildCouponInput(
      {
        name: "Coupon food",
        code: "FOOD10",
        category: "food",
        discountType: "percent",
        discountValue: 10,
        publishAt: "2026-05-01T09:00",
        startDate: "2026-05-01T10:00",
        endDate: "2026-05-05T22:00",
        status: "active",
        conditions: ["Ap dung mon chinh"],
      },
      "restaurant-1",
    );

    expect(input).toEqual(
      expect.objectContaining({
        restaurantId: "restaurant-1",
        publishAt: "2026-05-01T02:00:00.000Z",
        startAt: "2026-05-01T03:00:00.000Z",
        endAt: "2026-05-05T15:00:00.000Z",
      }),
    );
  });
  it("preserves coupon stacking constraints in coupon input", () => {
    const input = __testables.buildCouponInput(
      {
        name: "Coupon stack",
        code: "STACK10",
        category: "order",
        discountType: "percent",
        discountValue: 10,
        status: "active",
        conditions: ["Ap dung don tu 100k"],
        stackable: true,
        combinableWithPromotions: true,
        exclusive: false,
        priority: 2,
      },
      "restaurant-1",
    );

    expect(input.constraints).toEqual({
      conditions: ["Ap dung don tu 100k"],
      stackable: true,
      combinableWithPromotions: true,
      exclusive: false,
      priority: 2,
    });
  });
  it("normalizes coupon stacking constraints from coupon constraints", () => {
    const coupon = __testables.normalizeCoupon({
      id: "coupon-1",
      name: "Coupon stack",
      code: "STACK10",
      discountType: "PERCENT",
      discountValue: 10,
      constraints: {
        conditions: ["Ap dung don tu 100k"],
        stackable: true,
        combinableWithPromotions: true,
        exclusive: true,
        priority: 3,
      },
    });

    expect(coupon).toEqual(
      expect.objectContaining({
        conditions: ["Ap dung don tu 100k"],
        stackable: true,
        combinableWithPromotions: true,
        exclusive: true,
        priority: 3,
      }),
    );
  });
  it("keeps coupon package ids and normalizes datetime-local values for package mutations", () => {
    const input = __testables.buildCouponPackageInput(
      {
        name: "Goi VIP",
        code: "VIP-01",
        couponIds: ["coupon-1", "coupon-2"],
        publishAt: "2026-05-01T09:00",
        startDate: "2026-05-01T10:00",
        endDate: "2026-05-05T22:00",
        status: "active",
      },
      "restaurant-1",
    );

    expect(input).toEqual(
      expect.objectContaining({
        restaurantId: "restaurant-1",
        voucherIds: ["coupon-1", "coupon-2"],
        publishAt: "2026-05-01T02:00:00.000Z",
        startAt: "2026-05-01T03:00:00.000Z",
        endAt: "2026-05-05T15:00:00.000Z",
      }),
    );
  });
});
