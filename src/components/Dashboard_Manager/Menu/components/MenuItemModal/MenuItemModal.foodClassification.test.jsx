import { describe, expect, it } from "vitest";
import fs from "node:fs";

const SOURCE_PATH = "src/components/Dashboard_Manager/Menu/components/MenuItemModal/MenuItemModal.jsx";

describe("MenuItemModal food classification controls", () => {
  it("supports foodType selection and conditional meatTypes selection", () => {
    const source = fs.readFileSync(SOURCE_PATH, "utf8");

    expect(source).toContain('foodType: "UNKNOWN"');
    expect(source).toContain("const FOOD_TYPE_OPTIONS");
    expect(source).toContain("const MEAT_TYPE_OPTIONS");
    expect(source).toContain("Nhóm món ăn");
    expect(source).toContain("Thành phần thịt hoặc hải sản");
    expect(source).toContain('["NON_VEGETARIAN", "MIXED"].includes(formData.foodType)');
    expect(source).toContain('handleInputChange("foodType"');
    expect(source).toContain('toggleArrayValue("meatTypes"');
    expect(source).toContain("foodType: formData.foodType || FOR_YOU_DEFAULTS.foodType");
  });
});
