import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";

vi.mock("../../models/index.js", () => ({
  Coupon: { findOne: vi.fn() },
  Promotion: { findOne: vi.fn() },
}));

import { Coupon, Promotion } from "../../models/index.js";
import { calculateDiscountBreakdown } from "../../src/services/discountCalculation.service.js";

const chain = (doc) => ({ session: () => Promise.resolve(doc) });
const rid = new mongoose.Types.ObjectId();

beforeEach(() => vi.clearAllMocks());

describe("discount calculation business", () => {
  it("rejects expired coupon", async () => {
    Coupon.findOne.mockReturnValue(
      chain({ isActive: true, code: "A", endAt: new Date("2020-01-01") }),
    );
    await expect(
      calculateDiscountBreakdown({
        restaurantId: rid,
        items: [{ lineSubtotal: 100000 }],
        pricing: { voucherCode: "A" },
      }),
    ).rejects.toThrow(/not active/);
  });
  it("blocks stacking when promotion stacking=false even if coupon allows promotions", async () => {
    Coupon.findOne.mockReturnValue(
      chain({
        _id: "c1",
        isActive: true,
        discountType: "AMOUNT",
        discountValue: 10000,
        constraints: {
          stackable: true,
          combinableWithPromotions: true,
        },
      }),
    );

    Promotion.findOne.mockReturnValue(
      chain({
        _id: "p1",
        isActive: true,
        discountType: "AMOUNT",
        discountValue: 5000,
        stacking: false,
      }),
    );

    const result = await calculateDiscountBreakdown({
      restaurantId: rid,
      promotionIds: ["p1"],
      items: [{ lineSubtotal: 100000 }],
      pricing: { voucherCode: "A" },
    });

    expect(result.voucherDiscount).toBe(10000);
    expect(result.promotionDiscount).toBe(0);
    expect(result.totalDiscount).toBe(10000);
  });
  it("coupon exclusive=true keeps coupon discount and blocks promotion discount", async () => {
    Coupon.findOne.mockReturnValue(
      chain({
        _id: "c1",
        isActive: true,
        discountType: "AMOUNT",
        discountValue: 10000,
        constraints: {
          exclusive: true,
          combinableWithPromotions: true,
        },
      }),
    );

    Promotion.findOne.mockReturnValue(
      chain({
        _id: "p1",
        isActive: true,
        discountType: "AMOUNT",
        discountValue: 5000,
        stacking: true,
      }),
    );

    const result = await calculateDiscountBreakdown({
      restaurantId: rid,
      promotionIds: ["p1"],
      items: [{ lineSubtotal: 100000 }],
      pricing: { voucherCode: "A" },
    });

    expect(result.voucherDiscount).toBe(10000);
    expect(result.promotionDiscount).toBe(0);
    expect(result.totalDiscount).toBe(10000);
  });
  it("legacy promotion exclusive=true keeps promotion discount and skips voucher discount", async () => {
    Coupon.findOne.mockReturnValue(
      chain({
        _id: "c1",
        isActive: true,
        discountType: "AMOUNT",
        discountValue: 10000,
        constraints: {
          combinableWithPromotions: true,
        },
      }),
    );

    Promotion.findOne.mockReturnValue(
      chain({
        _id: "p1",
        isActive: true,
        discountType: "AMOUNT",
        discountValue: 5000,
        stacking: true,
        exclusive: true,
      }),
    );

    const result = await calculateDiscountBreakdown({
      restaurantId: rid,
      promotionIds: ["p1"],
      items: [{ lineSubtotal: 100000 }],
      pricing: { voucherCode: "A" },
    });

    expect(result.promotionDiscount).toBe(5000);
    expect(result.voucherDiscount).toBe(0);
    expect(result.appliedCoupons).toEqual([]);
    expect(result.totalDiscount).toBe(5000);
  });
  it("selects the highest priority or level promotion when multiple promotions are eligible", async () => {
    Coupon.findOne.mockReturnValue(chain(null));

    Promotion.findOne
      .mockReturnValueOnce(
        chain({
          _id: "p-low",
          isActive: true,
          discountType: "AMOUNT",
          discountValue: 3000,
          stacking: true,
          level: 1,
        }),
      )
      .mockReturnValueOnce(
        chain({
          _id: "p-high",
          isActive: true,
          discountType: "AMOUNT",
          discountValue: 5000,
          stacking: true,
          level: 3,
        }),
      );

    const result = await calculateDiscountBreakdown({
      restaurantId: rid,
      promotionIds: ["p-low", "p-high"],
      items: [{ lineSubtotal: 100000 }],
      pricing: {},
    });

    expect(result.appliedPromotions).toEqual(["p-high"]);
    expect(result.promotionDiscount).toBe(5000);
  });
  it("selects the highest priority or level promotion when multiple promotions are eligible", async () => {
    Coupon.findOne.mockReturnValue(chain(null));

    Promotion.findOne
      .mockReturnValueOnce(
        chain({
          _id: "p-low",
          isActive: true,
          discountType: "AMOUNT",
          discountValue: 3000,
          stacking: true,
          level: 1,
        }),
      )
      .mockReturnValueOnce(
        chain({
          _id: "p-high",
          isActive: true,
          discountType: "AMOUNT",
          discountValue: 5000,
          stacking: true,
          level: 3,
        }),
      );

    const result = await calculateDiscountBreakdown({
      restaurantId: rid,
      promotionIds: ["p-low", "p-high"],
      items: [{ lineSubtotal: 100000 }],
      pricing: {},
    });

    expect(result.appliedPromotions).toEqual(["p-high"]);
    expect(result.promotionDiscount).toBe(5000);
  });
  it("ignores client-provided discount totals and recalculates from backend documents", async () => {
    Coupon.findOne.mockReturnValue(
      chain({
        _id: "c1",
        isActive: true,
        discountType: "AMOUNT",
        discountValue: 10000,
        constraints: {
          combinableWithPromotions: false,
        },
      }),
    );

    Promotion.findOne.mockReturnValue(chain(null));

    const result = await calculateDiscountBreakdown({
      restaurantId: rid,
      items: [{ lineSubtotal: 100000 }],
      pricing: {
        voucherCode: "A",
        voucherDiscount: 999999,
        promotionDiscount: 999999,
        discount: 999999,
        finalTotal: 1,
        grandTotal: 1,
      },
    });

    expect(result.voucherDiscount).toBe(10000);
    expect(result.promotionDiscount).toBe(0);
    expect(result.totalDiscount).toBe(10000);
    expect(result.finalTotal).toBe(90000);
  });
  it("rejects coupon when minOrderValue is not met", async () => {
    Coupon.findOne.mockReturnValue(
      chain({
        _id: "c1",
        isActive: true,
        discountType: "AMOUNT",
        discountValue: 10000,
        minOrderValue: 200000,
        maxUsage: 0,
      }),
    );

    await expect(
      calculateDiscountBreakdown({
        restaurantId: rid,
        items: [{ lineSubtotal: 100000 }],
        pricing: { voucherCode: "A" },
      }),
    ).rejects.toThrow(/minimum order value/i);
  });
  it("rejects coupon when maxUsage has been reached", async () => {
    Coupon.findOne.mockReturnValue(
      chain({
        _id: "c1",
        isActive: true,
        discountType: "AMOUNT",
        discountValue: 10000,
        minOrderValue: 0,
        maxUsage: 5,
        used: 5,
      }),
    );

    await expect(
      calculateDiscountBreakdown({
        restaurantId: rid,
        items: [{ lineSubtotal: 100000 }],
        pricing: { voucherCode: "A" },
      }),
    ).rejects.toThrow(/usage limit reached/i);
  });
  it("percent coupon respects maxDiscount and total not negative", async () => {
    Coupon.findOne.mockReturnValue(
      chain({
        _id: "c1",
        isActive: true,
        discountType: "PERCENT",
        discountValue: 50,
        maxDiscount: 10000,
        minOrderValue: 0,
        maxUsage: 0,
      }),
    );
    Promotion.findOne.mockReturnValue(chain(null));
    const r = await calculateDiscountBreakdown({
      restaurantId: rid,
      items: [{ lineSubtotal: 100000 }],
      pricing: { voucherCode: "A" },
    });
    expect(r.voucherDiscount).toBe(10000);
    expect(r.finalTotal).toBeGreaterThanOrEqual(0);
  });

  it("combinableWithPromotions=false blocks promotion stack", async () => {
    Coupon.findOne.mockReturnValue(
      chain({
        _id: "c1",
        isActive: true,
        discountType: "AMOUNT",
        discountValue: 10000,
        constraints: { combinableWithPromotions: false },
      }),
    );
    Promotion.findOne.mockReturnValue(
      chain({
        _id: "p1",
        isActive: true,
        discountType: "AMOUNT",
        discountValue: 5000,
        stacking: true,
      }),
    );
    const r = await calculateDiscountBreakdown({
      restaurantId: rid,
      promotionIds: ["p1"],
      items: [{ lineSubtotal: 100000 }],
      pricing: { voucherCode: "A" },
    });
    expect(r.promotionDiscount).toBe(0);
  });

  it("stackable + combinableWithPromotions=true allows stacking", async () => {
    Coupon.findOne.mockReturnValue(
      chain({
        _id: "c1",
        isActive: true,
        discountType: "AMOUNT",
        discountValue: 10000,
        constraints: { stackable: true, combinableWithPromotions: true },
      }),
    );
    Promotion.findOne.mockReturnValue(
      chain({
        _id: "p1",
        isActive: true,
        discountType: "AMOUNT",
        discountValue: 5000,
        stacking: true,
      }),
    );
    const r = await calculateDiscountBreakdown({
      restaurantId: rid,
      promotionIds: ["p1"],
      items: [{ lineSubtotal: 100000 }],
      pricing: { voucherCode: "A" },
    });
    expect(r.promotionDiscount).toBe(5000);
    expect(r.totalDiscount).toBe(15000);
  });

  it("exclusive promotion blocks coupon discount", async () => {
    Coupon.findOne.mockReturnValue(
      chain({
        _id: "c1",
        isActive: true,
        discountType: "AMOUNT",
        discountValue: 10000,
        constraints: { combinableWithPromotions: true },
      }),
    );
    Promotion.findOne
      .mockReturnValueOnce(
        chain({
          _id: "p1",
          isActive: true,
          discountType: "AMOUNT",
          discountValue: 3000,
          exclusive: true,
          priority: 10,
        }),
      )
      .mockReturnValueOnce(
        chain({
          _id: "p2",
          isActive: true,
          discountType: "AMOUNT",
          discountValue: 5000,
          priority: 1,
        }),
      );
    const r = await calculateDiscountBreakdown({
      restaurantId: rid,
      promotionIds: ["p1", "p2"],
      items: [{ lineSubtotal: 100000 }],
      pricing: { voucherCode: "A" },
    });
    expect(r.promotionDiscount).toBe(3000);
    expect(r.voucherDiscount).toBe(0);
    expect(r.appliedCoupons).toEqual([]);
  });
});
