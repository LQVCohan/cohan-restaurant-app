import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  toEnglishCategoryName,
  toVietnameseIngredientCategoryName,
} from "../../graphql/resolvers/inventory/categoryAi.shared.js";

const ingredientCategoryMutationSource = readFileSync(
  new URL(
    "../../graphql/resolvers/inventory/ingredientCategory.mutation.js",
    import.meta.url,
  ),
  "utf8",
);

describe("ingredient category legacy aliases", () => {
  it.each([
    ["grain", "Starch", "Tinh bột"],
    ["dairy", "Dairy & Egg", "Sữa & trứng"],
  ])("normalizes %s to canonical English and Vietnamese names", (input, english, vietnamese) => {
    expect(toEnglishCategoryName(input)).toBe(english);
    expect(toVietnameseIngredientCategoryName(input)).toBe(vietnamese);
  });

  it("keeps MongoDB session reads sequential inside category sync", () => {
    const transactionSetup = ingredientCategoryMutationSource.match(
      /session\.startTransaction\(\);([\s\S]*?)stats\.totalIngredients/,
    )?.[1];

    expect(transactionSetup).toBeTruthy();
    expect(transactionSetup).not.toContain("Promise.all");
    expect(transactionSetup).toMatch(
      /const ingredients = await Ingredient\.find[\s\S]*const existingCategories = await IngredientCategory\.find/,
    );
  });
});
