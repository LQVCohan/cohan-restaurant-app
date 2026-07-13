import { describe, expect, it } from "vitest";
import resolvers from "../../graphql/resolvers/index.js";

describe("menu item inventory resolver composition", () => {
  it("keeps inventory-backed ingredient names on the root MenuItem resolver", () => {
    expect(resolvers.MenuItem?.ingredientNames).toBeTypeOf("function");
    expect(resolvers.MenuItem?.servingVariants).toBeTypeOf("function");
  });

  it("keeps nested inventory type resolvers registered", () => {
    expect(resolvers.RecipeIngredientLine?.name).toBeTypeOf("function");
    expect(resolvers.Ingredient?.ingredientCategory).toBeTypeOf("function");
  });
});
