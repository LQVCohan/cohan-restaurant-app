import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("combo bundle cart contract", () => {
  it("adds combo cart item fields and mutation", () => {
    const schema = readFileSync("graphql/schema/cart.graphql", "utf8");
    expect(schema).toContain("itemType: String!");
    expect(schema).toContain("comboId: ID");
    expect(schema).toContain("comboSnapshot: JSON");
    expect(schema).toContain("addComboToCart(comboId: ID!, quantity: Int = 1): Cart!");
  });

  it("keeps combo bundle as COMBO item instead of menu item expansion", () => {
    const mutation = readFileSync("graphql/resolvers/cart/mutation.js", "utf8");
    expect(mutation).toContain("async addComboToCart");
    expect(mutation).toContain('itemType: "COMBO"');
    expect(mutation).toContain("comboSnapshot");
    expect(mutation).toContain("isSameComboIdentity");
  });
});
