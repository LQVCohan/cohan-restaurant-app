import { describe, expect, it } from "vitest";
import {
  buildPosCategoryTabs,
  filterPosMenuByCategory,
  hasPosCategory,
} from "./posMenuCategoryUtils";

describe("POS dynamic menu categories", () => {
  it("builds tabs from active categories in backend order", () => {
    const tabs = buildPosCategoryTabs([
      {
        id: "dessert-id",
        name: "Tráng miệng",
        order: 30,
        isActive: true,
        menuItemCount: 2,
      },
      {
        id: "main-id",
        name: "Món chính",
        order: 10,
        isActive: true,
        menuItemCount: 5,
      },
      {
        id: "hidden-id",
        name: "Danh mục tắt",
        order: 1,
        isActive: false,
        menuItemCount: 4,
      },
      {
        id: "empty-id",
        name: "Không có món",
        order: 2,
        isActive: true,
        menuItemCount: 0,
      },
    ]);

    expect(tabs).toEqual([
      { key: "all", label: "Tất cả" },
      { key: "main-id", label: "Món chính", count: 5 },
      { key: "dessert-id", label: "Tráng miệng", count: 2 },
    ]);
  });

  it("filters menu items by categoryId instead of legacy hardcoded names", () => {
    const items = [
      { id: "dish-1", categoryId: "starter-id", category: "main" },
      { id: "dish-2", categoryId: "main-id", category: "main" },
      { id: "dish-3", categoryId: "starter-id" },
    ];

    expect(filterPosMenuByCategory(items, "starter-id")).toEqual([
      items[0],
      items[2],
    ]);
    expect(filterPosMenuByCategory(items, "all")).toBe(items);
  });

  it("detects when the selected category no longer belongs to the time slot", () => {
    const tabs = buildPosCategoryTabs([
      {
        id: "drink-id",
        name: "Đồ uống",
        order: 1,
        isActive: true,
        menuItemCount: 3,
      },
    ]);

    expect(hasPosCategory(tabs, "drink-id")).toBe(true);
    expect(hasPosCategory(tabs, "old-category-id")).toBe(false);
  });
});
