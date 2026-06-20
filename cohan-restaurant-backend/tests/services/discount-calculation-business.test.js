import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";
vi.mock("../../models/index.js", () => ({
  Category: { find: vi.fn() },
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
  Category,
  Coupon,
  CouponRedemption,
  Invoice,
  Order,
  Promotion,
} from "../../models/index.js";
import { calculateDiscountBreakdown } from "../../src/services/discountCalculation.service.js";

const chain = (doc) => ({ session: () => Promise.resolve(doc) });
const chainList = (docs = []) => ({
  session: () => Promise.resolve(docs),
});
const rid = new mongoose.Types.ObjectId();

beforeEach(() => {
  vi.clearAllMocks();
  Promotion.find.mockReturnValue(chainList([]));
  Category.find.mockReturnValue(chainList([]));
  CouponRedemption.countDocuments.mockReturnValue(chain(0));
  Invoice.countDocuments.mockReturnValue(chain(0));
  Order.countDocuments.mockReturnValue(chain(0));
});

describe("discount calculation business", () => {
  it("allows coupon when order type matches constraint", async () => {
    Coupon.findOne.mockReturnValue(
      chain({
        _id: "c1",
        isActive: true,
        discountType: "AMOUNT",
        discountValue: 10000,
        constraints: { orderTypes: ["delivery"] },
      }),
    );

    const result = await calculateDiscountBreakdown({
      restaurantId: rid,
      items: [{ lineSubtotal: 100000 }],
      pricing: { voucherCode: "A" },
      orderType: "delivery",
    });

    expect(result.voucherDiscount).toBe(10000);
  });

  it("rejects coupon when order type does not match constraint", async () => {
    Coupon.findOne.mockReturnValue(
      chain({
        _id: "c1",
        isActive: true,
        discountType: "AMOUNT",
        discountValue: 10000,
        constraints: { orderTypes: ["delivery"] },
      }),
    );

    await expect(
      calculateDiscountBreakdown({
        restaurantId: rid,
        items: [{ lineSubtotal: 100000 }],
        pricing: { voucherCode: "A" },
        orderType: "dine_in",
      }),
    ).rejects.toThrow(/Invalid coupon: order type is not eligible/);
  });

  it("allows coupon when payment method matches constraint", async () => {
    Coupon.findOne.mockReturnValue(
      chain({
        _id: "c1",
        isActive: true,
        discountType: "AMOUNT",
        discountValue: 10000,
        constraints: { paymentMethods: ["card"] },
      }),
    );

    const result = await calculateDiscountBreakdown({
      restaurantId: rid,
      items: [{ lineSubtotal: 100000 }],
      pricing: { voucherCode: "A" },
      paymentMethod: "card",
    });

    expect(result.voucherDiscount).toBe(10000);
  });

  it("rejects coupon when payment method does not match constraint", async () => {
    Coupon.findOne.mockReturnValue(
      chain({
        _id: "c1",
        isActive: true,
        discountType: "AMOUNT",
        discountValue: 10000,
        constraints: { paymentMethods: ["cash"] },
      }),
    );

    await expect(
      calculateDiscountBreakdown({
        restaurantId: rid,
        items: [{ lineSubtotal: 100000 }],
        pricing: { voucherCode: "A" },
        paymentMethod: "card",
      }),
    ).rejects.toThrow(/Invalid coupon: payment method is not eligible/);
  });

  it("rejects first-order-only coupon when userId is missing", async () => {
    Coupon.findOne.mockReturnValue(
      chain({
        _id: "c1",
        isActive: true,
        discountType: "AMOUNT",
        discountValue: 10000,
        constraints: { firstOrderOnly: true },
      }),
    );

    await expect(
      calculateDiscountBreakdown({
        restaurantId: rid,
        items: [{ lineSubtotal: 100000 }],
        pricing: { voucherCode: "A" },
      }),
    ).rejects.toThrow(
      /Invalid coupon: first-order eligibility requires an authenticated customer/,
    );
  });

  it("rejects first-order-only coupon when customer has paid order history", async () => {
    const userId = new mongoose.Types.ObjectId();
    Order.countDocuments.mockReturnValue(chain(1));
    Coupon.findOne.mockReturnValue(
      chain({
        _id: "c1",
        isActive: true,
        discountType: "AMOUNT",
        discountValue: 10000,
        constraints: { firstOrderOnly: true },
      }),
    );

    await expect(
      calculateDiscountBreakdown({
        restaurantId: rid,
        userId,
        items: [{ lineSubtotal: 100000 }],
        pricing: { voucherCode: "A" },
      }),
    ).rejects.toThrow(
      /Invalid coupon: only valid for the customer's first order/,
    );
  });

  it("enforces per-user limit after eligibility refactor", async () => {
    const userId = new mongoose.Types.ObjectId();
    CouponRedemption.countDocuments.mockReturnValue(chain(2));
    Coupon.findOne.mockReturnValue(
      chain({
        _id: "c1",
        isActive: true,
        discountType: "AMOUNT",
        discountValue: 10000,
        constraints: { perUserLimit: 2 },
      }),
    );

    await expect(
      calculateDiscountBreakdown({
        restaurantId: rid,
        userId,
        items: [{ lineSubtotal: 100000 }],
        pricing: { voucherCode: "A" },
      }),
    ).rejects.toThrow(/Invalid coupon: per-user usage limit reached/);
  });

  it("treats missing constraint arrays as unrestricted", async () => {
    Coupon.findOne.mockReturnValue(
      chain({
        _id: "c1",
        isActive: true,
        discountType: "AMOUNT",
        discountValue: 10000,
      }),
    );

    const result = await calculateDiscountBreakdown({
      restaurantId: rid,
      items: [{ lineSubtotal: 100000 }],
      pricing: { voucherCode: "A" },
    });

    expect(result.voucherDiscount).toBe(10000);
  });
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
        scope: "ORDER",
        discountType: "AMOUNT",
        discountValue: 5000,
        stacking: false,

        promotionType: "FIXED",
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
        promotionType: "FIXED",
        scope: "ORDER",
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
        scope: "ORDER",
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
          scope: "ORDER",
          promotionType: "FIXED",
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
          scope: "ORDER",
          promotionType: "FIXED",
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
        scope: "ORDER",
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
        scope: "ORDER",
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
          scope: "ORDER",
          promotionType: "FIXED",
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
          scope: "ORDER",
          promotionType: "FIXED",
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
  it("blocks voucher stacking with non-stackable item promotion", async () => {
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

    Promotion.findOne.mockReturnValue(chain(null));
    Promotion.find.mockReturnValue(
      chainList([
        {
          _id: "promo-icecream",
          name: "Kem giảm 5%",
          isActive: true,
          scope: "ITEM",
          itemId: "item-icecream",
          promotionType: "PERCENTAGE",
          discountType: "PERCENT",
          discountValue: 5,
          stacking: false,
        },
      ]),
    );

    const result = await calculateDiscountBreakdown({
      restaurantId: rid,
      items: [
        {
          dishId: "item-icecream",
          categoryId: "cat-dessert",
          name: "Kem",
          quantity: 1,
          lineSubtotal: 100000,
        },
      ],
      pricing: { voucherCode: "A" },
    });

    expect(result.voucherDiscount).toBe(10000);
    expect(result.promotionDiscount).toBe(0);
    expect(result.promotionLines).toEqual([]);
    expect(result.appliedPromotions).toEqual([]);
  });

  it("exclusive item promotion blocks voucher discount", async () => {
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

    Promotion.findOne.mockReturnValue(chain(null));
    Promotion.find.mockReturnValue(
      chainList([
        {
          _id: "promo-icecream",
          name: "Kem giảm 5%",
          isActive: true,
          scope: "ITEM",
          itemId: "item-icecream",
          promotionType: "PERCENTAGE",
          discountType: "PERCENT",
          discountValue: 5,
          stacking: true,
          exclusive: true,
        },
      ]),
    );

    const result = await calculateDiscountBreakdown({
      restaurantId: rid,
      items: [
        {
          dishId: "item-icecream",
          categoryId: "cat-dessert",
          name: "Kem",
          quantity: 1,
          lineSubtotal: 100000,
        },
      ],
      pricing: { voucherCode: "A" },
    });

    expect(result.promotionDiscount).toBe(5000);
    expect(result.voucherDiscount).toBe(0);
    expect(result.appliedCoupons).toEqual([]);
    expect(result.appliedPromotions).toEqual(["promo-icecream"]);
  });
  it("applies item-level promotion to matching item lines", async () => {
    Coupon.findOne.mockReturnValue(chain(null));
    Promotion.findOne.mockReturnValue(chain(null));

    Promotion.find.mockReturnValue(
      chainList([
        {
          _id: "promo-icecream",
          name: "Ưu đãi mùa hè",
          isActive: true,
          scope: "ITEM",
          itemId: "item-icecream",
          promotionType: "PERCENTAGE",
          discountType: "PERCENT",
          discountValue: 5,
          level: 1,
        },
      ]),
    );

    const result = await calculateDiscountBreakdown({
      restaurantId: rid,
      promotionIds: [],
      items: [
        {
          dishId: "item-icecream",
          categoryId: "dessert",
          name: "Kem",
          quantity: 1,
          lineSubtotal: 100000,
        },
        {
          dishId: "item-coffee",
          categoryId: "drink",
          name: "Cà phê",
          quantity: 1,
          lineSubtotal: 50000,
        },
      ],
      pricing: {},
    });

    expect(result.promotionDiscount).toBe(5000);
    expect(result.totalDiscount).toBe(5000);
    expect(result.appliedPromotions).toEqual(["promo-icecream"]);
    expect(result.promotionLines).toHaveLength(1);
    expect(result.promotionLines[0]).toMatchObject({
      dishId: "item-icecream",
      name: "Kem",
      promotionId: "promo-icecream",
      promotionName: "Ưu đãi mùa hè",
      promotionScope: "ITEM",
      discount: 5000,
    });
  });
  it("applies BOGO promotion by discounting gift item lines", async () => {
    const restaurantId = new mongoose.Types.ObjectId();
    const buyItemId = new mongoose.Types.ObjectId();
    const giftItemId = new mongoose.Types.ObjectId();

    const promotion = {
      _id: new mongoose.Types.ObjectId(),
      restaurantId,
      name: "Mua phở tặng trà",
      promotionType: "BOGO",
      scope: "ITEM",
      itemId: buyItemId,
      giftItemId,
      buyQuantity: 1,
      getQuantity: 1,
      minOrderValue: 0,
      isActive: true,
      startAt: new Date(Date.now() - 1000),
      endAt: new Date(Date.now() + 86400000),
      level: 1,
    };

    Promotion.find.mockReturnValue({
      session: vi.fn().mockResolvedValue([promotion]),
    });

    Coupon.findOne.mockReturnValue({
      session: vi.fn().mockResolvedValue(null),
    });

    const result = await calculateDiscountBreakdown({
      restaurantId,
      items: [
        {
          _id: "line-buy",
          menuItemId: buyItemId,
          name: "Phở bò",
          quantity: 2,
          lineSubtotal: 100000,
        },
        {
          _id: "line-gift",
          menuItemId: giftItemId,
          name: "Trà đá",
          quantity: 2,
          lineSubtotal: 20000,
        },
      ],
      pricing: {},
    });

    expect(result.promotionDiscount).toBe(20000);
    expect(result.totalDiscount).toBe(20000);
    expect(result.appliedPromotions).toContain(String(promotion._id));
    expect(result.promotionLines[0]).toMatchObject({
      promotionType: "BOGO",
      freeQuantity: 2,
      discount: 20000,
    });
  });

  it("prefers item-level promotion over category-level promotion for the same item", async () => {
    Coupon.findOne.mockReturnValue(chain(null));
    Promotion.findOne.mockReturnValue(chain(null));

    Promotion.find.mockReturnValue(
      chainList([
        {
          _id: "promo-dessert",
          name: "Tráng miệng giảm 3%",
          isActive: true,
          scope: "CATEGORY",
          categoryId: "dessert",
          promotionType: "PERCENTAGE",
          discountType: "PERCENT",
          discountValue: 3,
          level: 10,
        },
        {
          _id: "promo-icecream",
          name: "Kem giảm 5%",
          isActive: true,
          scope: "ITEM",
          itemId: "item-icecream",
          promotionType: "PERCENTAGE",
          discountType: "PERCENT",
          discountValue: 5,
          level: 1,
        },
      ]),
    );

    const result = await calculateDiscountBreakdown({
      restaurantId: rid,
      promotionIds: [],
      items: [
        {
          dishId: "item-icecream",
          categoryId: "dessert",
          name: "Kem",
          quantity: 1,
          lineSubtotal: 100000,
        },
      ],
      pricing: {},
    });

    expect(result.promotionDiscount).toBe(5000);
    expect(result.appliedPromotions).toEqual(["promo-icecream"]);
    expect(result.promotionLines).toHaveLength(1);
    expect(result.promotionLines[0]).toMatchObject({
      promotionId: "promo-icecream",
      promotionScope: "ITEM",
      discount: 5000,
    });
  });

  it("does not apply BOGO when gift item is not present in the order", async () => {
    Coupon.findOne.mockReturnValue(chain(null));
    Promotion.findOne.mockReturnValue(chain(null));

    Promotion.find.mockReturnValue(
      chainList([
        {
          _id: "promo-bogo-pho-tra",
          name: "Mua phở tặng trà",
          isActive: true,
          scope: "ITEM",
          itemId: "item-pho",
          giftItemId: "item-tra",
          promotionType: "BOGO",
          buyQuantity: 1,
          getQuantity: 1,
          minOrderValue: 0,
          level: 1,
          startAt: new Date(Date.now() - 1000),
          endAt: new Date(Date.now() + 86400000),
        },
      ]),
    );

    const result = await calculateDiscountBreakdown({
      restaurantId: rid,
      promotionIds: [],
      items: [
        {
          _id: "line-pho",
          dishId: "item-pho",
          menuItemId: "item-pho",
          name: "Phở bò",
          quantity: 2,
          lineSubtotal: 100000,
        },
      ],
      pricing: {},
    });

    expect(result.promotionDiscount).toBe(0);
    expect(result.totalDiscount).toBe(0);
    expect(result.appliedPromotions).toEqual([]);
    expect(result.promotionLines).toEqual([]);
  });
  it("caps BOGO discount by actual gift item quantity in the order", async () => {
    Coupon.findOne.mockReturnValue(chain(null));
    Promotion.findOne.mockReturnValue(chain(null));

    Promotion.find.mockReturnValue(
      chainList([
        {
          _id: "promo-bogo-pho-tra",
          name: "Mua phở tặng trà",
          isActive: true,
          scope: "ITEM",
          itemId: "item-pho",
          giftItemId: "item-tra",
          promotionType: "BOGO",
          buyQuantity: 1,
          getQuantity: 1,
          minOrderValue: 0,
          level: 1,
          startAt: new Date(Date.now() - 1000),
          endAt: new Date(Date.now() + 86400000),
        },
      ]),
    );

    const result = await calculateDiscountBreakdown({
      restaurantId: rid,
      promotionIds: [],
      items: [
        {
          _id: "line-pho",
          dishId: "item-pho",
          menuItemId: "item-pho",
          name: "Phở bò",
          quantity: 3,
          lineSubtotal: 150000,
        },
        {
          _id: "line-tra",
          dishId: "item-tra",
          menuItemId: "item-tra",
          name: "Trà đá",
          quantity: 1,
          lineSubtotal: 10000,
        },
      ],
      pricing: {},
    });

    expect(result.promotionDiscount).toBe(10000);
    expect(result.totalDiscount).toBe(10000);
    expect(result.appliedPromotions).toEqual(["promo-bogo-pho-tra"]);
    expect(result.promotionLines).toHaveLength(1);
    expect(result.promotionLines[0]).toMatchObject({
      freeQuantity: 1,
      discount: 10000,
    });
  });
  it("applies unrestricted coupon to full subtotal", async () => {
    Coupon.findOne.mockReturnValue(chain({ _id: "c-full", isActive: true, discountType: "PERCENT", discountValue: 10 }));

    const result = await calculateDiscountBreakdown({
      restaurantId: rid,
      items: [{ lineSubtotal: 100000, categoryId: new mongoose.Types.ObjectId() }, { lineSubtotal: 50000, categoryId: new mongoose.Types.ObjectId() }],
      pricing: { voucherCode: "FULL" },
    });

    expect(result.voucherDiscount).toBe(15000);
    expect(result.couponCategoryScoped).toBe(false);
  });

  it("applies categoryIds coupon only to matching item subtotal", async () => {
    const foodId = new mongoose.Types.ObjectId();
    const drinkId = new mongoose.Types.ObjectId();
    Coupon.findOne.mockReturnValue(chain({ _id: "c-food", isActive: true, discountType: "PERCENT", discountValue: 20, constraints: { categoryIds: [String(foodId)] } }));

    const result = await calculateDiscountBreakdown({
      restaurantId: rid,
      items: [{ lineSubtotal: 100000, categoryId: foodId }, { lineSubtotal: 50000, categoryId: drinkId }],
      pricing: { voucherCode: "FOOD20" },
    });

    expect(result.couponEligibleSubtotal).toBe(100000);
    expect(result.voucherDiscount).toBe(20000);
  });

  it("matches categories by name case-insensitively", async () => {
    Coupon.findOne.mockReturnValue(chain({ _id: "c-drink", isActive: true, discountType: "PERCENT", discountValue: 10, constraints: { categories: " drink " } }));

    const result = await calculateDiscountBreakdown({
      restaurantId: rid,
      items: [{ lineSubtotal: 100000, categoryName: "Food" }, { lineSubtotal: 50000, category: { name: "DRINK" } }],
      pricing: { voucherCode: "DRINK10" },
    });

    expect(result.couponEligibleSubtotal).toBe(50000);
    expect(result.voucherDiscount).toBe(5000);
  });

  it("uses OR logic when categoryIds and categories both exist", async () => {
    const foodId = new mongoose.Types.ObjectId();
    Coupon.findOne.mockReturnValue(chain({ _id: "c-or", isActive: true, discountType: "PERCENT", discountValue: 10, constraints: { categoryIds: [String(foodId)], categories: ["drink"] } }));

    const result = await calculateDiscountBreakdown({
      restaurantId: rid,
      items: [{ lineSubtotal: 100000, categoryId: foodId }, { lineSubtotal: 50000, categoryName: "Drink" }, { lineSubtotal: 25000, categoryName: "Dessert" }],
      pricing: { voucherCode: "OR10" },
    });

    expect(result.couponEligibleSubtotal).toBe(150000);
    expect(result.voucherDiscount).toBe(15000);
  });

  it("rejects category-scoped coupon when no items match", async () => {
    Coupon.findOne.mockReturnValue(chain({ _id: "c-none", isActive: true, discountType: "AMOUNT", discountValue: 10000, constraints: { categories: ["food"] } }));

    await expect(calculateDiscountBreakdown({
      restaurantId: rid,
      items: [{ lineSubtotal: 50000, categoryName: "Drink" }],
      pricing: { voucherCode: "NOPE" },
    })).rejects.toThrow(/Invalid coupon: no eligible items for category constraints/);
  });

  it("caps percent category coupon by maxDiscount against eligible subtotal", async () => {
    Coupon.findOne.mockReturnValue(chain({ _id: "c-cap", isActive: true, discountType: "PERCENT", discountValue: 50, maxDiscount: 10000, constraints: { categories: ["food"] } }));

    const result = await calculateDiscountBreakdown({
      restaurantId: rid,
      items: [{ lineSubtotal: 100000, categoryName: "Food" }, { lineSubtotal: 100000, categoryName: "Drink" }],
      pricing: { voucherCode: "CAP" },
    });

    expect(result.couponEligibleSubtotal).toBe(100000);
    expect(result.voucherDiscount).toBe(10000);
  });

  it("checks minOrderValue against full subtotal but discounts eligible subtotal", async () => {
    Coupon.findOne.mockReturnValue(chain({ _id: "c-min", isActive: true, discountType: "PERCENT", discountValue: 10, minOrderValue: 120000, constraints: { categories: ["food"] } }));

    const result = await calculateDiscountBreakdown({
      restaurantId: rid,
      items: [{ lineSubtotal: 50000, categoryName: "Food" }, { lineSubtotal: 100000, categoryName: "Drink" }],
      pricing: { voucherCode: "MIN" },
    });

    expect(result.couponEligibleSubtotal).toBe(50000);
    expect(result.voucherDiscount).toBe(5000);
  });

  it("excludes cancelled and returned matching items from eligible subtotal", async () => {
    Coupon.findOne.mockReturnValue(chain({ _id: "c-active", isActive: true, discountType: "PERCENT", discountValue: 10, constraints: { categories: ["food"] } }));

    const result = await calculateDiscountBreakdown({
      restaurantId: rid,
      items: [{ lineSubtotal: 100000, categoryName: "Food" }, { lineSubtotal: 50000, categoryName: "Food", status: "cancelled" }, { lineSubtotal: 50000, categoryName: "Food", status: "returned" }],
      pricing: { voucherCode: "ACTIVE" },
    });

    expect(result.couponEligibleSubtotal).toBe(100000);
    expect(result.voucherDiscount).toBe(10000);
  });

  it("resolves category name from Category model when item only has categoryId", async () => {
    const foodId = new mongoose.Types.ObjectId();
    Category.find.mockReturnValue(chainList([{ _id: foodId, name: "Food" }]));
    Coupon.findOne.mockReturnValue(chain({ _id: "c-db", isActive: true, discountType: "PERCENT", discountValue: 10, constraints: { categories: ["food"] } }));

    const result = await calculateDiscountBreakdown({
      restaurantId: rid,
      items: [{ lineSubtotal: 100000, categoryId: foodId }, { lineSubtotal: 50000, categoryName: "Drink" }],
      pricing: { voucherCode: "DB" },
    });

    expect(Category.find).toHaveBeenCalledWith({ restaurantId: rid, _id: { $in: [foodId] } });
    expect(result.couponEligibleSubtotal).toBe(100000);
    expect(result.voucherDiscount).toBe(10000);
  });


  it("allows loyaltyRank alias for customerRanks constraints", async () => {
    Coupon.findOne.mockReturnValue(chain({ _id: "c-gold", isActive: true, discountType: "PERCENT", discountValue: 10, constraints: { customerRanks: ["gold"] } }));

    const result = await calculateDiscountBreakdown({
      restaurantId: rid,
      items: [{ lineSubtotal: 100000 }],
      pricing: { voucherCode: "GOLD" },
      customerRanks: ["gold"],
    });

    expect(result.voucherDiscount).toBe(10000);
  });

  it("allows customerType alias for customerRanks constraints case-insensitively", async () => {
    Coupon.findOne.mockReturnValue(chain({ _id: "c-vip", isActive: true, discountType: "PERCENT", discountValue: 10, constraints: { customerRanks: ["vip"] } }));

    const result = await calculateDiscountBreakdown({
      restaurantId: rid,
      items: [{ lineSubtotal: 100000 }],
      pricing: { voucherCode: "VIP" },
      customerRanks: ["VIP"],
    });

    expect(result.voucherDiscount).toBe(10000);
  });

  it("allows any matching alias when loyaltyRank and customerType are both present", async () => {
    Coupon.findOne.mockReturnValue(chain({ _id: "c-often", isActive: true, discountType: "PERCENT", discountValue: 10, constraints: { customerRanks: ["often"] } }));

    const result = await calculateDiscountBreakdown({
      restaurantId: rid,
      items: [{ lineSubtotal: 100000 }],
      pricing: { voucherCode: "OFTEN" },
      customerRanks: ["gold", "often"],
    });

    expect(result.voucherDiscount).toBe(10000);
  });

  it("rejects coupons when none of the customer rank aliases match", async () => {
    Coupon.findOne.mockReturnValue(chain({ _id: "c-platinum", isActive: true, discountType: "PERCENT", discountValue: 10, constraints: { customerRanks: ["platinum"] } }));

    await expect(calculateDiscountBreakdown({
      restaurantId: rid,
      items: [{ lineSubtotal: 100000 }],
      pricing: { voucherCode: "PLAT" },
      customerRanks: ["gold", "often"],
    })).rejects.toThrow(/Invalid coupon: customer rank is not eligible/);
  });

  it("does not require rank aliases when coupon has no customerRanks constraint", async () => {
    Coupon.findOne.mockReturnValue(chain({ _id: "c-open", isActive: true, discountType: "PERCENT", discountValue: 10 }));

    const result = await calculateDiscountBreakdown({
      restaurantId: rid,
      items: [{ lineSubtotal: 100000 }],
      pricing: { voucherCode: "OPEN" },
    });

    expect(result.voucherDiscount).toBe(10000);
  });

});
