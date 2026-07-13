import { describe, expect, it } from "vitest";

import { synchronizeOrderItemReferences } from "../../scripts/repairDefenseOrderMenuReferences.js";

describe("defense order menu reference repair", () => {
  it("updates stale menu/category references while preserving order snapshots", () => {
    const items = [
      {
        _id: "line-1",
        dishId: "dish-1",
        menuId: "legacy-menu",
        categoryId: "legacy-category",
        name: "Phở bò đặc biệt",
        quantity: 2,
        unitPrice: 79_000,
        servingVariant: { key: "regular", name: "Phần tiêu chuẩn" },
      },
    ];
    const menuItemById = new Map([
      [
        "dish-1",
        {
          _id: "dish-1",
          menuId: "breakfast-menu",
          categoryId: "breakfast-category",
        },
      ],
    ]);

    const result = synchronizeOrderItemReferences(items, menuItemById);

    expect(result.changedItems).toBe(1);
    expect(result.items[0]).toMatchObject({
      _id: "line-1",
      dishId: "dish-1",
      menuId: "breakfast-menu",
      categoryId: "breakfast-category",
      name: "Phở bò đặc biệt",
      quantity: 2,
      unitPrice: 79_000,
      servingVariant: { key: "regular", name: "Phần tiêu chuẩn" },
    });
  });

  it("is idempotent when references already match", () => {
    const items = [
      {
        dishId: "dish-1",
        menuId: "menu-1",
        categoryId: "category-1",
      },
    ];
    const menuItemById = new Map([
      [
        "dish-1",
        { _id: "dish-1", menuId: "menu-1", categoryId: "category-1" },
      ],
    ]);

    const result = synchronizeOrderItemReferences(items, menuItemById);

    expect(result.changedItems).toBe(0);
    expect(result.items).toEqual(items);
  });

  it("fails instead of hiding an order item that references a missing dish", () => {
    expect(() =>
      synchronizeOrderItemReferences(
        [{ dishId: "missing-dish", menuId: "menu", categoryId: "category" }],
        new Map(),
      ),
    ).toThrow("DEFENSE_ORDER_REFERENCE_REPAIR_FAILED: missing MenuItem for dish missing-dish");
  });
});
