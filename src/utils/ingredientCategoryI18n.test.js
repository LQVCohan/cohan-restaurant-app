import { describe, expect, it } from "vitest";
import { toIngredientCategoryVi } from "./ingredientCategoryI18n";

describe("toIngredientCategoryVi", () => {
  it.each([
    ["grain", "Tinh bột"],
    ["dairy", "Sữa & trứng"],
    ["Starch", "Tinh bột"],
    ["Dairy & Egg", "Sữa & trứng"],
  ])("translates %s", (input, expected) => {
    expect(toIngredientCategoryVi(input)).toBe(expected);
  });
});
