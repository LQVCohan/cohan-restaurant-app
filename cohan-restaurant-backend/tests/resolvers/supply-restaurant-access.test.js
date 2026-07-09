import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRestaurantAccess = vi.fn();
const listSupplyCategories = vi.fn();
const suggestSupplyCategory = vi.fn();
const findOrCreateSupplyCategory = vi.fn();
const toEnglishCategoryName = vi.fn((v) => v || "Other");
const isValidObjectId = vi.fn(
  (v) => typeof v === "string" && (v.startsWith("valid-") || /^[a-fA-F0-9]{24}$/.test(v))
);

const Supply = {
  find: vi.fn(),
  findOne: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  findByIdAndDelete: vi.fn(),
};
const StockItem = {
  find: vi.fn(),
  findOne: vi.fn(),
  findOneAndUpdate: vi.fn(),
  deleteMany: vi.fn(),
};
const StockMovement = { create: vi.fn() };
const SupplyCategory = { updateOne: vi.fn() };
const Warehouse = { findById: vi.fn(), find: vi.fn() };

const mockSession = {
  startTransaction: vi.fn(),
  commitTransaction: vi.fn(),
  abortTransaction: vi.fn(),
  endSession: vi.fn(),
  withTransaction: vi.fn(async (fn) => fn()),
};

vi.mock("../../graphql/guards.js", () => ({ requireRestaurantAccess }));
vi.mock("../../src/services/auth/authorization.service.js", () => ({
  requireRestaurantPermission: vi.fn((ctx, restaurantId) => requireRestaurantAccess(ctx, restaurantId)),
}));
vi.mock("../../graphql/resolvers/supply/category-ai.js", () => ({ listSupplyCategories, suggestSupplyCategory }));
vi.mock("../../graphql/resolvers/supply/mutation.support.js", () => ({ findOrCreateSupplyCategory, isValidObjectId, toEnglishCategoryName }));
vi.mock("../../models/index.js", () => ({ Supply, StockItem, StockMovement, SupplyCategory }));
vi.mock("../../models/warehouse.model.js", () => ({ default: Warehouse }));
vi.mock("mongoose", async (orig) => {
  const actual = await orig();
  return { ...actual, default: { ...actual.default, isValidObjectId, startSession: vi.fn(async () => mockSession) } };
});

const queryResolver = (await import("../../graphql/resolvers/supply/query.js")).default;
const mutationResolver = (await import("../../graphql/resolvers/supply/mutation.js")).default;
const ctx = { user: { id: "u1" } };

beforeEach(() => {
  vi.clearAllMocks();
  requireRestaurantAccess.mockResolvedValue(true);
});

