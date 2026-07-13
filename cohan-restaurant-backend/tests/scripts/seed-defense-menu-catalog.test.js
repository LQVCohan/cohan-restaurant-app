import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  DISH_DEFS,
  INGREDIENT_DEFS,
  recipeCost,
  validateDefenseMenuCatalog,
} from "../../scripts/seedDefenseMenuCatalog.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "../../..");
const ingredientByKey = new Map(
  INGREDIENT_DEFS.map((ingredient) => [ingredient.key, ingredient]),
);

describe("defense production menu catalog", () => {
  it("contains a complete operating menu with portion and by-weight dishes", () => {
    expect(validateDefenseMenuCatalog()).toEqual({
      dishes: 36,
      ingredients: 71,
      portionDishes: 34,
      byWeightDishes: 6,
      dualModeDishes: 4,
    });
  });

  it("stores realistic purchase costs in each ingredient base unit", () => {
    const cost = (key) => ingredientByKey.get(key)?.costPerBaseUnit;

    expect(cost("beef") * 1000).toBe(235_000);
    expect(cost("pork") * 1000).toBe(118_000);
    expect(cost("tigerPrawn") * 1000).toBe(310_000);
    expect(cost("crab") * 1000).toBe(480_000);
    expect(cost("rice") * 1000).toBe(30_000);
    expect(cost("orange")).toBe(8_000);

    for (const ingredient of INGREDIENT_DEFS) {
      expect(ingredient.costPerBaseUnit).toBeGreaterThan(0);
      expect(ingredient.minStock).toBeGreaterThan(0);
      expect(ingredient.onHand).toBeGreaterThan(ingredient.minStock);
    }
  });

  it("keeps every serving price above its recipe purchase cost", () => {
    for (const dish of DISH_DEFS) {
      for (const variant of dish.variants) {
        const cost = recipeCost(variant, ingredientByKey);
        expect(Number.isFinite(cost), `${dish.code}/${variant.key}`).toBe(true);
        expect(cost, `${dish.code}/${variant.key}`).toBeGreaterThan(0);
        expect(variant.price, `${dish.code}/${variant.key}`).toBeGreaterThan(cost);
        expect(variant.ingredients.length, `${dish.code}/${variant.key}`).toBeGreaterThan(0);
      }
    }
  });

  it("ships every referenced menu image as a local managed asset", () => {
    const images = new Set(DISH_DEFS.map((dish) => dish.thumbImage));
    expect(images.size).toBe(10);

    for (const image of images) {
      expect(image.startsWith("/images/menu/")).toBe(true);
      expect(fs.existsSync(path.join(repoRoot, "public", image.replace(/^\/+/, "")))).toBe(
        true,
      );
    }
  });

  it("does not expose internal fixture wording in menu display copy", () => {
    const forbidden = /\b(?:demo|defen[cs]e|seed|test|sample)\b/i;
    for (const dish of DISH_DEFS) {
      expect(forbidden.test(dish.name)).toBe(false);
      expect(forbidden.test(dish.description)).toBe(false);
    }
  });
});
