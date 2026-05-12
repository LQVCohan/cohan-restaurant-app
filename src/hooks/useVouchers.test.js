import { describe, expect, it } from "vitest";

import { __testables, useCoupons, useVouchers } from "./useVouchers";

describe("useCoupons input builders", () => {
  it("keeps useVouchers as a backward-compatible alias", () => {
    expect(useVouchers).toBe(useCoupons);
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
    const voucher = __testables.normalizeVoucher({
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

    expect(voucher).toEqual(
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
    const input = __testables.buildPackageInput(
      {
        name: "Goi VIP",
        code: "VIP-01",
        voucherIds: ["voucher-1", "voucher-2"],
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
        voucherIds: ["voucher-1", "voucher-2"],
        publishAt: "2026-05-01T02:00:00.000Z",
        startAt: "2026-05-01T03:00:00.000Z",
        endAt: "2026-05-05T15:00:00.000Z",
      }),
    );
  });
});
