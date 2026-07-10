import { describe, expect, it } from "vitest";
import {
  toEnglishCategoryName,
  toVietnameseIngredientCategoryName,
} from "../../graphql/resolvers/inventory/categoryAi.shared.js";

describe("ingredient category legacy aliases", () => {
  it.each([
    ["grain", "Starch", "Tinh bột"],
    ["dairy", "Dairy & Egg", "Sữa & trứng"],
  ])("normalizes %s to canonical English and Vietnamese names", (input, english, vietnamese) => {
    expect(toEnglishCategoryName(input)).toBe(english);
    expect(toVietnameseIngredientCategoryName(input)).toBe(vietnamese);
  });
});
