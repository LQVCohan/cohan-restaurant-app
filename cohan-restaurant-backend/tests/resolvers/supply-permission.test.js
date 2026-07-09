import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRestaurantPermission = vi.hoisted(() => vi.fn());
const modelMocks = vi.hoisted(() => ({
  Supply: {
    create: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
    findById: vi.fn(),
  },
  StockItem: {
    findOneAndUpdate: vi.fn(),
    findOne: vi.fn(),
  },
  StockMovement: { create: vi.fn() },
  SupplyCategory: { updateOne: vi.fn() },
}));
const warehouseMock = vi.hoisted(() => ({
  findById: vi.fn(),
  find: vi.fn(),
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../models/warehouse.model.js", () => ({ default: warehouseMock }));
vi.mock("../../src/services/auth/authorization.service.js", () => ({ requireRestaurantPermission }));
vi.mock("../../graphql/resolvers/supply/mutation.support.js", () => ({
  findOrCreateSupplyCategory: vi.fn(),
  isValidObjectId: vi.fn(() => true),
  toEnglishCategoryName: vi.fn((value) => value || "Other"),
}));

describe("supply mutation permissions", () => {
  const restaurantId = "507f1f77bcf86cd799439011";
  const warehouseId = "507f1f77bcf86cd799439012";
  const supplyId = "507f1f77bcf86cd799439013";

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    requireRestaurantPermission.mockRejectedValue(Object.assign(new Error("FORBIDDEN"), { extensions: { code: "FORBIDDEN" } }));
  });

  it("createSupply requires inventory.write before creating supply", async () => {
    const { default: mutations } = await import("../../graphql/resolvers/supply/mutation.js");

    await expect(
      mutations.createSupply(null, { input: { restaurantId, name: "Khăn giấy", unit: "unit" } }, { user: { id: "u1" } }),
    ).rejects.toThrow("FORBIDDEN");

    expect(requireRestaurantPermission).toHaveBeenCalledWith(
      expect.objectContaining({ user: expect.any(Object) }),
      restaurantId,
      "inventory.write",
    );
    expect(modelMocks.Supply.create).not.toHaveBeenCalled();
    expect(modelMocks.SupplyCategory.updateOne).not.toHaveBeenCalled();
  });

  it("stockInbound requires stock.write before writing stock movement", async () => {
    const { default: mutations } = await import("../../graphql/resolvers/supply/mutation.js");

    await expect(
      mutations.stockInbound(
        null,
        { input: { restaurantId, warehouseId, supplyId, qty: 1, costPerBaseUnit: 1000 } },
        { user: { id: "u1" } },
      ),
    ).rejects.toThrow("FORBIDDEN");

    expect(requireRestaurantPermission).toHaveBeenCalledWith(
      expect.objectContaining({ user: expect.any(Object) }),
      restaurantId,
      "stock.write",
    );
    expect(modelMocks.StockItem.findOneAndUpdate).not.toHaveBeenCalled();
    expect(modelMocks.StockMovement.create).not.toHaveBeenCalled();
  });
});