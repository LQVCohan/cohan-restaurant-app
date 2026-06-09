import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ orderRows: [], promotions: [], coupons: [], customers: [], stock: [], forecast: null }));
const chain = (rows) => ({ select: vi.fn(() => ({ lean: vi.fn(async () => rows), limit: vi.fn(() => ({ lean: vi.fn(async () => rows) })) })), limit: vi.fn(() => ({ lean: vi.fn(async () => rows) })), lean: vi.fn(async () => rows) });
vi.mock("../../models/index.js", () => ({
  Order: { find: vi.fn(() => chain(mocks.orderRows)) },
  Promotion: { find: vi.fn(() => chain(mocks.promotions)) },
  Coupon: { find: vi.fn(() => chain(mocks.coupons)) },
  Customer: { find: vi.fn(() => chain(mocks.customers)) },
  StockItem: { find: vi.fn(() => chain(mocks.stock)) },
}));
vi.mock("../../src/services/ai/demandForecast.service.js", () => ({
  buildDemandForecast: vi.fn(async () => mocks.forecast || { hourlyForecast: [{ hourLabel: "15:00", demandScore: 0.2, expectedOrders: 1 }], meta: { fallbackUsed: false } }),
}));
const { buildSmartPromotionEngine } = await import("../../src/services/ai/smartPromotionEngine.service.js");
const rid = "64b7f987f987f987f987f987";

describe("smart promotion engine", () => {
  beforeEach(() => { mocks.orderRows = []; mocks.promotions = []; mocks.coupons = []; mocks.customers = []; mocks.stock = []; mocks.forecast = null; delete process.env.OPENAI_API_KEY; });

  it("caps confidence and adds manual review guardrail when sampleOrders is low", async () => {
    mocks.orderRows = [{ totals: { grandTotal: 120000 } }];
    const result = await buildSmartPromotionEngine({ restaurantId: rid });
    expect(result.meta.lowDataFallbackUsed).toBe(true);
    expect(result.campaigns[0].expectedKpi.confidence).toBeLessThanOrEqual(0.55);
    expect(result.campaigns[0].guardrails.join(" ")).toContain("review");
  });

  it("scores active promotions/coupons and missing OpenAI key does not force fallback with enough data", async () => {
    mocks.orderRows = Array.from({ length: 25 }, () => ({ totals: { grandTotal: 130000 } }));
    mocks.promotions = [{ _id: rid, name: "Promo", isActive: true, targetAudience: "NEW", discountType: "PERCENT", scope: "ORDER" }];
    mocks.coupons = [{ _id: rid, code: "COUPON", isActive: true, discountType: "PERCENT", maxUsage: 100, used: 1 }];
    const result = await buildSmartPromotionEngine({ restaurantId: rid });
    expect(result.autoSelectedPromotions.length).toBeGreaterThanOrEqual(2);
    expect(result.meta.aiEnhanced).toBe(false);
    expect(result.meta.fallbackUsed).toBe(false);
  });

  it("adds stock pressure guardrails when inventory risk is high", async () => {
    mocks.orderRows = Array.from({ length: 25 }, () => ({ totals: { grandTotal: 90000 } }));
    mocks.stock = [{ onHand: 0, reserved: 0 }, { onHand: 2, reserved: 0 }, { onHand: 50, reserved: 0 }];
    const result = await buildSmartPromotionEngine({ restaurantId: rid });
    expect(result.campaigns.some((c) => c.guardrails.join(" ").includes("stock risk"))).toBe(true);
  });
});
