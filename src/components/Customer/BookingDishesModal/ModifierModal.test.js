import { describe, expect, it } from "vitest";
import {
  calculateModifierPricing,
  getModifierSelectionError,
} from "./ModifierModal.jsx";

describe("ModifierModal helpers", () => {
  it("uses SET as the new base price before applying DELTA modifiers", () => {
    const groups = [
      {
        id: "size",
        options: [
          { id: "large", isActive: true, priceRule: { rule: "SET", amount: 120000 } },
        ],
      },
      {
        id: "topping",
        options: [
          { id: "beef", isActive: true, priceRule: { rule: "DELTA", amount: 10000 } },
        ],
      },
    ];

    expect(calculateModifierPricing(100000, groups, {
      size: ["large"],
      topping: ["beef"],
    })).toEqual({
      totalPrice: 130000,
      modifiersPrice: 30000,
      setCount: 1,
    });
  });

  it("ignores inactive options and reports multiple SET selections", () => {
    const groups = [
      {
        id: "size",
        options: [
          { id: "large", priceRule: { rule: "SET", amount: 120000 } },
          { id: "hidden", isActive: false, priceRule: { rule: "DELTA", amount: 50000 } },
        ],
      },
      {
        id: "portion",
        options: [
          { id: "double", priceRule: { rule: "SET", amount: 160000 } },
        ],
      },
    ];

    const result = calculateModifierPricing(100000, groups, {
      size: ["large", "hidden"],
      portion: ["double"],
    });

    expect(result.totalPrice).toBe(120000);
    expect(result.modifiersPrice).toBe(20000);
    expect(result.setCount).toBe(2);
  });

  it("validates required, minimum and maximum selections", () => {
    const group = {
      name: "Topping",
      selectionType: "multiple",
      required: true,
      minSelected: 2,
      maxSelected: 3,
    };

    expect(getModifierSelectionError(group, 1)).toBe("Vui lòng chọn ít nhất 2 lựa chọn cho Topping.");
    expect(getModifierSelectionError(group, 4)).toBe("Chỉ được chọn tối đa 3 lựa chọn cho Topping.");
    expect(getModifierSelectionError(group, 2)).toBe("");
    expect(getModifierSelectionError({ ...group, required: false }, 0)).toBe("");
  });
});
