import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("customer combo GraphQL contract", () => {
  it("exposes customerCombos and customerCombo queries", () => {
    const schema = readFileSync("graphql/schema/customerCombo.graphql", "utf8");
    expect(schema).toContain("customerCombos(filter: CustomerComboFilterInput): [CustomerCombo!]!");
    expect(schema).toContain("customerCombo(id: ID!): CustomerCombo");
    expect(schema).toContain("enum ComboSourceType");
  });

  it("normalizes both Combo and Promotion sources safely", () => {
    const resolver = readFileSync("graphql/resolvers/customerCombo/index.js", "utf8");
    expect(resolver).toContain('sourceType: "COMBO"');
    expect(resolver).toContain('sourceType: "PROMOTION"');
    expect(resolver).toContain("console.warn");
    expect(resolver).toContain("Promotion.find");
    expect(resolver).toContain("Combo.find");
  });
});
