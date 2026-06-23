import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Order: {
    find: vi.fn(),
    findOne: vi.fn(),
    findById: vi.fn(),
    countDocuments: vi.fn(),
  },
  User: { find: vi.fn() },
  Table: { countDocuments: vi.fn(), findOne: vi.fn(), find: vi.fn() },
  Customer: { countDocuments: vi.fn() },
  MenuItem: { countDocuments: vi.fn() },
  StockItem: { find: vi.fn() },
  Supply: { find: vi.fn() },
  Promotion: { countDocuments: vi.fn(), find: vi.fn() },
  Staff: { countDocuments: vi.fn(), find: vi.fn() },
  Review: { find: vi.fn() },
  KitchenOrderWorkItem: { find: vi.fn() },
  Reservation: { find: vi.fn(), countDocuments: vi.fn() },
}));

const guardMocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  requireRestaurantAccess: vi.fn(),
  requireRoles: vi.fn(),
}));

const authorizationMocks = vi.hoisted(() => ({
  requireRestaurantPermission: vi.fn(),
}));

vi.mock("../../graphql/guards.js", () => guardMocks);
vi.mock("../../src/services/auth/authorization.service.js", () => authorizationMocks);
vi.mock("../../src/constants/permissions.js", () => ({
  PERMISSIONS: { ORDER_READ: "order.read" },
}));
vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../models/tableCustomer.model.js", () => ({
  default: {
    find: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }),
    }),
  },
}));
vi.mock("../../graphql/resolvers/order/helper/tableUtils.js", () => ({
  resolveTableSafe: vi.fn(),
}));
vi.mock("../../src/services/orderItemPricing.service.js", () => ({ buildPricedOrderItems: vi.fn() }));
vi.mock("../../src/services/ai/demandForecast.service.js", () => ({ buildDemandForecast: vi.fn() }));
vi.mock("../../src/services/ai/menuEngineeringAssistant.service.js", () => ({ buildMenuEngineeringAssistant: vi.fn() }));
vi.mock("../../src/services/ai/smartPromotionEngine.service.js", () => ({ buildSmartPromotionEngine: vi.fn() }));
vi.mock("../../src/services/performance/staffPerformanceReporting.service.js", () => ({ listStaffPerformanceSummaries: vi.fn() }));
vi.mock("../../src/services/performance/managerPerformanceDashboard.service.js", () => ({ getManagerPerformanceRiskEmployees: vi.fn() }));
vi.mock("../../src/services/discountCalculation.service.js", () => ({ calculateDiscountBreakdown: vi.fn() }));
vi.mock("../../src/services/orderTracking.service.js", () => ({
  ensureOrderTracking: vi.fn(),
  computePublicOrderStatus: vi.fn(),
  toCustomerTrackingPayload: vi.fn(),
  buildOrderTrackingQrDataUrl: vi.fn(),
}));
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
  const chain = {
    sort: vi.fn(() => chain),
    skip: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    where: vi.fn(() => chain),
    gt: vi.fn(() => chain),
    select: vi.fn(() => chain),
    lean: vi.fn(async () => rows),
  };
  return chain;
}

function buildSingleChain(row) {
  const chain = {
    sort: vi.fn(() => chain),
    select: vi.fn(() => chain),
    lean: vi.fn(async () => row),
  };
  return chain;
}

const managerCtx = { user: { id: "manager-1", roleName: "manager" } };

