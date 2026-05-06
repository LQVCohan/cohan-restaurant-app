import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Order: {
    find: vi.fn(),
    countDocuments: vi.fn(),
  },
  User: { find: vi.fn() },
  Table: { countDocuments: vi.fn(), findOne: vi.fn() },
  Customer: { countDocuments: vi.fn() },
  MenuItem: { countDocuments: vi.fn() },
  StockItem: { find: vi.fn() },
  Supply: { find: vi.fn() },
  Promotion: { countDocuments: vi.fn() },
  Staff: { countDocuments: vi.fn(), find: vi.fn() },
  Review: { find: vi.fn() },
}));

const guardMocks = vi.hoisted(() => ({
  requireRestaurantAccess: vi.fn(),
}));

vi.mock("../../graphql/guards.js", () => guardMocks);
vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../models/tableCustomer.model.js", () => ({
  default: { find: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }) }) },
}));
vi.mock("../../graphql/resolvers/order/helper/tableUtils.js", () => ({
  resolveTableSafe: vi.fn(),
}));
vi.mock("../../src/services/ai/demandForecast.service.js", () => ({ buildDemandForecast: vi.fn() }));
vi.mock("../../src/services/ai/menuEngineeringAssistant.service.js", () => ({ buildMenuEngineeringAssistant: vi.fn() }));
vi.mock("../../src/services/ai/smartPromotionEngine.service.js", () => ({ buildSmartPromotionEngine: vi.fn() }));
vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: vi.fn((value) => String(value || "").startsWith("valid-")),
    Types: {
      ObjectId: function ObjectId(value) {
        this.value = value;
        this.toString = () => String(value);
      },
    },
  },
}));

function buildFindChain(rows = []) {
  return {
    sort: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(rows),
  };
}

describe("OrderQuery restaurant access guard", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    guardMocks.requireRestaurantAccess.mockResolvedValue(undefined);
  });

  it("guards ordersByRestaurantNow and continues query when access is allowed", async () => {
    const { OrderQuery } = await import("../../graphql/resolvers/order/query.js");
    const chain = buildFindChain([{ _id: "row-1", restaurantId: "valid-r1" }]);
    modelMocks.Order.find.mockReturnValue(chain);

    const result = await OrderQuery.ordersByRestaurantNow(
      null,
      { restaurantId: "valid-r1", limit: 1 },
      { user: { id: "manager-1" } },
    );

    expect(guardMocks.requireRestaurantAccess).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ value: "valid-r1" }),
    );
    expect(modelMocks.Order.find).toHaveBeenCalled();
    expect(result.edges).toHaveLength(1);
  });

  it("blocks ordersByRestaurantNow when access is denied", async () => {
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
    const { OrderQuery } = await import("../../graphql/resolvers/order/query.js");

    await expect(
      OrderQuery.ordersByRestaurantNow(
        null,
        { restaurantId: "valid-r2", limit: 10 },
        { user: { id: "staff-1" } },
      ),
    ).rejects.toThrow("FORBIDDEN_SCOPE");

    expect(modelMocks.Order.find).not.toHaveBeenCalled();
  });

  it("guards managerDashboard by restaurant", async () => {
    const { OrderQuery } = await import("../../graphql/resolvers/order/query.js");
    modelMocks.Order.find
      .mockReturnValueOnce({ lean: vi.fn().mockResolvedValue([]) })
      .mockReturnValueOnce({ lean: vi.fn().mockResolvedValue([]) })
      .mockReturnValueOnce({ sort: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }) }) });
    modelMocks.Table.countDocuments.mockResolvedValue(0);
    modelMocks.MenuItem.countDocuments.mockResolvedValue(0);
    modelMocks.Customer.countDocuments.mockResolvedValue(0);
    modelMocks.Promotion.countDocuments.mockResolvedValue(0);
    modelMocks.Staff.countDocuments.mockResolvedValue(0);
    modelMocks.StockItem.find.mockReturnValue({ limit: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }) });
    modelMocks.Staff.find.mockReturnValue({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }) });
    modelMocks.Review.find.mockReturnValue({ sort: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }) }) });

    const res = await OrderQuery.managerDashboard(
      null,
      { restaurantId: "valid-r3", range: "week" },
      { user: { id: "manager-1" } },
    );

    expect(guardMocks.requireRestaurantAccess).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ value: "valid-r3" }),
    );
    expect(res.restaurantId).toBe("valid-r3");
  });

  it("guards reportsOverview by restaurant", async () => {
    const { OrderQuery } = await import("../../graphql/resolvers/order/query.js");
    modelMocks.Order.find.mockReturnValue(buildFindChain([]));

    await OrderQuery.reportsOverview(
      null,
      { restaurantId: "valid-r4", limit: 20 },
      { user: { id: "manager-1" } },
    );

    expect(guardMocks.requireRestaurantAccess).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ value: "valid-r4" }),
    );
  });

  it("orders(filter) enforces access only when filter.restaurantId exists", async () => {
    const { OrderQuery } = await import("../../graphql/resolvers/order/query.js");

    modelMocks.Order.find.mockReturnValue(buildFindChain([]));
    modelMocks.Order.countDocuments.mockResolvedValue(0);

    await OrderQuery.orders(
      null,
      { filter: { restaurantId: "valid-r5" }, limit: 10, offset: 0 },
      { user: { id: "manager-1" } },
    );

    expect(guardMocks.requireRestaurantAccess).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ value: "valid-r5" }),
    );

    vi.clearAllMocks();
    modelMocks.Order.find.mockReturnValue(buildFindChain([]));
    modelMocks.Order.countDocuments.mockResolvedValue(0);

    await OrderQuery.orders(
      null,
      { filter: { status: "pending" }, limit: 10, offset: 0 },
      { user: { id: "manager-1" } },
    );

    expect(guardMocks.requireRestaurantAccess).not.toHaveBeenCalled();
    expect(modelMocks.Order.find).toHaveBeenCalled();
  });
});
