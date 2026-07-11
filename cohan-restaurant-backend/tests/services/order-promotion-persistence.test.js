import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  calculateDiscountBreakdown: vi.fn(),
  promotionUpdateOne: vi.fn(),
}));

vi.mock("mongoose", () => ({
  default: {
    models: {
      Promotion: { updateOne: mocks.promotionUpdateOne },
    },
  },
}));

vi.mock("../../src/services/discountCalculation.service.js", () => ({
  calculateDiscountBreakdown: mocks.calculateDiscountBreakdown,
}));

import { installOrderPromotionPersistence } from "../../src/services/orderPromotionPersistence.service.js";

describe("orderPromotionPersistence.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.calculateDiscountBreakdown.mockResolvedValue({
      subtotal: 100000,
      promotionDiscount: 20000,
      voucherDiscount: 0,
      shippingDiscount: 0,
      totalDiscount: 20000,
      service: 0,
      serviceRate: 0,
      tax: 0,
      taxRate: 0,
      shippingFee: 0,
      grandTotal: 80000,
      appliedPromotions: ["promotion-1"],
      appliedCoupons: [],
      promotionLines: [
        {
          promotionId: "promotion-1",
          promotionName: "Giảm món",
          discount: 20000,
        },
      ],
    });
    mocks.promotionUpdateOne.mockResolvedValue({ modifiedCount: 1 });
  });

  it("prices a dine-in order before persistence and increments promotion usage", async () => {
    const originalCreate = vi.fn(async (docs) => docs);
    const Order = { create: originalCreate };
    installOrderPromotionPersistence(Order);
    const session = { id: "session-1" };
    const input = {
      restaurantId: "restaurant-1",
      userId: "user-1",
      orderType: "dine_in",
      orderKind: "order_batch",
      items: [{ dishId: "dish-1", quantity: 2, unitPrice: 50000 }],
      totals: { subtotal: 100000, grandTotal: 100000 },
      clientMeta: { source: "reservation_cart_addon" },
    };

    const created = await Order.create([input], { session });

    expect(mocks.calculateDiscountBreakdown).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: "restaurant-1",
        orderType: "dine_in",
        userId: "user-1",
        session,
      }),
    );
    expect(originalCreate).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          totals: expect.objectContaining({
            subtotal: 100000,
            discount: 20000,
            grandTotal: 80000,
            promotionId: "promotion-1",
          }),
          clientMeta: expect.objectContaining({
            promotionPricing: expect.objectContaining({
              calculated: true,
              promotionDiscount: 20000,
              grandTotal: 80000,
              appliedPromotions: ["promotion-1"],
            }),
          }),
        }),
      ],
      { session },
    );
    expect(mocks.promotionUpdateOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: "promotion-1", isActive: true }),
      { $inc: { used: 1 } },
      { session },
    );
    expect(created[0].totals.grandTotal).toBe(80000);
  });

  it("does not recalculate table-session shell orders", async () => {
    const originalCreate = vi.fn(async (docs) => docs);
    const Order = { create: originalCreate };
    installOrderPromotionPersistence(Order);

    await Order.create([
      {
        restaurantId: "restaurant-1",
        orderType: "dine_in",
        orderKind: "table_session",
        items: [{ dishId: "dish-1", quantity: 1 }],
        totals: { subtotal: 0, grandTotal: 0 },
      },
    ]);

    expect(mocks.calculateDiscountBreakdown).not.toHaveBeenCalled();
    expect(mocks.promotionUpdateOne).not.toHaveBeenCalled();
  });

  it("rejects an exhausted promotion instead of silently storing the old price", async () => {
    const originalCreate = vi.fn(async (docs) => docs);
    const Order = { create: originalCreate };
    installOrderPromotionPersistence(Order);
    mocks.promotionUpdateOne.mockResolvedValue({ modifiedCount: 0 });

    await expect(
      Order.create(
        [
          {
            restaurantId: "restaurant-1",
            orderType: "dine_in",
            orderKind: "order_batch",
            items: [{ dishId: "dish-1", quantity: 1, unitPrice: 100000 }],
            totals: { subtotal: 100000, grandTotal: 100000 },
          },
        ],
        { session: { id: "session-1" } },
      ),
    ).rejects.toMatchObject({
      extensions: { code: "PROMOTION_USAGE_LIMIT_REACHED" },
    });
  });
});
