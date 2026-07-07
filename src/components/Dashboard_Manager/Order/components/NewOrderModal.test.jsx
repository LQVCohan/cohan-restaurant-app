import { describe, expect, it } from "vitest";
import { buildNewOrderCategoryOptions } from "./NewOrderModal";

describe("buildNewOrderCategoryOptions", () => {
  it("uses menu category names and keeps only one fallback category", () => {
    const menus = [
      {
        timeSlot: "lunch",
        categoryMenu: [
          { id: "main", name: "Món chính", isActive: true },
          { id: "drink", name: "Đồ uống", isActive: true },
          { id: "hidden", name: "Đã ẩn", isActive: false },
        ],
      },
    ];
    const items = [
      { categoryId: "main" },
      { categoryId: "drink" },
      { categoryId: "orphan-a" },
      { categoryId: "orphan-b" },
      { categoryId: null },
    ];

    const options = buildNewOrderCategoryOptions(menus, items, "lunch");

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
      [
        {
          timeSlot: "dinner",
          categoryMenu: [{ id: "other", name: "Khác", isActive: true }],
        },
      ],
      [{ categoryId: "other" }, { categoryId: "legacy" }],
      "dinner",
    );

    expect(options.filter((option) => option.name === "Khác")).toHaveLength(1);
    expect(options.find((option) => option.name === "Khác")?.categoryIds).toEqual([
      "other",
      "legacy",
    ]);
  });
});
