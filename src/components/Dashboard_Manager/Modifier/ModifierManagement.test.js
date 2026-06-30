import { describe, expect, it } from "vitest";
import {
  blankForm,
  buildModifierInput,
  getModifierFormValidationError,
  toForm,
} from "./ModifierManagement.jsx";

describe("ModifierManagement helpers", () => {
  it("builds a GLOBAL single-select modifier payload and clears item ids", () => {
    const form = {
      ...blankForm("restaurant-1"),
      name: " Size ",
      groupType: "SIZE",
      coverage: "GLOBAL",
      menuItemIds: ["item-1"],
      selectionType: "single",
      required: true,
      options: [
        {
          name: " Size L ",
          isDefault: true,
          isActive: true,
          priceRule: { rule: "DELTA", amount: "15000" },
          inventoryRule: { rule: "NONE", ingredientLines: [] },
        },
      ],
    };

    expect(buildModifierInput(form, "restaurant-1")).toMatchObject({
      restaurantId: "restaurant-1",
      name: "Size",
      groupType: "SIZE",
      coverage: "GLOBAL",
      menuItemIds: [],
      selectionType: "single",
      required: true,
      minSelected: 1,
      maxSelected: 1,
      options: [
        {
          name: "Size L",
          isDefault: true,
          isActive: true,
          priceRule: { rule: "DELTA", amount: 15000 },
          inventoryRule: { rule: "NONE", ingredientLines: [] },
        },
      ],
    });
  });

  it("keeps item coverage ids and omits unlimited maxSelected", () => {
    const form = {
      ...blankForm("restaurant-1"),
      name: "Topping",
      coverage: "ITEMS",
      menuItemIds: ["item-1", "item-2"],
      selectionType: "multiple",
      minSelected: "1",
      maxSelected: "",
      options: [{ ...blankForm().options[0], name: "Thêm bò" }],
    };

    const input = buildModifierInput(form, "restaurant-1");

    expect(input.menuItemIds).toEqual(["item-1", "item-2"]);
    expect(input.minSelected).toBe(1);
    expect(input).not.toHaveProperty("maxSelected");
  });

  it("validates required item coverage, options and max selection", () => {
    expect(getModifierFormValidationError({ ...blankForm(), name: "Size" }, "")).toBe("Vui lòng chọn chi nhánh.");
    expect(getModifierFormValidationError({ ...blankForm("r1"), name: "Theo món", coverage: "ITEMS" }, "r1")).toBe("Chọn ít nhất một món khi áp dụng theo món.");
    expect(getModifierFormValidationError({ ...blankForm("r1"), name: "Rỗng", options: [] }, "r1")).toBe("Cần ít nhất một lựa chọn.");
    expect(getModifierFormValidationError({ ...blankForm("r1"), name: "Giới hạn", minSelected: 3, maxSelected: 2, options: [{ ...blankForm().options[0], name: "Thêm bò" }] }, "r1")).toBe("Số lựa chọn tối đa phải lớn hơn hoặc bằng tối thiểu.");
  });

  it("maps existing groups back to form state without losing inventory rules", () => {
    const form = toForm({
      id: "group-1",
      restaurantId: "restaurant-1",
      name: "Cách chế biến",
      menuItemIds: [1, "2"],
      options: [
        {
          id: "option-1",
          name: "Nhiều sốt",
          priceRule: { rule: "DELTA", amount: 5000 },
          inventoryRule: {
            rule: "ADD_INGREDIENTS",
            ingredientLines: [{ ingredientId: "ingredient-1", qty: 10, unit: "g", wastePct: 0 }],
            note: "Thêm sốt",
          },
        },
      ],
    }, "restaurant-1");

    expect(form.menuItemIds).toEqual(["1", "2"]);
    expect(form.options[0].inventoryRule).toMatchObject({
      rule: "ADD_INGREDIENTS",
      ingredientLines: [{ ingredientId: "ingredient-1", qty: 10, unit: "g", wastePct: 0 }],
      note: "Thêm sốt",
    });
  });
});