describe("order query restaurant access", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    guardMocks.requireAuth.mockImplementation(() => undefined);
    guardMocks.requireRestaurantAccess.mockResolvedValue(undefined);
    guardMocks.requireRoles.mockImplementation(() => undefined);
    authorizationMocks.requireRestaurantPermission.mockResolvedValue(true);
    modelMocks.KitchenOrderWorkItem.find.mockReturnValue(buildFindChain([]));
  });

  it("order(id) returns null for an invalid id without querying", async () => {
    const { OrderQuery } = await import("../../graphql/resolvers/order/query.js");
    await expect(OrderQuery.order(null, { id: "bad-id" }, managerCtx)).resolves.toBeNull();
    expect(modelMocks.Order.findById).not.toHaveBeenCalled();
    expect(authorizationMocks.requireRestaurantPermission).not.toHaveBeenCalled();
  });

  it("order(id) authorizes the stored restaurant", async () => {
    const order = { _id: "valid-order-2", restaurantId: "valid-r6" };
    modelMocks.Order.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue(order) });
    const { OrderQuery } = await import("../../graphql/resolvers/order/query.js");

    await expect(OrderQuery.order(null, { id: "valid-order-2" }, managerCtx)).resolves.toBe(order);
    expect(authorizationMocks.requireRestaurantPermission).toHaveBeenCalledWith(
      managerCtx,
      "valid-r6",
      "order.read",
    );
  });

  it("order(id) propagates restaurant authorization failures", async () => {
    authorizationMocks.requireRestaurantPermission.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
    modelMocks.Order.findById.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ _id: "valid-order-3", restaurantId: "valid-r7" }),
    });
    const { OrderQuery } = await import("../../graphql/resolvers/order/query.js");

    await expect(OrderQuery.order(null, { id: "valid-order-3" }, managerCtx)).rejects.toThrow(
      "FORBIDDEN_SCOPE",
    );
  });

  it("orders(filter) requires restaurant permission for scoped listings", async () => {
    const chain = buildFindChain([]);
    modelMocks.Order.find.mockReturnValue(chain);
    modelMocks.Order.countDocuments.mockResolvedValue(0);
    const { OrderQuery } = await import("../../graphql/resolvers/order/query.js");

    await OrderQuery.orders(
      null,
      { filter: { restaurantId: "valid-r5" }, limit: 10, offset: 0 },
      managerCtx,
    );

    expect(authorizationMocks.requireRestaurantPermission).toHaveBeenCalledWith(
      managerCtx,
      expect.objectContaining({ value: "valid-r5" }),
      "order.read",
    );
    expect(guardMocks.requireRoles).not.toHaveBeenCalled();
    expect(modelMocks.Order.find).toHaveBeenCalled();
  });

  it("orders(filter) requires ADMIN for global listings", async () => {
    modelMocks.Order.find.mockReturnValue(buildFindChain([]));
    modelMocks.Order.countDocuments.mockResolvedValue(0);
    const { OrderQuery } = await import("../../graphql/resolvers/order/query.js");

    await OrderQuery.orders(
      null,
      { filter: { status: "pending" }, limit: 10, offset: 0 },
      managerCtx,
    );

    expect(guardMocks.requireRoles).toHaveBeenCalledWith(managerCtx, ["ADMIN"]);
    expect(authorizationMocks.requireRestaurantPermission).not.toHaveBeenCalled();
  });

  it("orders(filter) rejects malformed restaurant ids before querying", async () => {
    const { OrderQuery } = await import("../../graphql/resolvers/order/query.js");
    await expect(
      OrderQuery.orders(
        null,
        { filter: { restaurantId: "bad-id" }, limit: 10, offset: 0 },
        managerCtx,
      ),
    ).rejects.toThrow("Invalid restaurantId");
    expect(modelMocks.Order.find).not.toHaveBeenCalled();
  });

  it("ordersByRestaurantNow uses the recovery resolver and restaurant permission", async () => {
    modelMocks.Order.find.mockReturnValue(
      buildFindChain([{ _id: "valid-order-1", restaurantId: "valid-r1", items: [] }]),
    );
    const { OrderCoreRecoveryQuery } = await import(
      "../../graphql/resolvers/order/queryCoreRecovery.js"
    );

    const result = await OrderCoreRecoveryQuery.ordersByRestaurantNow(
      null,
      { restaurantId: "valid-r1", limit: 1 },
      managerCtx,
    );

    expect(authorizationMocks.requireRestaurantPermission).toHaveBeenCalledWith(
      managerCtx,
      expect.objectContaining({ value: "valid-r1" }),
      "order.read",
    );
    expect(result.edges).toHaveLength(1);
  });

  it("activeTableSessionOrders returns linked child orders", async () => {
    modelMocks.Table.findOne.mockReturnValue(
      buildSingleChain({ _id: "valid-table-1", code: "T1" }),
    );
    modelMocks.Order.findOne.mockReturnValue(
      buildSingleChain({ _id: "valid-session-1", orderKind: "table_session" }),
    );
    modelMocks.Order.find.mockReturnValue(
      buildFindChain([{ _id: "valid-child-1", orderKind: "order_batch" }]),
    );
    const { OrderCoreRecoveryQuery } = await import(
      "../../graphql/resolvers/order/queryCoreRecovery.js"
    );

    const result = await OrderCoreRecoveryQuery.activeTableSessionOrders(
      null,
      { restaurantId: "valid-r1", tableId: "valid-table-1" },
      managerCtx,
    );

    expect(result.orders.map((order) => order._id)).toEqual(["valid-child-1"]);
  });

  it("managerDashboard checks the selected restaurant before loading data", async () => {
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
    const { default: dashboardResolver } = await import(
      "../../graphql/resolvers/dashboard/index.js"
    );

    await expect(
      dashboardResolver.Query.managerDashboard(
        null,
        { restaurantId: "valid-r3", range: "week" },
        managerCtx,
      ),
    ).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(modelMocks.Order.find).not.toHaveBeenCalled();
  });
});
