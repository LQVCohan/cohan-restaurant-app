import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Menu: { exists: vi.fn() },
  MenuItem: { findOne: vi.fn() },
  ModifierGroup: { find: vi.fn(), findById: vi.fn() },
}));

const accessMocks = vi.hoisted(() => ({
  requireRestaurantAccess: vi.fn(),
}));

const publicGuardMocks = vi.hoisted(() => ({
  getPublicRestaurantOrThrow: vi.fn(),
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../graphql/guards.js", () => accessMocks);
vi.mock(
  "../../graphql/resolvers/shared/restaurantCapabilityGuards.js",
  () => publicGuardMocks,
);
vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: vi.fn(() => true),
    Types: {
      ObjectId: function ObjectId(value) {
        this.value = value;
        this.toString = () => String(value);
      },
    },
  },
}));

const findOneChain = (value) => ({
  select: vi.fn().mockReturnThis(),
  lean: vi.fn().mockResolvedValue(value),
});

const findChain = (value) => ({
  sort: vi.fn().mockReturnThis(),
  lean: vi.fn().mockResolvedValue(value),
});

describe("customerModifierGroups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    publicGuardMocks.getPublicRestaurantOrThrow.mockResolvedValue({});
    modelMocks.MenuItem.findOne.mockReturnValue(
      findOneChain({ menuId: "menu-1" }),
    );
    modelMocks.Menu.exists.mockResolvedValue(true);
  });

  it("returns only active customer-facing fields", async () => {
    modelMocks.ModifierGroup.find.mockReturnValue(
      findChain([
        {
          _id: "group-1",
          restaurantId: "restaurant-1",
          name: "Kích cỡ",
          groupType: "SIZE",
          coverage: "ITEMS",
          menuItemIds: ["menu-item-1"],
          selectionType: "single",
          required: true,
          minSelected: 1,
          maxSelected: 1,
          note: "Internal note",
          options: [
            {
              _id: "option-1",
              name: "Lớn",
              isDefault: true,
              isActive: true,
              priceRule: { rule: "DELTA", amount: 20000 },
              inventoryRule: {
                rule: "ADD_INGREDIENTS",
                ingredientLines: [
                  {
                    ingredientId: "secret-ingredient",
                    qty: 50,
                    unit: "g",
                  },
                ],
              },
            },
            {
              _id: "option-hidden",
              name: "Ẩn",
              isActive: false,
              priceRule: { rule: "DELTA", amount: 0 },
            },
          ],
        },
      ]),
    );

    const { ModifierQuery } = await import(
      "../../graphql/resolvers/modifier/query.js"
    );
    const result = await ModifierQuery.customerModifierGroups(null, {
      restaurantId: "restaurant-1",
      menuItemId: "menu-item-1",
    });

    expect(result).toEqual([
      {
        id: "group-1",
        name: "Kích cỡ",
        selectionType: "single",
        required: true,
        minSelected: 1,
        maxSelected: 1,
        options: [
          {
            id: "option-1",
            name: "Lớn",
            isDefault: true,
            priceRule: { rule: "DELTA", amount: 20000 },
          },
        ],
      },
    ]);
    expect(result[0]).not.toHaveProperty("restaurantId");
    expect(result[0]).not.toHaveProperty("menuItemIds");
    expect(result[0]).not.toHaveProperty("note");
    expect(result[0].options[0]).not.toHaveProperty("inventoryRule");
  });

  it("returns no groups for a dish outside an active public menu", async () => {
    modelMocks.Menu.exists.mockResolvedValue(false);
    modelMocks.ModifierGroup.find.mockReturnValue(findChain([]));

    const { ModifierQuery } = await import(
      "../../graphql/resolvers/modifier/query.js"
    );
    const result = await ModifierQuery.customerModifierGroups(null, {
      restaurantId: "restaurant-1",
      menuItemId: "menu-item-1",
    });

    expect(result).toEqual([]);
    expect(modelMocks.ModifierGroup.find).not.toHaveBeenCalled();
  });
});
