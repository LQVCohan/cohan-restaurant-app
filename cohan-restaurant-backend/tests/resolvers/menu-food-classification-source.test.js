import { describe, expect, it } from "vitest";
import fs from "node:fs";

const MUTATION_PATH = "graphql/resolvers/menu/mutation.js";

describe("menu resolver food classification wiring", () => {
  it("normalizes foodType and meatTypes in create and update payloads", () => {
    const source = fs.readFileSync(MUTATION_PATH, "utf8");

    expect(source).toContain("const MENU_ITEM_FOOD_TYPES");
    expect(source).toContain("const MENU_ITEM_MEAT_TYPES");
    expect(source).toContain("function normalizeEnumValue");
    expect(source).toContain("function normalizeEnumList");
    expect(source).toMatch(/foodType:\s*normalizedFoodType/);
    expect(source).toMatch(/meatTypes:\s*normalizedMeatTypes \?\? \[\]/);
    expect(source).toMatch(/item\.foodType\s*=\s*[\s\S]*normalizeEnumValue\(input\.foodType/);
    expect(source).toMatch(/patch\.meatTypes\s*=\s*normalizeEnumList\(/);
  });
});
