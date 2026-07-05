import { describe, expect, it } from "vitest";
import fs from "node:fs";

const SOURCE_PATH = "src/components/Dashboard_Manager/Menu/components/MenuItemModal/MenuItemModal.jsx";

describe("MenuItemModal item contract", () => {
  it("supports foodType selection and conditional meatTypes selection", () => {
    const source = fs.readFileSync(SOURCE_PATH, "utf8");

    expect(source).toContain('foodType: "UNKNOWN"');
    expect(source).toContain("const FOOD_TYPE_OPTIONS");
    expect(source).toContain("const MEAT_TYPE_OPTIONS");
    expect(source).toContain("Phân loại món ăn");
    expect(source).toContain("Loại thịt / đạm động vật");
    expect(source).toContain('["NON_VEGETARIAN", "MIXED"].includes(formData.foodType)');
    expect(source).toContain('handleInputChange("foodType"');
    expect(source).toContain('toggleArrayValue("meatTypes"');
    expect(source).toContain("foodType: formData.foodType || FOR_YOU_DEFAULTS.foodType");
  });

  it("requires and submits an explicit preparation station", () => {
    const source = fs.readFileSync(SOURCE_PATH, "utf8");

    expect(source).toContain("const PREP_STATION_OPTIONS");
    expect(source).toContain('prepStation: "kitchen"');
    expect(source).toContain("prepStation: normalizePrepStation(currentItem.prepStation)");
    expect(source).toContain("prepStation: normalizePrepStation(formData.prepStation)");
    expect(source).toContain('handleInputChange("prepStation"');
    expect(source).toContain("Khu chế biến");
    expect(source).toContain("Bếp chính");
    expect(source).toContain("Quầy bar");
  });
});
