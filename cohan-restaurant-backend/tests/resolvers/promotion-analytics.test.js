import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Promotion: {
    find: vi.fn(),
  },
  Invoice: {
    find: vi.fn(),
  },
}));

const authMocks = vi.hoisted(() => ({
  requireRestaurantPermission: vi.fn(),
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/auth/authorization.service.js", () => authMocks);
vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: vi.fn(() => true),
    Types: {
      ObjectId: function ObjectId(value) {
        this.value = value;
        this.toString = () => String(value);
      },
    },
  },
}));

function selectableLean(value) {
  return {
    select: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(value),
    }),
  };
}

const promotions = [
  {
    _id: "promo-percentage",
    name: "Lunch 10%",
    code: "LUNCH10",
    promotionType: "PERCENTAGE",
    isActive: true,
    startAt: new Date("2026-05-01T00:00:00.000Z"),
    endAt: new Date("2099-05-31T00:00:00.000Z"),
  },
  {
    _id: "promo-freeship",
    name: "Free Ship",
    code: "SHIP0",
    promotionType: "FREESHIP",
    isActive: true,
    startAt: new Date("2026-05-01T00:00:00.000Z"),
    endAt: new Date("2099-05-31T00:00:00.000Z"),
  },
  {
    _id: "promo-combo",
    name: "Combo Family",
    code: "COMBO",
    promotionType: "COMBO",
    isActive: true,
    startAt: new Date("2099-06-01T00:00:00.000Z"),
    endAt: new Date("2099-06-30T00:00:00.000Z"),
  },
  {
    _id: "promo-bogo",
    name: "Buy One Get One",
    code: "BOGO",
    promotionType: "BOGO",
    isActive: true,
    startAt: new Date("2025-01-01T00:00:00.000Z"),
    endAt: new Date("2025-01-31T00:00:00.000Z"),
  },
];

const invoices = [
  {
    meta: {
      appliedPromotions: ["promo-percentage", "promo-freeship"],
      promotionDiscount: 10000,
      shippingDiscount: 15000,
      totalDiscount: 25000,
    },
  },
  {
    meta: {
      appliedPromotions: ["promo-percentage", "promo-combo"],
      promotionDiscount: 30000,
      shippingDiscount: 0,
    },
  },
  {
    meta: {
      appliedPromotions: ["deleted-promo"],
      promotionDiscount: 5000,
      shippingDiscount: 0,
    },
  },
  { meta: {} },
  {},
];

describe("promotionAnalyticsByRestaurant", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    authMocks.requireRestaurantPermission.mockResolvedValue(undefined);
    modelMocks.Promotion.find.mockReturnValue(selectableLean(promotions));
    modelMocks.Invoice.find.mockReturnValue(selectableLean(invoices));
  });

  it("requires restaurant access before querying analytics data", async () => {
    authMocks.requireRestaurantPermission.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
    const { PromotionQuery } = await import("../../graphql/resolvers/promotion/query.js");

    await expect(
      PromotionQuery.promotionAnalyticsByRestaurant(
        null,
        { restaurantId: "restaurant-1" },
        { user: { id: "manager-1" } },
      ),
    ).rejects.toThrow("FORBIDDEN_SCOPE");

    expect(authMocks.requireRestaurantPermission).toHaveBeenCalled();
    expect(modelMocks.Promotion.find).not.toHaveBeenCalled();
    expect(modelMocks.Invoice.find).not.toHaveBeenCalled();
  });

  it("returns promotion counts and aggregates paid invoice metadata safely", async () => {
    const { PromotionQuery } = await import("../../graphql/resolvers/promotion/query.js");

    const result = await PromotionQuery.promotionAnalyticsByRestaurant(
      null,
      { restaurantId: "restaurant-1" },
      { user: { id: "manager-1" } },
    );

    expect(modelMocks.Invoice.find).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "PAID",
        "meta.appliedPromotions": { $exists: true, $ne: [] },
      }),
    );
    expect(result).toMatchObject({
      totalPromotions: 4,
      activePromotions: 2,
      scheduledPromotions: 1,
      expiredPromotions: 1,
      totalRedemptions: 5,
      totalPromotionDiscount: 45000,
      totalShippingDiscount: 15000,
      totalDiscountAmount: 60000,
      usageRate: 125,
    });
  });

  it("groups top promotions by promotion id and keeps deleted promotion ids", async () => {
    const { PromotionQuery } = await import("../../graphql/resolvers/promotion/query.js");

    const result = await PromotionQuery.promotionAnalyticsByRestaurant(
      null,
      { restaurantId: "restaurant-1" },
      { user: { id: "manager-1" } },
    );

    expect(result.topPromotions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          promotionId: "promo-percentage",
          promotionName: "Lunch 10%",
          promotionCode: "LUNCH10",
          promotionType: "PERCENTAGE",
          usageCount: 2,
          totalDiscount: 25000,
        }),
        expect.objectContaining({
          promotionId: "promo-freeship",
          promotionType: "FREESHIP",
          usageCount: 1,
          totalDiscount: 15000,
        }),
        expect.objectContaining({
          promotionId: "deleted-promo",
          promotionName: "",
          promotionCode: "",
          promotionType: "",
          usageCount: 1,
          totalDiscount: 5000,
        }),
      ]),
    );
  });

  it("groups promotion usage and discounts by promotionType", async () => {
    const { PromotionQuery } = await import("../../graphql/resolvers/promotion/query.js");

    const result = await PromotionQuery.promotionAnalyticsByRestaurant(
      null,
      { restaurantId: "restaurant-1" },
      { user: { id: "manager-1" } },
    );

    expect(result.byType).toEqual(
      expect.arrayContaining([
        { promotionType: "PERCENTAGE", usageCount: 2, totalDiscount: 25000 },
        { promotionType: "FREESHIP", usageCount: 1, totalDiscount: 15000 },
        { promotionType: "COMBO", usageCount: 1, totalDiscount: 15000 },
        { promotionType: "", usageCount: 1, totalDiscount: 5000 },
      ]),
    );
  });
});
