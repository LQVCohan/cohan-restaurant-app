import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Recipe: { find: vi.fn() },
  Ingredient: { find: vi.fn() },
  StockItem: {
    find: vi.fn(),
    findOne: vi.fn(),
    updateOne: vi.fn(),
    bulkWrite: vi.fn(),
  },
  StockMovement: { insertMany: vi.fn() },
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("mongoose", () => ({
  default: {
    startSession: vi.fn(),
    Types: { ObjectId: class ObjectId {} },
  },
}));

const modelQuery = (rows) => {
  const query = {
    session: vi.fn(() => query),
    lean: vi.fn(async () => rows),
  };
  return { select: vi.fn(() => query) };
};

describe("inventory service for untracked serving variants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    modelMocks.Ingredient.find.mockReturnValue(modelQuery([]));
  });

  it("treats a valid serving variant without ingredients as orderable and skips stock updates", async () => {
    modelMocks.Recipe.find.mockReturnValue(
      modelQuery([
        {
          menuItemId: "menu-item-1",
          servingVariants: [
            {
              key: "luộc",
              mode: "PORTION",
              sellQty: 1,
              sellUnit: "portion",
              ingredients: [],
            },
          ],
        },
      ]),
    );

    const { checkAvailabilityForLinesTx, reserveForOrderTx } = await import(
      "../../src/services/inventory.service.js"
    );
    const input = {
      restaurantId: "restaurant-1",
      warehouseId: "warehouse-1",
      lines: [
        {
          menuItemId: "menu-item-1",
          servingKey: "luộc",
          quantity: 3,
        },
      ],
      session: {},
    };

    await expect(checkAvailabilityForLinesTx(input)).resolves.toEqual({
      isAvailable: true,
      maxAvailable: Number.MAX_SAFE_INTEGER,
      shortages: [],
    });
    await expect(
      reserveForOrderTx({ ...input, orderCode: "ORDER-1" }),
    ).resolves.toEqual({
      success: true,
      totalConsumed: 0,
      movements: [],
      lowStocks: [],
    });

    expect(modelMocks.Ingredient.find).toHaveBeenCalledTimes(2);
    expect(modelMocks.StockItem.find).not.toHaveBeenCalled();
    expect(modelMocks.StockItem.updateOne).not.toHaveBeenCalled();
  });
});
