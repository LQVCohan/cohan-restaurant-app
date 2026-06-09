import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ orders: [], recipes: [], ingredients: [] }));
const q = (rows) => ({ select: vi.fn(() => ({ lean: vi.fn(async () => rows) })) });
vi.mock("../../models/index.js", () => ({
  Order: { find: vi.fn(() => q(mocks.orders)) },
  Recipe: { find: vi.fn(() => q(mocks.recipes)) },
  Ingredient: { find: vi.fn(() => q(mocks.ingredients)) },
}));
const { buildMenuEngineeringAssistant } = await import("../../src/services/ai/menuEngineeringAssistant.service.js");
const rid = "64b7f987f987f987f987f987";

const item = (dishId, name, quantity, revenue, extra = {}) => ({ dishId, name, quantity, lineSubtotal: revenue, status: "served", ...extra });

describe("menu engineering assistant", () => {
  beforeEach(() => { mocks.orders = []; mocks.recipes = []; mocks.ingredients = []; });

  it("prioritizes snapshot cost, then recipe cost, then fallback margin and classifies quadrants", async () => {
    mocks.orders = [{ currentStatus: "completed", items: [
      item("64b7f987f987f987f987f001", "Star", 10, 1000000, { ingredientsSnapshot: [{ totalCost: 200000 }] }),
      item("64b7f987f987f987f987f002", "Plowhorse", 12, 600000, { servingKey: "default" }),
      item("64b7f987f987f987f987f003", "Puzzle", 2, 600000),
      item("64b7f987f987f987f987f004", "Dog", 1, 50000),
    ] }];
    mocks.recipes = [{ menuItemId: "64b7f987f987f987f987f002", servingVariants: [{ key: "default", isDefault: true, ingredients: [{ ingredientId: "64b7f987f987f987f987f101", qty: 100, unit: "g" }] }] }];
    mocks.ingredients = [{ _id: "64b7f987f987f987f987f101", baseUnit: "g", costPerBaseUnit: 20 }];
    const result = await buildMenuEngineeringAssistant({ restaurantId: rid, fallbackMarginRate: 0.65 });
    expect(result.dishes.find((d) => d.dishName === "Star").estimatedCost).toBe(200000);
    expect(result.dishes.find((d) => d.dishName === "Plowhorse").estimatedCost).toBe(24000);
    expect(result.dishes.find((d) => d.dishName === "Dog").estimatedCost).toBe(17500);
    expect(result.summary.starCount + result.summary.plowhorseCount + result.summary.puzzleCount + result.summary.dogCount).toBe(4);
    expect(result.recommendations.join(" ")).toMatch(/Tối ưu|Đẩy|STAR/);
    expect(result.meta.fallbackUsed).toBe(true);
  });
});
