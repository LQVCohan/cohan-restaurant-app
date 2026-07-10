import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Warehouse: {
    find: vi.fn(),
    findById: vi.fn(),
    countDocuments: vi.fn(),
    deleteOne: vi.fn(),
  },
  StockItem: {
    countDocuments: vi.fn(),
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
  StockMovement: { create: vi.fn() },
  Ingredient: { updateOne: vi.fn() },
}));

const authMocks = vi.hoisted(() => ({
  requireRestaurantPermission: vi.fn(),
}));

const sessionMocks = vi.hoisted(() => ({
  withTransaction: vi.fn(async (callback) => callback()),
  endSession: vi.fn(),
}));

const mongooseMocks = vi.hoisted(() => ({
  isValidObjectId: vi.fn((value) => String(value).startsWith("valid-")),
  startSession: vi.fn(async () => sessionMocks),
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/auth/authorization.service.js", () => authMocks);
vi.mock("mongoose", () => ({ default: mongooseMocks }));

const restaurantId = "valid-r1";
const sourceWarehouseId = "valid-w1";
const targetWarehouseId = "valid-w2";
const ingredientId = "valid-i1";

beforeEach(() => {
  vi.clearAllMocks();
  authMocks.requireRestaurantPermission.mockResolvedValue(true);
  modelMocks.Warehouse.countDocuments.mockResolvedValue(2);
  modelMocks.StockItem.countDocuments.mockResolvedValue(0);
});

describe("multi-warehouse inventory flow", () => {
  it("returns every active warehouse in restaurant scope", async () => {
    const rows = [
      { _id: sourceWarehouseId, name: "Kho chính" },
      { _id: targetWarehouseId, name: "Kho lạnh" },
    ];
    const lean = vi.fn(async () => rows);
    const sort = vi.fn(() => ({ lean }));
    const select = vi.fn(() => ({ sort }));
    modelMocks.Warehouse.find.mockReturnValue({ select });

    const query = (await import("../../graphql/resolvers/inventory/warehouse.query.js")).default;
    const result = await query.warehouses(null, { restaurantId }, { user: { id: "manager-1" } });

    expect(authMocks.requireRestaurantPermission).toHaveBeenCalled();
    expect(modelMocks.Warehouse.find).toHaveBeenCalledWith({
      restaurantId,
      isActive: true,
    });
    expect(result).toEqual(rows);
  });

  it("does not delete the final active warehouse", async () => {
    modelMocks.Warehouse.findById.mockReturnValue({
      lean: vi.fn(async () => ({
        _id: sourceWarehouseId,
        restaurantId,
        isActive: true,
      })),
    });
    modelMocks.Warehouse.countDocuments.mockResolvedValue(1);

    const mutation = (await import("../../graphql/resolvers/inventory/warehouse.mutation.js")).default;

    await expect(
      mutation.deleteWarehouse(null, { id: sourceWarehouseId }, { user: { id: "manager-1" } }),
    ).rejects.toThrow("ít nhất một kho");
    expect(modelMocks.Warehouse.deleteOne).not.toHaveBeenCalled();
  });

  it("rejects transfer to the same warehouse before writing", async () => {
    const mutation = (await import("../../graphql/resolvers/inventory/stock.mutation.js")).default;

    await expect(
      mutation.transferStock(
        null,
        {
          restaurantId,
          fromWarehouseId: sourceWarehouseId,
          toWarehouseId: sourceWarehouseId,
          ingredientId,
          qty: 1,
        },
        { user: { id: "manager-1" } },
      ),
    ).rejects.toThrow("phải khác nhau");
    expect(mongooseMocks.startSession).not.toHaveBeenCalled();
  });

  it("rejects warehouses outside the selected restaurant", async () => {
    modelMocks.Warehouse.countDocuments.mockResolvedValue(1);
    const mutation = (await import("../../graphql/resolvers/inventory/stock.mutation.js")).default;

    await expect(
      mutation.transferStock(
        null,
        {
          restaurantId,
          fromWarehouseId: sourceWarehouseId,
          toWarehouseId: targetWarehouseId,
          ingredientId,
          qty: 1,
        },
        { user: { id: "manager-1" } },
      ),
    ).rejects.toThrow("cùng nhà hàng");
    expect(mongooseMocks.startSession).not.toHaveBeenCalled();
  });

  it("transfers only stock that is not reserved", async () => {
    const save = vi.fn();
    modelMocks.StockItem.findOne.mockReturnValue({
      session: vi.fn(async () => ({ onHand: 10, reserved: 8, save })),
    });
    const mutation = (await import("../../graphql/resolvers/inventory/stock.mutation.js")).default;

    await expect(
      mutation.transferStock(
        null,
        {
          restaurantId,
          fromWarehouseId: sourceWarehouseId,
          toWarehouseId: targetWarehouseId,
          ingredientId,
          qty: 3,
        },
        { user: { id: "manager-1" } },
      ),
    ).rejects.toThrow("tồn khả dụng");
    expect(save).not.toHaveBeenCalled();
    expect(modelMocks.StockItem.findOneAndUpdate).not.toHaveBeenCalled();
    expect(sessionMocks.endSession).toHaveBeenCalledTimes(1);
  });
});
