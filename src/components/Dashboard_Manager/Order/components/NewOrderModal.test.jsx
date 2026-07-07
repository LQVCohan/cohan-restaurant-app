import { describe, expect, it } from "vitest";
import {
  buildNewOrderCategoryOptions,
  getDefaultNewOrderServingVariant,
  getNewOrderDefaultQuantity,
  getNewOrderUnitPrice,
  normalizeNewOrderQuantity,
} from "./NewOrderModal";

describe("buildNewOrderCategoryOptions", () => {
  it("uses dish category names and keeps only one fallback category", () => {
    const categories = [
      { id: "main", name: "Món chính", isActive: true },
      { id: "drink", name: "Đồ uống", isActive: true },
      { id: "hidden", name: "Đã ẩn", isActive: false },
    ];
    const items = [
      { categoryId: "main" },
      { categoryId: "drink" },
      { categoryId: "orphan-a" },
      { categoryId: "orphan-b" },
      { categoryId: null },
    ];

    const options = buildNewOrderCategoryOptions(categories, items);

    expect(options.map((option) => option.name)).toEqual([
      "Tất cả danh mục",
      "Đồ uống",
      "Món chính",
      "Khác",
    ]);
    expect(options.filter((option) => option.name === "Khác")).toHaveLength(1);
    expect(options.find((option) => option.name === "Khác")).toMatchObject({
      categoryIds: ["orphan-a", "orphan-b"],
      includeUncategorized: true,
    });
  });

  it("merges orphaned items into an existing Khác category", () => {
    const options = buildNewOrderCategoryOptions(
      [{ id: "other", name: "Khác", isActive: true }],
      [{ categoryId: "other" }, { categoryId: "legacy" }],
    );

    expect(options.filter((option) => option.name === "Khác")).toHaveLength(1);
    expect(options.find((option) => option.name === "Khác")?.categoryIds).toEqual([
      "other",
      "legacy",
    ]);
  });

  it("does not crash when categories is not an array", () => {
    const options = buildNewOrderCategoryOptions(
      { id: "menu-group", name: "Nhóm thực đơn" },
      [{ categoryId: "legacy" }],
    );

    expect(options.map((option) => option.name)).toEqual([
      "Tất cả danh mục",
      "Khác",
    ]);
  });
});

describe("new order serving configuration", () => {
  const variants = [
    {
      key: "portion",
      name: "Theo phần",
      mode: "PORTION",
      sellQty: 1,
      sellUnit: "portion",
      price: 60000,
      isDefault: true,
    },
    {
      key: "weight-100g",
      name: "Theo cân",
      mode: "BY_WEIGHT",
      sellQty: 100,
      sellUnit: "g",
      price: 20000,
    },
  ];

  it("prefers the configured default serving key", () => {
    expect(
      getDefaultNewOrderServingVariant({
        defaultServingKey: "weight-100g",
        servingVariants: variants,
      })?.key,
    ).toBe("weight-100g");
  });

  it("falls back to the variant marked as default", () => {
    expect(
      getDefaultNewOrderServingVariant({ servingVariants: variants })?.key,
    ).toBe("portion");
  });

  it("normalizes decimal kg and integer portion quantities", () => {
    expect(normalizeNewOrderQuantity("0,74", "kg")).toBe(0.7);
    expect(normalizeNewOrderQuantity(0, "kg")).toBe(0.1);
    expect(normalizeNewOrderQuantity(2.6, "portion")).toBe(3);
    expect(normalizeNewOrderQuantity(0, "portion")).toBe(1);
  });

  it("derives kg defaults and a per-kg display price from gram variants", () => {
    expect(getNewOrderDefaultQuantity(variants[1])).toBe(0.1);
    expect(getNewOrderUnitPrice(variants[1])).toBe(200000);
  });
});
