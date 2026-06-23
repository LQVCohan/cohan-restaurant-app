import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireRestaurantPermission: vi.fn(async () => true),
  find: vi.fn(),
}));

vi.mock("../../src/services/auth/authorization.service.js", () => ({
  requireRestaurantPermission: mocks.requireRestaurantPermission,
}));
vi.mock("../../src/constants/permissions.js", () => ({
  PERMISSIONS: { REPORT_READ: "report.read" },
}));
vi.mock("../../models/index.js", () => ({
  Order: { find: mocks.find },
  Review: {},
}));
vi.mock("../../graphql/guards.js", () => ({
  requireAuth: vi.fn(),
  requireRestaurantAccess: vi.fn(),
}));
vi.mock("../../src/services/ai/demandForecast.service.js", () => ({ buildDemandForecast: vi.fn() }));
vi.mock("../../src/services/ai/menuEngineeringAssistant.service.js", () => ({ buildMenuEngineeringAssistant: vi.fn() }));
vi.mock("../../src/services/ai/smartPromotionEngine.service.js", () => ({ buildSmartPromotionEngine: vi.fn() }));

const { default: analyticsResolver } = await import("../../graphql/resolvers/analytics/index.js");
const reportsOverview = analyticsResolver.Query.reportsOverview;

const rid = "64b7f987f987f987f987f987";
const makeQuery = (rows) => {
  const chain = {
    sort: vi.fn(() => chain),
    select: vi.fn(() => chain),
    lean: vi.fn(async () => rows),
  };
  return chain;
};

describe("reportsOverview", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires report.read permission and uses order batch/legacy filter", async () => {
    const chain = makeQuery([]);
    mocks.find.mockReturnValue(chain);
    await reportsOverview(null, { restaurantId: rid }, { user: { id: "u1" } });
    expect(mocks.requireRestaurantPermission).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      "report.read",
    );
    expect(mocks.find.mock.calls[0][0]).toEqual(expect.objectContaining({ $and: expect.any(Array) }));
    expect(JSON.stringify(mocks.find.mock.calls[0][0])).toContain("order_batch");
  });

  it("filters date range and rejects inverted ranges", async () => {
    mocks.find.mockReturnValue(makeQuery([]));
    await reportsOverview(null, {
      restaurantId: rid,
      startAt: "2026-01-01T00:00:00.000Z",
      endAt: "2026-01-31T23:59:59.999Z",
    }, {});
    expect(mocks.find.mock.calls[0][0].$and[0].createdAt.$gte.toISOString()).toBe(
      "2026-01-01T00:00:00.000Z",
    );
    await expect(
      reportsOverview(null, {
        restaurantId: rid,
        startAt: "2026-02-01",
        endAt: "2026-01-01",
      }, {}),
    ).rejects.toThrow("REPORT_INVALID_DATE_RANGE");
  });

  it("excludes cancelled failed draft from revenue/top dishes and invalid items", async () => {
    mocks.find.mockReturnValue(makeQuery([
      {
        currentStatus: "completed",
        orderType: "dine_in",
        createdAt: "2026-01-03T10:00:00Z",
        payment: { status: "paid" },
        totals: { grandTotal: 100000 },
        items: [
          { dishId: "d1", name: "Phở", quantity: 2, lineSubtotal: 60000 },
          { dishId: "d2", name: "Trả", quantity: 1, lineSubtotal: 30000, status: "returned" },
        ],
      },
      {
        currentStatus: "completed",
        orderType: "delivery",
        createdAt: "2026-01-03T12:00:00Z",
        orderPaymentStatus: "partially_refunded",
        totals: { grandTotal: 50000 },
        items: [{ name: "Cafe", quantity: 1, lineSubtotal: 50000 }],
      },
      {
        currentStatus: "cancelled",
        orderType: "dine_in",
        createdAt: "2026-01-04T10:00:00Z",
        payment: { status: "paid" },
        totals: { grandTotal: 999999 },
        items: [{ dishId: "d1", name: "Phở", quantity: 99, lineSubtotal: 999999 }],
      },
      { currentStatus: "failed", createdAt: "2026-01-04T10:00:00Z", totals: { grandTotal: 1 } },
      { currentStatus: "draft", createdAt: "2026-01-04T10:00:00Z", totals: { grandTotal: 1 } },
    ]));

    const result = await reportsOverview(null, { restaurantId: rid }, {});
    expect(result.totalOrders).toBe(2);
    expect(result.grossRevenue).toBe(150000);
    expect(result.byStatus.map((item) => item.key)).toEqual(["completed"]);
    expect(result.byOrderType.find((item) => item.key === "dine_in").count).toBe(1);
    expect(result.topDishes).toEqual([
      { name: "Phở", quantity: 2, revenue: 60000 },
      { name: "Cafe", quantity: 1, revenue: 50000 },
    ]);
    expect(result.revenueByDay).toEqual([
      { date: "2026-01-03", grossRevenue: 150000, orders: 2 },
    ]);
  });

  it("does not count unpaid completed order as revenue but keeps it operational", async () => {
    mocks.find.mockReturnValue(makeQuery([
      {
        currentStatus: "completed",
        orderType: "takeaway",
        createdAt: "2026-01-01T00:00:00Z",
        payment: { status: "unpaid" },
        totals: { grandTotal: 10000 },
        items: [{ name: "Bánh", quantity: 1, lineSubtotal: 10000, status: "served" }],
      },
    ]));
    const result = await reportsOverview(null, { restaurantId: rid }, {});
    expect(result.totalOrders).toBe(1);
    expect(result.grossRevenue).toBe(0);
    expect(result.revenueByDay[0]).toMatchObject({ orders: 1, grossRevenue: 0 });
  });

  it("aggregates the full filtered set and ignores display limit", async () => {
    const rows = Array.from({ length: 2005 }, (_, index) => ({
      currentStatus: "completed",
      orderType: index % 2 === 0 ? "dine_in" : "takeaway",
      createdAt: `2026-01-${String((index % 9) + 1).padStart(2, "0")}T10:00:00Z`,
      payment: { status: "paid" },
      totals: { grandTotal: 1000 },
      items: [{ name: "Món đủ kỳ", quantity: 1, lineSubtotal: 1000 }],
    }));
    const chain = makeQuery(rows);
    mocks.find.mockReturnValue(chain);

    const result = await reportsOverview(null, { restaurantId: rid, limit: 2000 }, {});

    expect(result.totalOrders).toBe(2005);
    expect(result.grossRevenue).toBe(2005000);
    expect(result.topDishes[0]).toMatchObject({
      name: "Món đủ kỳ",
      quantity: 2005,
      revenue: 2005000,
    });
    expect(result.revenueByDay.reduce((sum, row) => sum + row.orders, 0)).toBe(2005);
  });
});
