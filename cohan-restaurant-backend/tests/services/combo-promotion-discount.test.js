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
const burgerId = new mongoose.Types.ObjectId();
const cokeId = new mongoose.Types.ObjectId();

const comboPromotion = (overrides = {}) => ({
  _id: "promo-combo",
  restaurantId,
  name: "Burger + Coke",
  isActive: true,
  scope: "ORDER",
  promotionType: "COMBO",
  comboItems: [
    { itemId: burgerId, quantity: 1 },
    { itemId: cokeId, quantity: 1 },
  ],
  discountType: "AMOUNT",
  discountValue: 10000,
  minOrderValue: 0,
  maxDiscount: 0,
  level: 1,
  startAt: new Date(Date.now() - 1000),
  endAt: new Date(Date.now() + 86400000),
  ...overrides,
});

const orderItems = (burgerQuantity, cokeQuantity, extra = {}) => [
  {
    _id: "line-burger",
    menuItemId: burgerId,
    dishId: burgerId,
    name: "Burger",
    quantity: burgerQuantity,
    lineSubtotal: 50000 * burgerQuantity,
    ...extra.burger,
  },
  {
    _id: "line-coke",
    menuItemId: cokeId,
    dishId: cokeId,
    name: "Coke",
    quantity: cokeQuantity,
    lineSubtotal: 20000 * cokeQuantity,
    ...extra.coke,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  Coupon.findOne.mockReturnValue(chain(null));
  CouponRedemption.countDocuments.mockReturnValue(chain(0));
  Invoice.countDocuments.mockReturnValue(chain(0));
  Order.countDocuments.mockReturnValue(chain(0));
  Promotion.find.mockReturnValue(chainList([]));
  Promotion.findOne.mockReturnValue(chain(comboPromotion()));
});

describe("COMBO promotion discount calculation", () => {
  it("applies COMBO discount when all required items are present", async () => {
    const result = await calculateDiscountBreakdown({
      restaurantId,
      promotionIds: ["promo-combo"],
      items: orderItems(1, 1),
      pricing: {},
    });

    expect(result.promotionDiscount).toBe(10000);
    expect(result.totalDiscount).toBe(10000);
    expect(result.appliedPromotions).toEqual(["promo-combo"]);
    expect(result.promotionLines[0]).toMatchObject({
      promotionId: "promo-combo",
      promotionType: "COMBO",
      comboCount: 1,
      comboBase: 70000,
      discount: 10000,
    });
  });

  it("applies combo multiple times", async () => {
    const result = await calculateDiscountBreakdown({
      restaurantId,
      promotionIds: ["promo-combo"],
      items: orderItems(2, 2),
      pricing: {},
    });

    expect(result.promotionDiscount).toBe(20000);
    expect(result.promotionLines[0]).toMatchObject({
      comboCount: 2,
      comboBase: 140000,
      discount: 20000,
    });
  });

  it("caps combo count by the limiting item", async () => {
    const result = await calculateDiscountBreakdown({
      restaurantId,
      promotionIds: ["promo-combo"],
      items: orderItems(3, 1),
      pricing: {},
    });

    expect(result.promotionDiscount).toBe(10000);
    expect(result.promotionLines[0]).toMatchObject({ comboCount: 1 });
  });

  it("does not apply when one combo item is missing", async () => {
    const result = await calculateDiscountBreakdown({
      restaurantId,
      promotionIds: ["promo-combo"],
      items: [orderItems(1, 0)[0]],
      pricing: {},
    });

    expect(result.promotionDiscount).toBe(0);
    expect(result.totalDiscount).toBe(0);
    expect(result.appliedPromotions).toEqual([]);
    expect(result.promotionLines).toEqual([]);
  });

  it("respects maxDiscount", async () => {
    Promotion.findOne.mockReturnValue(
      chain(
        comboPromotion({
          discountType: "PERCENT",
          discountValue: 50,
          maxDiscount: 20000,
        }),
      ),
    );

    const result = await calculateDiscountBreakdown({
      restaurantId,
      promotionIds: ["promo-combo"],
      items: orderItems(1, 1),
      pricing: {},
    });

    expect(result.promotionDiscount).toBe(20000);
    expect(result.promotionLines[0]).toMatchObject({
      discountType: "PERCENT",
      discountValue: 50,
      discount: 20000,
    });
  });

  it("ignores cancelled and returned lines", async () => {
    const result = await calculateDiscountBreakdown({
      restaurantId,
      promotionIds: ["promo-combo"],
      items: [
        ...orderItems(1, 1, {
          coke: { status: "cancelled" },
        }),
        {
          _id: "line-coke-returned",
          menuItemId: cokeId,
          name: "Coke returned",
          quantity: 1,
          lineSubtotal: 20000,
          status: "returned",
        },
      ],
      pricing: {},
    });

    expect(result.promotionDiscount).toBe(0);
    expect(result.appliedPromotions).toEqual([]);
    expect(result.promotionLines).toEqual([]);
  });
});
