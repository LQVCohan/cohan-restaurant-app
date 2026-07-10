import { describe, it, expect, beforeEach, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Warehouse: {
    findOne: vi.fn(),
    create: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    deleteOne: vi.fn(),
  },
  StockItem: {
    find: vi.fn(),
    countDocuments: vi.fn(),
    findOneAndUpdate: vi.fn(),
    findOne: vi.fn(),
  },
  StockMovement: { find: vi.fn(), create: vi.fn(), aggregate: vi.fn() },
  Ingredient: { find: vi.fn(), updateOne: vi.fn() },
  Supply: { find: vi.fn() },
}));

const guardMocks = vi.hoisted(() => ({ requireRestaurantAccess: vi.fn() }));
const sessionMocks = vi.hoisted(() => ({
  endSession: vi.fn(),
  withTransaction: vi.fn(async (fn) => fn()),
}));
const mongooseMocks = vi.hoisted(() => ({
  isValidObjectId: vi.fn((v) => String(v).startsWith("valid-")),
  startSession: vi.fn(async () => sessionMocks),
  Types: { ObjectId: vi.fn((v) => v) },
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../graphql/guards.js", () => guardMocks);
vi.mock("mongoose", () => ({ default: mongooseMocks }));

describe("inventory restaurant access guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    modelMocks.Warehouse.findOne.mockReturnValue({
      select: () => ({
        sort: () => ({
          lean: vi.fn().mockResolvedValue({
            _id: "valid-w1",
            restaurantId: "valid-r1",
            name: "Kho chính",
            code: "MAIN",
            isActive: true,
          }),
        }),
      }),
    });
    modelMocks.StockItem.find.mockReturnValue({
      select: () => ({ sort: () => ({ limit: () => ({ lean: vi.fn().mockResolvedValue([]) }) }) }),
    });
    modelMocks.StockMovement.find.mockReturnValue({
      select: () => ({ sort: () => ({ limit: () => ({ lean: vi.fn().mockResolvedValue([]) }) }) }),
    });
    modelMocks.Warehouse.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue({ restaurantId: "valid-r1" }) });
    modelMocks.Warehouse.findByIdAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: "valid-w1" }) });
    modelMocks.StockItem.findOneAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue({}) });
    modelMocks.StockItem.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue({}), session: vi.fn() });
    modelMocks.StockMovement.aggregate.mockResolvedValue([]);
    guardMocks.requireRestaurantAccess.mockResolvedValue();
  });

  it("warehouses calls guard and returns only the default warehouse", async () => {
    const query = (await import("../../graphql/resolvers/inventory/warehouse.query.js")).default;
    const result = await query.warehouses(
      null,
      { restaurantId: "valid-r1" },
      { user: { id: "u1", roleName: "manager" } },
    );
    expect(guardMocks.requireRestaurantAccess).toHaveBeenCalled();
    expect(modelMocks.Warehouse.findOne).toHaveBeenCalledWith({
      restaurantId: "valid-r1",
      isActive: true,
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ name: "Kho chính", code: "MAIN" });
  });

  it("warehouses denied does not call findOne", async () => {
    const query = (await import("../../graphql/resolvers/inventory/warehouse.query.js")).default;
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
    await expect(query.warehouses(null, { restaurantId: "valid-r1" }, {})).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(modelMocks.Warehouse.findOne).not.toHaveBeenCalled();
  });

  it("createWarehouse denied does not call create", async () => {
    const mutation = (await import("../../graphql/resolvers/inventory/warehouse.mutation.js")).default;
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
    await expect(mutation.createWarehouse(null, { input: { restaurantId: "valid-r1" } }, {})).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(modelMocks.Warehouse.create).not.toHaveBeenCalled();
  });

  it("updateWarehouse guards existing restaurant and ignores restaurantId patch", async () => {
    const mutation = (await import("../../graphql/resolvers/inventory/warehouse.mutation.js")).default;
    await mutation.updateWarehouse(null, { input: { id: "valid-w1", restaurantId: "valid-r2", name: "N" } }, { user: { id: "u1", roleName: "manager" } });
    expect(modelMocks.Warehouse.findById).toHaveBeenCalledWith("valid-w1");
    expect(guardMocks.requireRestaurantAccess).toHaveBeenCalledWith({ user: { id: "u1", roleName: "manager" } }, "valid-r1");
    expect(modelMocks.Warehouse.findByIdAndUpdate).toHaveBeenCalledWith(
      "valid-w1",
      { $set: { name: "N" } },
      { new: true, runValidators: true },
    );
  });

  it("deleteWarehouse denied does not call count/delete", async () => {
    const mutation = (await import("../../graphql/resolvers/inventory/warehouse.mutation.js")).default;
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
    await expect(mutation.deleteWarehouse(null, { id: "valid-w1" }, {})).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(modelMocks.StockItem.countDocuments).not.toHaveBeenCalled();
    expect(modelMocks.Warehouse.deleteOne).not.toHaveBeenCalled();
  });

  it("stockItems denied does not call find", async () => {
    const query = (await import("../../graphql/resolvers/inventory/stock.query.js")).default;
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
    await expect(query.stockItems(null, { restaurantId: "valid-r1" }, {})).rejects.toThrow();
    expect(modelMocks.StockItem.find).not.toHaveBeenCalled();
  });

  it("supplyStockItems denied does not call find", async () => {
    const query = (await import("../../graphql/resolvers/inventory/stock.query.js")).default;
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
    await expect(query.supplyStockItems(null, { restaurantId: "valid-r1" }, {})).rejects.toThrow();
    expect(modelMocks.StockItem.find).not.toHaveBeenCalled();
  });

  it("receiveStock denied before startSession/writes", async () => {
    const m = (await import("../../graphql/resolvers/inventory/stock.mutation.js")).default;
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
    await expect(m.receiveStock(null, { restaurantId: "valid-r1", warehouseId: "valid-w1", ingredientId: "valid-i1", qty: 1, costPerBaseUnit: 1 }, {})).rejects.toThrow();
    expect(mongooseMocks.startSession).not.toHaveBeenCalled();
    expect(modelMocks.StockItem.findOneAndUpdate).not.toHaveBeenCalled();
    expect(modelMocks.StockMovement.create).not.toHaveBeenCalled();
  });

  it("upsertStockItem denied does not call findOneAndUpdate", async () => {
    const m = (await import("../../graphql/resolvers/inventory/stock.mutation.js")).default;
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
    await expect(m.upsertStockItem(null, { restaurantId: "valid-r1", warehouseId: "valid-w1", ingredientId: "valid-i1" }, {})).rejects.toThrow();
    expect(modelMocks.StockItem.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("adjustStock denied before startSession/writes", async () => {
    const m = (await import("../../graphql/resolvers/inventory/stock.mutation.js")).default;
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
    await expect(m.adjustStock(null, { restaurantId: "valid-r1", warehouseId: "valid-w1", ingredientId: "valid-i1", qty: 1 }, {})).rejects.toThrow();
    expect(mongooseMocks.startSession).not.toHaveBeenCalled();
    expect(modelMocks.StockItem.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("transferStock denied before startSession/findOne", async () => {
    const m = (await import("../../graphql/resolvers/inventory/stock.mutation.js")).default;
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
    await expect(m.transferStock(null, { restaurantId: "valid-r1", fromWarehouseId: "valid-w1", toWarehouseId: "valid-w2", ingredientId: "valid-i1", qty: 1 }, {})).rejects.toThrow();
    expect(mongooseMocks.startSession).not.toHaveBeenCalled();
    expect(modelMocks.StockItem.findOne).not.toHaveBeenCalled();
  });

  it("stockMovements denied does not call find", async () => {
    const q = (await import("../../graphql/resolvers/inventory/movement.query.js")).default;
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
    await expect(q.stockMovements(null, { restaurantId: "valid-r1" }, {})).rejects.toThrow();
    expect(modelMocks.StockMovement.find).not.toHaveBeenCalled();
  });

  it("stockMovementSummary denied does not call aggregate", async () => {
    const q = (await import("../../graphql/resolvers/inventory/movement.query.js")).default;
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
    await expect(q.stockMovementSummary(null, { restaurantId: "valid-r1" }, {})).rejects.toThrow();
    expect(modelMocks.StockMovement.aggregate).not.toHaveBeenCalled();
  });
});
