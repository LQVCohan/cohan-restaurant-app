import { beforeEach, describe, expect, it, vi } from "vitest";

const ids = {
  restaurant: "507f1f77bcf86cd799439011",
  otherRestaurant: "507f1f77bcf86cd799439012",
  item: "507f1f77bcf86cd799439021",
  ingredient: "507f1f77bcf86cd799439031",
  group: "507f1f77bcf86cd799439041",
  option: "507f1f77bcf86cd799439051",
};

const state = {
  menuItems: [],
  recipes: [],
  groups: [],
  ingredients: [],
};

const makeQuery = (resolver) => ({
  select: vi.fn().mockReturnThis(),
  session: vi.fn().mockReturnThis(),
  lean: vi.fn(async () => resolver()),
});

vi.mock("../../models/index.js", () => ({
  MenuItem: { find: vi.fn(() => makeQuery(() => state.menuItems)) },
  Recipe: { find: vi.fn(() => makeQuery(() => state.recipes)) },
  ModifierGroup: { find: vi.fn(() => makeQuery(() => state.groups)) },
  Ingredient: { find: vi.fn(() => makeQuery(() => state.ingredients)) },
}));

const { hydrateCheckoutOrderItems } = await import(
  "../../src/services/orderItemHydration.service.js"
);

function seedBase({
  variantPrice = 200,
  mode = "PORTION",
  sellQty = 1,
  sellUnit = "portion",
} = {}) {
  state.menuItems = [{
    _id: ids.item,
    name: "Pho",
    categoryId: "cat-1",
    status: "available",
    defaultServingKey: "regular",
  }];
  state.recipes = [{
    restaurantId: ids.restaurant,
    menuItemId: ids.item,
    servingVariants: [{
      key: "regular",
      name: "Regular",
      mode,
      price: variantPrice,
      sellQty,
      sellUnit,
      ingredients: [{
        ingredientId: ids.ingredient,
        qty: 10,
        unit: "g",
        wastePct: 0,
      }],
    }],
  }];
  state.ingredients = [{
    _id: ids.ingredient,
    name: "Noodle",
    baseUnit: "g",
    conversions: [],
    costPerBaseUnit: 1,
  }];
  state.groups = [];
}

beforeEach(() => {
  seedBase();
});

describe("hydrateCheckoutOrderItems", () => {
  it("uses serving variant price instead of incoming price and multiplies quantity", async () => {
    const [item] = await hydrateCheckoutOrderItems({
      restaurantId: ids.restaurant,
      items: [{
        dishId: ids.item,
        servingKey: "regular",
        quantity: 2,
        basePrice: 1,
        price: 1,
      }],
    });

    expect(item.unitPrice).toBe(200);
    expect(item.lineSubtotal).toBe(400);
  });

  it("adds DELTA modifiers and applies SET modifiers", async () => {
    state.groups = [{
      _id: ids.group,
      isActive: true,
      coverage: "GLOBAL",
      name: "Topping",
      selectionType: "multiple",
      options: [{
        _id: ids.option,
        name: "Egg",
        isActive: true,
        priceRule: { rule: "DELTA", amount: 30 },
        inventoryRule: { rule: "ADD_INGREDIENTS", ingredientLines: [] },
      }],
    }];

    const [deltaItem] = await hydrateCheckoutOrderItems({
      restaurantId: ids.restaurant,
      items: [{
        dishId: ids.item,
        servingKey: "regular",
        quantity: 2,
        modifiers: [{ groupId: ids.group, optionId: ids.option }],
      }],
    });
    expect(deltaItem.unitPrice).toBe(230);
    expect(deltaItem.lineSubtotal).toBe(460);

    state.groups[0].options[0].priceRule = { rule: "SET", amount: 180 };
    const [setItem] = await hydrateCheckoutOrderItems({
      restaurantId: ids.restaurant,
      items: [{
        dishId: ids.item,
        servingKey: "regular",
        quantity: 2,
        modifiers: [{ groupId: ids.group, optionId: ids.option }],
      }],
    });
    expect(setItem.unitPrice).toBe(180);
    expect(setItem.lineSubtotal).toBe(360);
  });

  it("prices BY_WEIGHT items from weightGrams and sellQty", async () => {
    seedBase({ variantPrice: 120, mode: "BY_WEIGHT", sellQty: 0.5, sellUnit: "kg" });
    const [item] = await hydrateCheckoutOrderItems({
      restaurantId: ids.restaurant,
      items: [{
        dishId: ids.item,
        servingKey: "regular",
        weightGrams: 1000,
        quantity: 1,
      }],
    });

    expect(item.unitPrice).toBe(120);
    expect(item.lineSubtotal).toBe(240);
  });

  it("rejects missing items, invalid serving keys, and invalid modifiers", async () => {
    state.menuItems = [];
    await expect(hydrateCheckoutOrderItems({
      restaurantId: ids.restaurant,
      items: [{ dishId: ids.item, servingKey: "regular", quantity: 1 }],
    })).rejects.toMatchObject({ code: "INVALID_ITEMS" });

    seedBase();
    await expect(hydrateCheckoutOrderItems({
      restaurantId: ids.restaurant,
      items: [{ dishId: ids.item, servingKey: "large", quantity: 1 }],
    })).rejects.toMatchObject({ code: "INVALID_ITEMS" });

    await expect(hydrateCheckoutOrderItems({
      restaurantId: ids.restaurant,
      items: [{
        dishId: ids.item,
        servingKey: "regular",
        quantity: 1,
        modifiers: [{ groupId: ids.group, optionId: ids.option }],
      }],
    })).rejects.toMatchObject({ code: "INVALID_ITEMS" });
  });
});
