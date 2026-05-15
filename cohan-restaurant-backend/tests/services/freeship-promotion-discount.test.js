import { beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";

vi.mock("../../models/index.js", () => ({
  Coupon: { findOne: vi.fn() },
  CouponRedemption: { countDocuments: vi.fn() },
  Invoice: { countDocuments: vi.fn() },
  Order: { countDocuments: vi.fn() },
  Promotion: {
    find: vi.fn(),
    findOne: vi.fn(),
  },
}));

import {
  Coupon,
  CouponRedemption,
  Invoice,
  Order,
  Promotion,
} from "../../models/index.js";
import { calculateDiscountBreakdown } from "../../src/services/discountCalculation.service.js";

const chain = (doc) => ({ session: () => Promise.resolve(doc) });
const chainList = (docs = []) => ({ session: () => Promise.resolve(docs) });
const restaurantId = new mongoose.Types.ObjectId();

beforeEach(() => {
  vi.clearAllMocks();
  Coupon.findOne.mockReturnValue(chain(null));
  CouponRedemption.countDocuments.mockReturnValue(chain(0));
  Invoice.countDocuments.mockReturnValue(chain(0));
  Order.countDocuments.mockReturnValue(chain(0));
  Promotion.find.mockReturnValue(chainList([]));
  Promotion.findOne.mockReturnValue(chain(null));
});

const freeshipPromotion = (overrides = {}) => ({
  _id: "promo-freeship",
  restaurantId,
  isActive: true,
  scope: "ORDER",
  promotionType: "FREESHIP",
  minOrderValue: 0,
  maxDiscount: 0,
  level: 1,
  ...overrides,
});

describe("FREESHIP promotion discount calculation", () => {
  it("discounts the full shipping fee", async () => {
    Promotion.findOne.mockReturnValue(chain(freeshipPromotion()));

    const result = await calculateDiscountBreakdown({
      restaurantId,
      promotionIds: ["promo-freeship"],
      items: [{ lineSubtotal: 100000 }],
      pricing: { shippingFee: 20000 },
    });

    expect(result.promotionDiscount).toBe(0);
    expect(result.shippingDiscount).toBe(20000);
    expect(result.totalDiscount).toBe(20000);
    expect(result.grandTotal).toBe(100000);
    expect(result.appliedPromotions).toEqual(["promo-freeship"]);
  });

  it("respects maxDiscount", async () => {
    Promotion.findOne.mockReturnValue(
      chain(freeshipPromotion({ maxDiscount: 15000 })),
    );

    const result = await calculateDiscountBreakdown({
      restaurantId,
      promotionIds: ["promo-freeship"],
      items: [{ lineSubtotal: 100000 }],
      pricing: { shippingFee: 30000 },
    });

    expect(result.promotionDiscount).toBe(0);
    expect(result.shippingDiscount).toBe(15000);
    expect(result.totalDiscount).toBe(15000);
    expect(result.grandTotal).toBe(115000);
    expect(result.appliedPromotions).toEqual(["promo-freeship"]);
  });

  it("does not apply when minOrderValue is not met", async () => {
    Promotion.findOne.mockReturnValue(
      chain(freeshipPromotion({ minOrderValue: 200000 })),
    );

    const result = await calculateDiscountBreakdown({
      restaurantId,
      promotionIds: ["promo-freeship"],
      items: [{ lineSubtotal: 100000 }],
      pricing: { shippingFee: 20000 },
    });

    expect(result.promotionDiscount).toBe(0);
    expect(result.shippingDiscount).toBe(0);
    expect(result.totalDiscount).toBe(0);
    expect(result.grandTotal).toBe(120000);
    expect(result.appliedPromotions).toEqual([]);
  });
});
