import { describe, expect, it } from "vitest";
import {
  formatWeightKgFromGrams,
  getStaffOrderSelectionTotal,
  parsePortionQuantity,
  parseWeightKg,
  weightKgToGrams,
} from "./staffOrderQuantity";

describe("staffOrderQuantity", () => {
  it("accepts only positive integer portion quantities", () => {
    expect(parsePortionQuantity("3")).toBe(3);
    expect(parsePortionQuantity("1.5")).toBeNull();
    expect(parsePortionQuantity("0")).toBeNull();
    expect(parsePortionQuantity("100")).toBeNull();
  });

  it("accepts decimal kilograms with dot or comma and converts to grams", () => {
    expect(parseWeightKg("0.75")).toBe(0.75);
    expect(parseWeightKg("1,25")).toBe(1.25);
    expect(weightKgToGrams("1,25")).toBe(1250);
    expect(parseWeightKg("1.2345")).toBeNull();
    expect(parseWeightKg("0")).toBeNull();
  });

  it("formats stored grams as a compact kilogram value", () => {
    expect(formatWeightKgFromGrams(1250)).toBe("1,25");
    expect(formatWeightKgFromGrams(500)).toBe("0,5");
    expect(formatWeightKgFromGrams(null)).toBe("");
  });

  it("calculates totals for portions and by-weight variants", () => {
    expect(
      getStaffOrderSelectionTotal({
        price: 235000,
        variant: { mode: "PORTION" },
        portionQuantity: "3",
      }),
    ).toBe(705000);

    expect(
      getStaffOrderSelectionTotal({
        price: 520000,
        variant: { mode: "BY_WEIGHT", sellUnit: "kg", sellQty: 1 },
        weightKg: "0.75",
      }),
    ).toBe(390000);
  });
});
