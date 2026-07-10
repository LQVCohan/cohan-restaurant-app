import mongoose from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Ingredient: { find: vi.fn() },
  Recipe: { findOne: vi.fn() },
  StockItem: { aggregate: vi.fn() },
  Warehouse: { findOne: vi.fn() },
}));

vi.mock("../../models/index.js", () => modelMocks);

const RESTAURANT_ID = "507f1f77bcf86cd799439011";
const MENU_ITEM_ID = "507f1f77bcf86cd799439012";
const INGREDIENT_ID = "507f1f77bcf86cd799439013";
const WAREHOUSE_ID = "507f1f77bcf86cd799439014";

const selectLeanQuery = (value) => ({
  select: vi.fn(() => ({
    lean: vi.fn().mockResolvedValue(value),
  })),
});

const warehouseQuery = (value) => {
  const lean = vi.fn().mockResolvedValue(value);
  const sort = vi.fn(() => ({ lean }));
  return { sort, lean };
};

const { getMenuItemInventoryAvailability } = await import(
  "../../src/services/menuItemInventoryAvailability.service.js"
);

describe("menu item inventory fulfillment warehouse scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    modelMocks.Recipe.findOne.mockReturnValue(
      selectLeanQuery({
        servingVariants: [
          {
            key: "default",
            isDefault: true,
            ingredients: [
              {
                ingredientId: INGREDIENT_ID,
                qty: 1,
                unit: "portion",
                wastePct: 0,
              },
            ],
          },
        ],
      }),
    );
    modelMocks.Ingredient.find.mockReturnValue(
      selectLeanQuery([
        {
          _id: INGREDIENT_ID,
          name: "Nguyên liệu chính",
          baseUnit: "portion",
          conversions: [],
          minStock: 0,
        },
      ]),
    );
    modelMocks.Warehouse.findOne.mockReturnValue(
      warehouseQuery({ _id: WAREHOUSE_ID }),
    );
    modelMocks.StockItem.aggregate.mockResolvedValue([
      {
        ingredientId: new mongoose.Types.ObjectId(INGREDIENT_ID),
        available: 100,
      },
    ]);
  });

  it("uses the same first active warehouse as live-state and cart reservation", async () => {
    await expect(
      getMenuItemInventoryAvailability({
        restaurantId: RESTAURANT_ID,
        menuItemId: MENU_ITEM_ID,
      }),
    ).resolves.toMatchObject({
      inventoryStatus: "IN_STOCK",
      maxAvailable: 100,
      stockShortages: [],
    });

    expect(modelMocks.Warehouse.findOne).toHaveBeenCalledWith({
      restaurantId: RESTAURANT_ID,
      isActive: true,
    });
    const warehouseLookup = modelMocks.Warehouse.findOne.mock.results[0].value;
    expect(warehouseLookup.sort).toHaveBeenCalledWith({ createdAt: 1, _id: 1 });

    const pipeline = modelMocks.StockItem.aggregate.mock.calls[0][0];
    expect(String(pipeline[0].$match.restaurantId)).toBe(RESTAURANT_ID);
    expect(String(pipeline[0].$match.warehouseId)).toBe(WAREHOUSE_ID);
    expect(String(pipeline[0].$match.ingredientId.$in[0])).toBe(INGREDIENT_ID);
  });

  it("returns a safe error instead of combining stock when no active warehouse exists", async () => {
    modelMocks.Warehouse.findOne.mockReturnValue(warehouseQuery(null));

    await expect(
      getMenuItemInventoryAvailability({
        restaurantId: RESTAURANT_ID,
        menuItemId: MENU_ITEM_ID,
      }),
    ).resolves.toMatchObject({
      inventoryStatus: "ERROR",
      maxAvailable: 0,
      stockWarnings: ["Nhà hàng chưa có kho hoạt động."],
    });
    expect(modelMocks.StockItem.aggregate).not.toHaveBeenCalled();
  });
});
