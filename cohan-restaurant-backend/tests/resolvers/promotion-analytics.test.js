import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Promotion: { find: vi.fn() },
  Invoice: { find: vi.fn() },
}));
const authMocks = vi.hoisted(() => ({ requireRestaurantPermission: vi.fn() }));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/auth/authorization.service.js", () => authMocks);
vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: vi.fn(() => true),
    Types: { ObjectId: function ObjectId(value) { this.value = value; this.toString = () => String(value); } },
  },
}));

function selectableLean(value) {
  return { select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(value) }) };
}

const promotions = [
  { _id: "promo-percentage", name: "Lunch 10%", code: "LUNCH10", promotionType: "PERCENTAGE", isActive: true, startAt: new Date("2026-05-01"), endAt: new Date("2099-05-31") },
  { _id: "promo-freeship", name: "Free Ship", code: "SHIP0", promotionType: "FREESHIP", isActive: true, startAt: new Date("2026-05-01"), endAt: new Date("2099-05-31") },
  { _id: "promo-combo", name: "Combo Family", code: "COMBO", promotionType: "COMBO", isActive: true, startAt: new Date("2099-06-01"), endAt: new Date("2099-06-30") },
  { _id: "promo-bogo", name: "Buy One Get One", code: "BOGO", promotionType: "BOGO", isActive: true, startAt: new Date("2025-01-01"), endAt: new Date("2025-01-31") },
];

const invoices = [
  { meta: { appliedPromotions: ["promo-percentage", "promo-freeship"], promotionDiscount: 10000, shippingDiscount: 15000, appliedPromotionBreakdown: [
    { promotionId: "promo-percentage", promotionType: "PERCENTAGE", discountAmount: 10000, source: "line" },
    { promotionId: "promo-freeship", promotionType: "FREESHIP", discountAmount: 15000, source: "shipping" },
  ] } },
  { meta: { appliedPromotions: ["promo-percentage", "promo-combo"], promotionDiscount: 30000, shippingDiscount: 0, appliedPromotionBreakdown: [
    { promotionId: "promo-percentage", promotionType: "PERCENTAGE", discountAmount: 18000, source: "line" },
    { promotionId: "promo-combo", promotionType: "COMBO", discountAmount: 12000, source: "order" },
    { promotionId: "promo-combo", promotionType: "COMBO", discountAmount: 0, source: "order" },
  ] } },
  { meta: { appliedPromotions: ["deleted-promo"], promotionDiscount: 5000, shippingDiscount: 0 } },
];

describe("promotionAnalyticsByRestaurant", () => {
  beforeEach(() => {
    vi.resetModules(); vi.clearAllMocks();
    authMocks.requireRestaurantPermission.mockResolvedValue(undefined);
    modelMocks.Promotion.find.mockReturnValue(selectableLean(promotions));
    modelMocks.Invoice.find.mockReturnValue(selectableLean(invoices));
  });

  it("uses exact meta.appliedPromotionBreakdown when present and keeps legacy fallback", async () => {
    const { PromotionQuery } = await import("../../graphql/resolvers/promotion/query.js");
    const result = await PromotionQuery.promotionAnalyticsByRestaurant(null, { restaurantId: "restaurant-1" }, { user: { id: "manager-1" } });

    expect(result.totalPromotionDiscount).toBe(45000);
    expect(result.totalShippingDiscount).toBe(15000);
    expect(result.totalDiscountAmount).toBe(60000);
    expect(result.totalRedemptions).toBe(5);

    const percentage = result.topPromotions.find((row) => row.promotionId === "promo-percentage");
    const combo = result.topPromotions.find((row) => row.promotionId === "promo-combo");
    const freeship = result.topPromotions.find((row) => row.promotionId === "promo-freeship");

    expect(percentage?.totalDiscount).toBe(28000);
    expect(combo?.totalDiscount).toBe(12000);
    expect(freeship?.totalDiscount).toBe(15000);
  });

  it("counts usage once per promotion per invoice even with multiple breakdown rows", async () => {
    const { PromotionQuery } = await import("../../graphql/resolvers/promotion/query.js");
    const result = await PromotionQuery.promotionAnalyticsByRestaurant(null, { restaurantId: "restaurant-1" }, { user: { id: "manager-1" } });

    expect(result.topPromotions).toEqual(expect.arrayContaining([
      expect.objectContaining({ promotionId: "promo-combo", usageCount: 1 }),
      expect.objectContaining({ promotionId: "promo-percentage", usageCount: 2 }),
    ]));
  });

  it("splits by type with exact breakdown totals and legacy metadata totals", async () => {
    const { PromotionQuery } = await import("../../graphql/resolvers/promotion/query.js");
    const result = await PromotionQuery.promotionAnalyticsByRestaurant(null, { restaurantId: "restaurant-1" }, { user: { id: "manager-1" } });

    expect(result.byType).toEqual(expect.arrayContaining([
      { promotionType: "PERCENTAGE", usageCount: 2, totalDiscount: 28000 },
      { promotionType: "FREESHIP", usageCount: 1, totalDiscount: 15000 },
      { promotionType: "COMBO", usageCount: 1, totalDiscount: 12000 },
      { promotionType: "", usageCount: 1, totalDiscount: 5000 },
    ]));
  });
});
