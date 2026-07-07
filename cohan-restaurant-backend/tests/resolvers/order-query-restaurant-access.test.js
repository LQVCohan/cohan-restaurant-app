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
  Promotion: { countDocuments: vi.fn() },
  Staff: { countDocuments: vi.fn(), find: vi.fn() },
  Review: { find: vi.fn() },
  KitchenOrderWorkItem: { find: vi.fn() },
  Reservation: { find: vi.fn(), countDocuments: vi.fn() },
}));

const guardMocks = vi.hoisted(() => ({
  requireRestaurantAccess: vi.fn(),
  requireRoles: vi.fn(),
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

function buildLeanSelectChain(rows = []) {
  return {
    select: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(rows),
  };
}

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
    guardMocks.requireRoles.mockImplementation(() => undefined);
    modelMocks.Order.findOne.mockReset();
    modelMocks.KitchenOrderWorkItem.find.mockReturnValue(buildLeanSelectChain([]));
  });

  it("order(id) returns null for invalid id without querying", async () => {
    const { OrderQuery } = await import("../../graphql/resolvers/order/query.js");

    const result = await OrderQuery.order(
      null,
      { id: "bad-id" },
      { user: { id: "manager-1", roleName: "manager" } },
    );

    expect(result).toBeNull();
    expect(modelMocks.Order.findById).not.toHaveBeenCalled();
    expect(guardMocks.requireRestaurantAccess).not.toHaveBeenCalled();
  });

  it("order(id) returns null when order is not found", async () => {
    const { OrderQuery } = await import("../../graphql/resolvers/order/query.js");
    modelMocks.Order.findById.mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    });

    const result = await OrderQuery.order(
      null,
      { id: "valid-order-1" },
      { user: { id: "manager-1", roleName: "manager" } },
    );

    expect(result).toBeNull();
    expect(modelMocks.Order.findById).toHaveBeenCalledWith("valid-order-1");
    expect(guardMocks.requireRestaurantAccess).not.toHaveBeenCalled();
  });

  it("order(id) enforces restaurant access and returns order", async () => {
    const { OrderQuery } = await import("../../graphql/resolvers/order/query.js");
    const order = { _id: "valid-order-2", restaurantId: "valid-r6" };
    modelMocks.Order.findById.mockReturnValue({
      lean: vi.fn().mockResolvedValue(order),
    });

    const result = await OrderQuery.order(
      null,
      { id: "valid-order-2" },
      { user: { id: "manager-1", roleName: "manager" } },
    );

    expect(guardMocks.requireRestaurantAccess).toHaveBeenCalledWith(
      expect.anything(),
      "valid-r6",
    );
    expect(result).toBe(order);
  });

  it("order(id) propagates access denied errors", async () => {
    guardMocks.requireRestaurantAccess.mockRejectedValue(
      new Error("FORBIDDEN_SCOPE"),
    );
    const { OrderQuery } = await import("../../graphql/resolvers/order/query.js");
    modelMocks.Order.findById.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: "valid-order-3",
        restaurantId: "valid-r7",
      }),
    });

    await expect(
      OrderQuery.order(
        null,
        { id: "valid-order-3" },
        { user: { id: "staff-1", roleName: "manager" } },
      ),
    ).rejects.toThrow("FORBIDDEN_SCOPE");

    expect(guardMocks.requireRestaurantAccess).toHaveBeenCalledWith(
      expect.anything(),
      "valid-r7",
    );
  });

  it("guards ordersByRestaurantNow and continues query when access is allowed", async () => {
    const { OrderQuery } = await import("../../graphql/resolvers/order/query.js");
    const chain = buildFindChain([{ _id: "row-1", restaurantId: "valid-r1" }]);
    modelMocks.Order.find.mockReturnValue(chain);

    const result = await OrderQuery.ordersByRestaurantNow(
      null,
      { restaurantId: "valid-r1", limit: 1 },
      { user: { id: "manager-1", roleName: "manager" } },
    );

    expect(guardMocks.requireRestaurantAccess).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ value: "valid-r1" }),
    );
    expect(modelMocks.Order.find).toHaveBeenCalled();
    expect(modelMocks.Order.find.mock.calls[0][0]).toMatchObject({
      $and: [
        expect.objectContaining({
          restaurantId: expect.objectContaining({ value: "valid-r1" }),
        }),
        expect.objectContaining({ $or: expect.any(Array) }),
      ],
    });
    expect(result.edges).toHaveLength(1);
  });


  it("enriches ordersByRestaurantNow work items only within the requested restaurant", async () => {
    const { OrderQuery } = await import("../../graphql/resolvers/order/query.js");
    const chain = buildFindChain([
      {
        _id: "valid-order-tenant",
        restaurantId: "valid-r1",
        items: [{ _id: "item-1", name: "Phở bò", status: "pending" }],
      },
    ]);
    modelMocks.Order.find.mockReturnValue(chain);
    modelMocks.KitchenOrderWorkItem.find.mockReturnValue(
      buildLeanSelectChain([
        {
          restaurantId: "valid-other-restaurant",
          orderId: "valid-order-tenant",
          orderItemId: "item-1",
          station: "bar",
          timeLevel: "very_late",
          unaccepted: true,
        },
      ]),
    );

    const result = await OrderQuery.ordersByRestaurantNow(
      null,
      { restaurantId: "valid-r1", limit: 1 },
      { user: { id: "manager-1", roleName: "manager" } },
    );

    expect(modelMocks.KitchenOrderWorkItem.find).toHaveBeenCalledWith({
      restaurantId: expect.objectContaining({ value: "valid-r1" }),
      orderId: { $in: ["valid-order-tenant"] },
    });
    expect(result.edges[0].node.items[0]).not.toHaveProperty("station", "bar");
    expect(result.edges[0].node.items[0]).not.toHaveProperty("timeLevel", "very_late");
    expect(result.edges[0].node.items[0]).not.toHaveProperty("unaccepted", true);
  });

  it("enriches ordersByRestaurantNow items with same-restaurant KitchenOrderWorkItem metadata", async () => {
    const { OrderQuery } = await import("../../graphql/resolvers/order/query.js");
    const chain = buildFindChain([
      {
        _id: "valid-order-tenant",
        restaurantId: "valid-r1",
        items: [{ _id: "item-1", name: "Trà đào", status: "preparing" }],
      },
    ]);
    modelMocks.Order.find.mockReturnValue(chain);
    modelMocks.KitchenOrderWorkItem.find.mockReturnValue(
      buildLeanSelectChain([
        {
          restaurantId: "valid-r1",
          orderId: "valid-order-tenant",
          orderItemId: "item-1",
          station: "bar",
          targetPrepMinutes: 10,
          timeLevel: "late",
          unaccepted: false,
        },
      ]),
    );

    const result = await OrderQuery.ordersByRestaurantNow(
      null,
      { restaurantId: "valid-r1", limit: 1 },
      { user: { id: "manager-1", roleName: "manager" } },
    );

    expect(result.edges[0].node.items[0]).toMatchObject({
      station: "bar",
      targetPrepMinutes: 10,
      timeLevel: "late",
      unaccepted: false,
    });
  });

  it("falls back to the order item prepStation when no KitchenOrderWorkItem exists", async () => {
    const { OrderQuery } = await import("../../graphql/resolvers/order/query.js");
    const chain = buildFindChain([
      {
        _id: "valid-order-snapshot",
        restaurantId: "valid-r1",
        items: [
          {
            _id: "item-bar-snapshot",
            name: "Trà vải",
            status: "pending",
            prepStation: "bar",
          },
        ],
      },
    ]);
    modelMocks.Order.find.mockReturnValue(chain);
    modelMocks.KitchenOrderWorkItem.find.mockReturnValue(buildLeanSelectChain([]));

    const result = await OrderQuery.ordersByRestaurantNow(
      null,
      { restaurantId: "valid-r1", limit: 1 },
      { user: { id: "manager-1", roleName: "manager" } },
    );

    expect(result.edges[0].node.items[0].station).toBe("bar");
  });

  it("blocks ordersByRestaurantNow when access is denied", async () => {
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
    const { OrderQuery } = await import("../../graphql/resolvers/order/query.js");

    await expect(
      OrderQuery.ordersByRestaurantNow(
        null,
        { restaurantId: "valid-r2", limit: 10 },
        { user: { id: "staff-1", roleName: "manager" } },
      ),
    ).rejects.toThrow("FORBIDDEN_SCOPE");

    expect(modelMocks.Order.find).not.toHaveBeenCalled();
  });

  it("guards managerDashboard by restaurant", async () => {
    const { OrderQuery } = await import("../../graphql/resolvers/order/query.js");
    modelMocks.Order.find
      .mockReturnValueOnce({ lean: vi.fn().mockResolvedValue([]) })
      .mockReturnValueOnce({ lean: vi.fn().mockResolvedValue([]) })
      .mockReturnValueOnce({ sort: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }) }) })
      .mockReturnValueOnce(buildFindChain([]))
      .mockReturnValueOnce(buildFindChain([]));
    modelMocks.Reservation.find.mockReturnValue(buildFindChain([]));
    modelMocks.Reservation.countDocuments.mockResolvedValue(0);
    modelMocks.Order.countDocuments.mockResolvedValue(0);
    modelMocks.Table.find.mockReturnValue(buildFindChain([]));
    modelMocks.Table.countDocuments.mockResolvedValue(0);
    modelMocks.MenuItem.countDocuments.mockResolvedValue(0);
    modelMocks.Customer.countDocuments.mockResolvedValue(0);
    modelMocks.Promotion.countDocuments.mockResolvedValue(0);
    modelMocks.Staff.countDocuments.mockResolvedValue(0);
    modelMocks.StockItem.find.mockReturnValue({ limit: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }) });
    modelMocks.Staff.find.mockReturnValue({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }) });
    modelMocks.Review.find.mockReturnValue({ sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]), limit: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }) }) });

    const res = await OrderQuery.managerDashboard(
      null,
      { restaurantId: "valid-r3", range: "week" },
      { user: { id: "manager-1", roleName: "manager" } },
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
      { user: { id: "manager-1", roleName: "manager" } },
    );

    expect(guardMocks.requireRestaurantAccess).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ value: "valid-r4" }),
    );
  });

  it("orders(filter) enforces restaurant scope or ADMIN for global listing", async () => {
    const { OrderQuery } = await import("../../graphql/resolvers/order/query.js");

    modelMocks.Order.find.mockReturnValue(buildFindChain([]));
    modelMocks.Order.countDocuments.mockResolvedValue(0);

    await OrderQuery.orders(
      null,
      { filter: { restaurantId: "valid-r5" }, limit: 10, offset: 0 },
      { user: { id: "manager-1", roleName: "manager" } },
    );

    expect(guardMocks.requireRestaurantAccess).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ value: "valid-r5" }),
    );
    expect(guardMocks.requireRoles).not.toHaveBeenCalled();

    vi.clearAllMocks();
    modelMocks.Order.find.mockReturnValue(buildFindChain([]));
    modelMocks.Order.countDocuments.mockResolvedValue(0);

    await OrderQuery.orders(
      null,
      { filter: { status: "pending" }, limit: 10, offset: 0 },
      { user: { id: "manager-1", roleName: "manager" } },
    );

    expect(guardMocks.requireRoles).toHaveBeenCalledWith(
      expect.anything(),
      ["ADMIN"],
    );
    expect(guardMocks.requireRestaurantAccess).not.toHaveBeenCalled();
    expect(modelMocks.Order.find).toHaveBeenCalled();
  });

  it("orders(filter: {}) rejects non-admin/global listing when requireRoles throws", async () => {
    const { OrderQuery } = await import("../../graphql/resolvers/order/query.js");
    guardMocks.requireRoles.mockImplementation(() => {
      throw new Error("FORBIDDEN");
    });

    await expect(
      OrderQuery.orders(
        null,
        { filter: { status: "pending" }, limit: 10, offset: 0 },
        { user: { id: "staff-1", roleName: "manager" } },
      ),
    ).rejects.toThrow("FORBIDDEN");

    expect(guardMocks.requireRestaurantAccess).not.toHaveBeenCalled();
    expect(modelMocks.Order.find).not.toHaveBeenCalled();
    expect(modelMocks.Order.countDocuments).not.toHaveBeenCalled();
  });

  it("orders(filter) with valid restaurantId does not require ADMIN", async () => {
    const { OrderQuery } = await import("../../graphql/resolvers/order/query.js");
    guardMocks.requireRoles.mockImplementation(() => {
      throw new Error("should not call requireRoles");
    });
    modelMocks.Order.find.mockReturnValue(buildFindChain([]));
    modelMocks.Order.countDocuments.mockResolvedValue(0);

    await OrderQuery.orders(
      null,
      { filter: { restaurantId: "valid-r5" }, limit: 10, offset: 0 },
      { user: { id: "manager-1", roleName: "manager" } },
    );

    expect(guardMocks.requireRestaurantAccess).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ value: "valid-r5" }),
    );
    expect(guardMocks.requireRoles).not.toHaveBeenCalled();
    expect(modelMocks.Order.find).toHaveBeenCalled();
    expect(modelMocks.Order.find.mock.calls[0][0]).toHaveProperty("$and");
    expect(modelMocks.Order.countDocuments).toHaveBeenCalled();
  });

  it("orders(filter) throws on invalid restaurantId and skips query", async () => {
    const { OrderQuery } = await import("../../graphql/resolvers/order/query.js");

    await expect(
      OrderQuery.orders(
        null,
        { filter: { restaurantId: "bad-id" }, limit: 10, offset: 0 },
        { user: { id: "manager-1", roleName: "manager" } },
      ),
    ).rejects.toThrow("Invalid restaurantId");

    expect(guardMocks.requireRestaurantAccess).not.toHaveBeenCalled();
    expect(modelMocks.Order.find).not.toHaveBeenCalled();
    expect(modelMocks.Order.countDocuments).not.toHaveBeenCalled();
  });

  it("activeTableSessionOrders returns child orders when active session has linked children", async () => {
    const { OrderQuery } = await import("../../graphql/resolvers/order/query.js");
    modelMocks.Table.findOne.mockReturnValue({
      select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: "valid-table-1", code: "T1" }) }),
    });
    modelMocks.Order.findOne.mockReturnValue({
      sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: "sess-1", orderKind: "table_session" }) }),
    });
    modelMocks.Order.find
      .mockReturnValueOnce({ sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([{ _id: "child-1", orderKind: "order_batch" }]) }) });

    const out = await OrderQuery.activeTableSessionOrders(
      null,
      { restaurantId: "valid-r1", tableId: "valid-table-1" },
      { user: { id: "m1", roleName: "manager" } },
    );
    expect(out.orders.map((o) => o._id)).toEqual(["child-1"]);
  });

  it("activeTableSessionOrders falls back to legacy table orders when child query is empty", async () => {
    const { OrderQuery } = await import("../../graphql/resolvers/order/query.js");
    modelMocks.Table.findOne.mockReturnValue({
      select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: "valid-table-1", code: "T1" }) }),
    });
    modelMocks.Order.findOne.mockReturnValue({
      sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: "sess-2", orderKind: "table_session" }) }),
    });
    modelMocks.Order.find
      .mockReturnValueOnce({ sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }) })
      .mockReturnValueOnce({ sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([{ _id: "legacy-1", orderKind: "order_batch" }]) }) });

    const out = await OrderQuery.activeTableSessionOrders(
      null,
      { restaurantId: "valid-r1", tableId: "valid-table-1" },
      { user: { id: "m1", roleName: "manager" } },
    );
    expect(out.orders.map((o) => o._id)).toEqual(["legacy-1"]);
  });

  it("activeTableSessionOrders returns empty orders when both child and legacy are empty", async () => {
    const { OrderQuery } = await import("../../graphql/resolvers/order/query.js");
    modelMocks.Table.findOne.mockReturnValue({
      select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: "valid-table-1", code: "T1" }) }),
    });
    modelMocks.Order.findOne.mockReturnValue({
      sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: "sess-3", orderKind: "table_session" }) }),
    });
    modelMocks.Order.find
      .mockReturnValueOnce({ sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }) })
      .mockReturnValueOnce({ sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }) });
    const out = await OrderQuery.activeTableSessionOrders(
      null,
      { restaurantId: "valid-r1", tableId: "valid-table-1" },
      { user: { id: "m1", roleName: "manager" } },
    );
    expect(out.orders).toEqual([]);
  });

  it("activeTableSessionOrders never returns table_session rows in orders[]", async () => {
    const { OrderQuery } = await import("../../graphql/resolvers/order/query.js");
    modelMocks.Table.findOne.mockReturnValue({
      select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: "valid-table-1", code: "T1" }) }),
    });
    modelMocks.Order.findOne.mockReturnValue({
      sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: "sess-4", orderKind: "table_session" }) }),
    });
    modelMocks.Order.find.mockReturnValueOnce({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { _id: "sess-row", orderKind: "table_session" },
          { _id: "child-2", orderKind: "order_batch" },
        ]),
      }),
    });
    const out = await OrderQuery.activeTableSessionOrders(
      null,
      { restaurantId: "valid-r1", tableId: "valid-table-1" },
      { user: { id: "m1", roleName: "manager" } },
    );
    expect(out.orders.map((o) => o._id)).toEqual(["child-2"]);
  });
});
