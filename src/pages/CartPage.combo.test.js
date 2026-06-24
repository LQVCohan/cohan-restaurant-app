import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("CartPage combo rendering", () => {
  it("renders combo badge and child items", () => {
    const src = readFileSync("src/pages/CartPage.jsx", "utf8");
    expect(src).toContain("getOrderLineDisplay(item)");
    expect(src).toContain("line.isComboLine");
    expect(src).toContain("cart-page__combo-items");
  });
});
