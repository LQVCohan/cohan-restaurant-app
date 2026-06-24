import { describe, expect, it } from "vitest";
import { getOrderLineDisplay, isComboOrderLine } from "./orderLineDisplay";

describe("orderLineDisplay", () => {
  it("keeps menu item display safe", () => {
    const line = getOrderLineDisplay({ name: "Cơm gà", quantity: 2, unitPrice: 45000 });
    expect(line.isComboLine).toBe(false);
    expect(line.displayName).toBe("Cơm gà");
    expect(line.totalPrice).toBe(90000);
  });

  it("normalizes combo receipt data with saving", () => {
    const line = getOrderLineDisplay({ itemType: "COMBO", quantity: 2, comboSnapshot: { name: "Combo no nhanh", comboPrice: 89000, originalPrice: 105000, items: [{ name: "Cơm gà", qty: 1 }] } });
    expect(isComboOrderLine({ itemType: "COMBO" })).toBe(true);
    expect(line.isComboLine).toBe(true);
    expect(line.displayName).toBe("Combo no nhanh");
    expect(line.totalPrice).toBe(178000);
    expect(line.discountAmount).toBe(16000);
    expect(line.childItems[0].qty).toBe(1);
  });

  it("multiplies combo child quantities for kitchen mode", () => {
    const line = getOrderLineDisplay({ itemType: "COMBO", quantity: 3, comboSnapshot: { items: [{ name: "Trà đào", qty: 2 }] } }, { mode: "kitchen" });
    expect(line.childItems[0].qty).toBe(6);
  });

  it("does not crash when comboSnapshot items are missing", () => {
    const line = getOrderLineDisplay({ itemType: "COMBO", quantity: 1, comboSnapshot: { name: "Combo rỗng" } });
    expect(line.displayName).toBe("Combo rỗng");
    expect(line.childItems).toEqual([]);
  });
});
