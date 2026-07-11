import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Order: {
    find: vi.fn(),
    countDocuments: vi.fn(),
  },
  Table: {
    findOne: vi.fn(),
  },
  User: {
    find: vi.fn(),
  },
  KitchenOrderWorkItem: {
    find: vi.fn(),
  },
}));

const authorizationMocks = vi.hoisted(() => ({
  requireRestaurantPermission: vi.fn(),
  requireAnyRestaurantPermission: vi.fn(),
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../models/tableCustomer.model.js", () => ({
  default: {
    find: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([]),
    })),
  },
}));
vi.mock("../../src/services/auth/authorization.service.js", () => authorizationMocks);
vi.mock("../../graphql/guards.js", () => ({
  requireRestaurantAccess: vi.fn(),
}));
vi.mock("../../graphql/resolvers/order/confirmedOrderPrintMutation.js", () => ({
  ConfirmedOrderPrintMutation: {},
}));
vi.mock("../../graphql/resolvers/order/helper/emitOrderEvent.js", () => ({
  emitOrderEvent: vi.fn(),
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
  return {
    sort: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(rows),
  };
}

function buildSelectLeanChain(rows = []) {
  return {
    select: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(rows),
  };
}

describe("OrderCoreRecoveryQuery station and table access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorizationMocks.requireRestaurantPermission.mockResolvedValue(undefined);
    authorizationMocks.requireAnyRestaurantPermission.mockResolvedValue(undefined);
    modelMocks.Order.countDocuments.mockResolvedValue(0);
    modelMocks.User.find.mockReturnValue(buildSelectLeanChain([]));
    modelMocks.KitchenOrderWorkItem.find.mockReturnValue(buildSelectLeanChain([]));
  });

  it("returns only bartender work with final KDS timing metadata", async () => {
    const restaurantId = "valid-restaurant-1";
    modelMocks.Order.find.mockReturnValue(
      buildFindChain([
        {
          _id: "valid-order-1",
          restaurantId,
          currentStatus: "confirmed",
          items: [
            {
              _id: "valid-kitchen-item",
              prepStation: "kitchen",
              name: "Phở bò",
              status: "pending",
            },
            {
              _id: "valid-bar-item",
              prepStation: "bar",
              name: "Trà đào",
              status: "preparing",
            },
          ],
        },
      ]),
    );
    modelMocks.KitchenOrderWorkItem.find.mockReturnValue(
      buildSelectLeanChain([
        {
          restaurantId,
          orderId: "valid-order-1",
          orderItemId: "valid-bar-item",
          station: "bar",
          actualPrepMinutes: 12,
          targetPrepMinutes: 8,
          timeLevel: "late",
          unaccepted: false,
        },
      ]),
    );

    const { OrderCoreRecoveryQuery } = await import(
      "../../graphql/resolvers/order/queryCoreRecovery.js"
    );
    const result = await OrderCoreRecoveryQuery.ordersByRestaurantNow(
      null,
      { restaurantId, limit: 20 },
      { user: { id: "bartender-1", roleName: "bartender" } },
    );

    expect(modelMocks.Order.find).toHaveBeenCalledWith(
      expect.objectContaining({ "items.prepStation": "bar" }),
    );
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].node.items).toEqual([
      expect.objectContaining({
        _id: "valid-bar-item",
        station: "bar",
        actualPrepMinutes: 12,
        targetPrepMinutes: 8,
        timeLevel: "late",
      }),
    ]);
  });

  it("allows host read-only table orders through reservation.read", async () => {
    const restaurantId = "valid-restaurant-2";
    const tableId = "valid-table-1";
    modelMocks.Table.findOne.mockReturnValue(
      buildSelectLeanChain({
        _id: tableId,
        code: "T01",
        mergedFromTableIds: [],
      }),
    );
    modelMocks.Order.find.mockReturnValue(
      buildFindChain([
        {
          _id: "valid-order-2",
          restaurantId,
          tableId,
          tableCode: "T01",
          orderCode: "ORD-2",
          currentStatus: "confirmed",
          createdAt: "2026-07-11T08:00:00.000Z",
          items: [
            {
              _id: "valid-item-2",
              prepStation: "kitchen",
              name: "Cơm gà",
              status: "pending",
            },
          ],
        },
      ]),
    );

    const { OrderCoreRecoveryQuery } = await import(
      "../../graphql/resolvers/order/queryCoreRecovery.js"
    );
    const result = await OrderCoreRecoveryQuery.ordersGroupedByTable(
      null,
      { restaurantId, tableId },
      { user: { id: "host-1", roleName: "host" } },
    );

    expect(authorizationMocks.requireAnyRestaurantPermission).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      ["order.read", "reservation.read"],
    );
    expect(result).toHaveLength(1);
    expect(result[0].orders[0]).toEqual(
      expect.objectContaining({ orderCode: "ORD-2", tableCode: "T01" }),
    );
  });
});