describe("supply restaurant access hardening", () => {
  it("query guards denied paths", async () => {
    requireRestaurantAccess.mockRejectedValueOnce(new Error("denied"));
    await expect(queryResolver.supplyCategories(null, { restaurantId: "valid-r1" }, ctx)).rejects.toThrow("denied");
    expect(listSupplyCategories).not.toHaveBeenCalled();

    requireRestaurantAccess.mockRejectedValueOnce(new Error("denied"));
    await expect(queryResolver.suggestSupplyCategory(null, { restaurantId: "valid-r1" }, ctx)).rejects.toThrow("denied");
    expect(suggestSupplyCategory).not.toHaveBeenCalled();

    Supply.find.mockReturnValue({ select: () => ({ sort: () => ({ lean: vi.fn() }) }) });
    requireRestaurantAccess.mockRejectedValueOnce(new Error("denied"));
    await expect(queryResolver.supplies(null, { restaurantId: "valid-r1" }, ctx)).rejects.toThrow("denied");
    expect(Supply.find).not.toHaveBeenCalled();
    expect(StockItem.find).not.toHaveBeenCalled();

    Supply.findOne.mockReturnValueOnce({ lean: vi.fn().mockResolvedValue({ _id: "s1", restaurantId: "valid-r1" }) });
    requireRestaurantAccess.mockRejectedValueOnce(new Error("denied"));
    await expect(queryResolver.supply(null, { id: "valid-s1" }, ctx)).rejects.toThrow("denied");
    expect(StockItem.find).not.toHaveBeenCalled();
  });

  it("create/update/delete guarded and update strips restaurantId", async () => {
    requireRestaurantAccess.mockRejectedValueOnce(new Error("denied"));
    await expect(mutationResolver.createSupply(null, { input: { restaurantId: "valid-r1" } }, ctx)).rejects.toThrow("denied");
    expect(findOrCreateSupplyCategory).not.toHaveBeenCalled();
    expect(Supply.create).not.toHaveBeenCalled();

    Supply.findOne.mockReturnValueOnce({ select: () => ({ lean: vi.fn().mockResolvedValue({ restaurantId: "valid-r1" }) }) });
    requireRestaurantAccess.mockRejectedValueOnce(new Error("denied"));
    await expect(mutationResolver.updateSupply(null, { id: "507f1f77bcf86cd799439011", input: {} }, ctx)).rejects.toThrow("denied");
    expect(mockSession.startTransaction).not.toHaveBeenCalled();

    const set = vi.fn();
    const save = vi.fn();
    Supply.findOne.mockReturnValueOnce({ select: () => ({ lean: vi.fn().mockResolvedValue({ restaurantId: "valid-r1" }) }) });
    Supply.findOne.mockReturnValueOnce({ session: vi.fn().mockResolvedValue({ set, save, restaurantId: "valid-r1", category: "c", sku: "", name: "n", toObject: vi.fn() }) });
    Supply.find.mockReturnValue({ select: () => ({ lean: () => ({ session: vi.fn().mockResolvedValue([]) }) }) });
    findOrCreateSupplyCategory.mockResolvedValue({ name: "Food" });
    await mutationResolver.updateSupply(null, { id: "507f1f77bcf86cd799439011", input: { restaurantId: "valid-r2", name: "A" } }, ctx);
    expect(set.mock.calls[0][0].restaurantId).toBeUndefined();

    Supply.findOne.mockReturnValueOnce({ restaurantId: "valid-r1", set: vi.fn(), save: vi.fn() });
    requireRestaurantAccess.mockRejectedValueOnce(new Error("denied"));
    await expect(mutationResolver.deleteSupply(null, { id: "valid-s1" }, ctx)).rejects.toThrow("denied");
    expect(Supply.findByIdAndDelete).not.toHaveBeenCalled();
    expect(StockItem.deleteMany).not.toHaveBeenCalled();
  });

  it("stock operations guard and mismatch checks", async () => {
    requireRestaurantAccess.mockRejectedValueOnce(new Error("denied"));
    await expect(mutationResolver.adjustSupply(null, { input: { restaurantId: "valid-r1", warehouseId: "valid-w1", supplyId: "valid-s1", qty: 1 } }, ctx)).rejects.toThrow("denied");
    expect(Warehouse.findById).not.toHaveBeenCalled();

    Warehouse.findById.mockReturnValueOnce({ lean: vi.fn().mockResolvedValue({ restaurantId: "valid-r2" }) });
    await expect(mutationResolver.adjustSupply(null, { input: { restaurantId: "valid-r1", warehouseId: "valid-w1", supplyId: "valid-s1", qty: 1 } }, ctx)).rejects.toThrow("Warehouse does not belong");

    Warehouse.findById.mockReturnValueOnce({ lean: vi.fn().mockResolvedValue({ restaurantId: "valid-r1" }) });
    Supply.findOne.mockReturnValueOnce({ lean: vi.fn().mockResolvedValue(null) });
    await expect(mutationResolver.adjustSupply(null, { input: { restaurantId: "valid-r1", warehouseId: "valid-w1", supplyId: "valid-s1", qty: 1 } }, ctx)).rejects.toThrow("Không tìm thấy vật tư đang hoạt động");
    expect(StockItem.findOneAndUpdate).not.toHaveBeenCalled();

    requireRestaurantAccess.mockRejectedValueOnce(new Error("denied"));
    await expect(mutationResolver.stockInbound(null, { input: { restaurantId: "valid-r1", warehouseId: "valid-w1", supplyId: "valid-s1", qty: 1, costPerBaseUnit: 1 } }, ctx)).rejects.toThrow("denied");
    expect(Warehouse.findById).toHaveBeenCalledTimes(2);

    Warehouse.findById.mockReturnValueOnce({ lean: vi.fn().mockResolvedValue({ restaurantId: "valid-r2" }) });
    await expect(mutationResolver.stockInbound(null, { input: { restaurantId: "valid-r1", warehouseId: "valid-w1", supplyId: "valid-s1", qty: 1, costPerBaseUnit: 1 } }, ctx)).rejects.toThrow("Warehouse does not belong");

    requireRestaurantAccess.mockRejectedValueOnce(new Error("denied"));
    await expect(mutationResolver.stockOutbound(null, { input: { restaurantId: "valid-r1", warehouseId: "valid-w1", supplyId: "valid-s1", qty: 1 } }, ctx)).rejects.toThrow("denied");
    expect(StockItem.findOne).not.toHaveBeenCalled();

    requireRestaurantAccess.mockRejectedValueOnce(new Error("denied"));
    await expect(mutationResolver.stockTransfer(null, { input: { restaurantId: "valid-r1", fromWarehouseId: "valid-w1", toWarehouseId: "valid-w2", supplyId: "valid-s1", qty: 1 } }, ctx)).rejects.toThrow("denied");

    Supply.findOne.mockReturnValueOnce({ lean: vi.fn().mockResolvedValue({ restaurantId: "valid-r1" }) });
    Warehouse.find.mockReturnValueOnce({ lean: vi.fn().mockResolvedValue([{ _id: "w1" }]) });
    await expect(mutationResolver.stockTransfer(null, { input: { restaurantId: "valid-r1", fromWarehouseId: "valid-w1", toWarehouseId: "valid-w2", supplyId: "valid-s1", qty: 1 } }, ctx)).rejects.toThrow("Warehouse does not belong");
  });

  it("allowed smoke", async () => {
    Supply.find.mockReturnValue({ select: () => ({ sort: () => ({ lean: vi.fn().mockResolvedValue([]) }) }) });
    await queryResolver.supplies(null, { restaurantId: "valid-r1" }, ctx);
    expect(requireRestaurantAccess).toHaveBeenCalledWith(ctx, "valid-r1");
    expect(Supply.find).toHaveBeenCalled();

    findOrCreateSupplyCategory.mockResolvedValue({ _id: "c1", name: "Food" });
    Supply.find.mockReturnValue({ select: () => ({ lean: () => ({ session: vi.fn().mockResolvedValue([]) }) }) });
    Supply.create.mockResolvedValue([{ toObject: vi.fn().mockReturnValue({ id: "x" }) }]);
    await mutationResolver.createSupply(null, { input: { restaurantId: "valid-r1", name: "N" } }, ctx);
    expect(requireRestaurantAccess).toHaveBeenCalledWith(ctx, "valid-r1");

    const save = vi.fn();
    Supply.findOne.mockReturnValueOnce({ lean: vi.fn().mockResolvedValue({ restaurantId: "valid-r1" }) });
    StockItem.findOne.mockResolvedValue({ onHand: 10, batches: [{ qty: 10 }], save, toObject: vi.fn().mockReturnValue({ ok: true }) });
    await mutationResolver.stockOutbound(null, { input: { restaurantId: "valid-r1", warehouseId: "valid-w1", supplyId: "valid-s1", qty: 4 } }, ctx);
    expect(save).toHaveBeenCalled();
    expect(StockMovement.create).toHaveBeenCalled();
  });
});
