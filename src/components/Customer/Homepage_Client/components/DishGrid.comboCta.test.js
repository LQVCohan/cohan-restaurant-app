import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("DishGrid combo CTA", () => {
  it("routes fallback combo card to /combos", () => {
    const source = readFileSync("src/components/Customer/Homepage_Client/components/DishGrid.jsx", "utf8");
    expect(source).toContain('cta: "Xem combo"');
    expect(source).toContain('path: "/combos"');
  });
});
