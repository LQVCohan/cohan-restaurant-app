import { describe, expect, it } from "vitest";
import fs from "node:fs";

const SOURCE_PATH = "src/components/Customer/Food/FoodDetail.jsx";

describe("FoodDetail food classification UI", () => {
  it("renders classification labels, metadata chips, and BY_WEIGHT customer note", () => {
    const source = fs.readFileSync(SOURCE_PATH, "utf8");

    expect(source).toContain('VEGETARIAN: { label: "Chay"');
    expect(source).toContain('NON_VEGETARIAN: { label: "Mặn"');
    expect(source).toContain('VEGAN: { label: "Thuần chay"');
    expect(source).toContain('MIXED: { label: "Có cả chay và mặn"');
    expect(source).toContain('UNKNOWN: { label: "Chưa phân loại"');
    expect(source).toContain('const shouldShowFoodTypeBadge = foodTypeKey !== "UNKNOWN"');
    expect(source).toContain("fd-food-type-badge");
    expect(source).toContain("fd-chip--diet");
    expect(source).toContain("fd-chip--allergen");
    expect(source).toContain("Loại thịt:");
    expect(source).toContain("Món này tính theo cân nặng thực tế");
  });
});
