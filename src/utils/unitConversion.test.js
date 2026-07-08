import { describe, expect, it } from "vitest";
import {
  calculateStockReceipt,
  fromBaseQty,
  getConvertibleUnits,
  toBaseQty,
} from "./unitConversion";

describe("inventory unit conversion", () => {
  it("converts metric quantities in both directions", () => {
    expect(toBaseQty(2, "kg", "g")).toBe(2000);
    expect(toBaseQty(500, "g", "kg")).toBe(0.5);
    expect(fromBaseQty(0.5, "g", "kg")).toBe(500);
    expect(toBaseQty(1.5, "l", "ml")).toBe(1500);
  });

  it("uses custom conversions in both directions", () => {
    const conversions = [{ from: "pack", to: "piece", ratio: 12 }];
    expect(toBaseQty(2, "pack", "piece", conversions)).toBe(24);
    expect(toBaseQty(24, "piece", "pack", conversions)).toBe(2);
    expect(getConvertibleUnits("piece", conversions)).toEqual(["piece", "pack"]);
  });

  it("rejects unsupported units instead of silently preserving quantity", () => {
    expect(Number.isNaN(toBaseQty(2, "pack", "g"))).toBe(true);
  });

  it("calculates receipt quantity and cost from the same base quantity", () => {
    expect(
      calculateStockReceipt({
        qty: 2,
        unit: "kg",
        unitPrice: 120000,
        baseUnit: "g",
      }),
    ).toMatchObject({
      qtyBase: 2000,
      costPerBaseUnit: 60,
      totalValue: 120000,
      baseUnit: "g",
    });
  });
});
