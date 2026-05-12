import { describe, expect, it } from "vitest";
import { __testables } from "./useActiveMenuPromotions";

const {
  buildPromotionLookup,
  getPromotionLabel,
  getMenuCategoryCandidateIds,
  getMenuItemCandidateIds,
  isSupportedDisplayPromotion,
  normalizeMenuPromotion,
  selectPromotionForMenuItem,
} = __testables;

describe("useActiveMenuPromotions helpers", () => {
  it("normalizes promotion target ids to strings", () => {
    const promotion = normalizeMenuPromotion({
      id: 1,
      categoryId: 200,
      itemId: 100,
      scope: "ITEM",
      promotionType: "PERCENTAGE",
      discountType: "PERCENT",
    });

    expect(promotion.id).toBe("1");
    expect(promotion.itemId).toBe("100");
    expect(promotion.categoryId).toBe("200");
  });

  it("prioritizes item promotion over category promotion for a menu item", () => {
    const promotions = [
      normalizeMenuPromotion({
        id: "promo-category",
        name: "Ưu đãi mùa hè",
        scope: "CATEGORY",
        promotionType: "PERCENTAGE",
        discountType: "PERCENT",
        discountValue: 5,
        categoryId: "cat_main",
        level: 10,
      }),
      normalizeMenuPromotion({
        id: "promo-item",
        name: "Kem giảm 5%",
        scope: "ITEM",
        promotionType: "PERCENTAGE",
        discountType: "PERCENT",
        discountValue: 5,
        itemId: "lunch_02",
        level: 1,
      }),
    ];

    const promotion = selectPromotionForMenuItem(
      { id: "lunch_02", categoryId: "cat_main" },
      {
        promotionByItemId: buildPromotionLookup(promotions, "itemId"),
        promotionByCategoryId: buildPromotionLookup(promotions, "categoryId"),
      },
    );

    expect(promotion?.id).toBe("promo-item");
  });

  it("matches item promotions through dishId, menuId, menuItemId, and nested menuItem.id", () => {
    const promotions = [
      normalizeMenuPromotion({
        id: "promo-dish",
        scope: "ITEM",
        promotionType: "PERCENTAGE",
        discountType: "PERCENT",
        discountValue: 5,
        itemId: "dish-01",
      }),
      normalizeMenuPromotion({
        id: "promo-menu",
        scope: "ITEM",
        promotionType: "PERCENTAGE",
        discountType: "PERCENT",
        discountValue: 7,
        itemId: "menu-02",
      }),
      normalizeMenuPromotion({
        id: "promo-menu-item",
        scope: "ITEM",
        promotionType: "FIXED",
        discountType: "AMOUNT",
        discountValue: 10000,
        itemId: "nested-03",
      }),
    ];
    const promotionByItemId = buildPromotionLookup(promotions, "itemId");

    expect(
      selectPromotionForMenuItem(
        { dishId: "dish-01" },
        { promotionByItemId },
      )?.id,
    ).toBe("promo-dish");
    expect(
      selectPromotionForMenuItem(
        { menuId: "menu-02" },
        { promotionByItemId },
      )?.id,
    ).toBe("promo-menu");
    expect(
      selectPromotionForMenuItem(
        { menuItemId: "nested-03" },
        { promotionByItemId },
      )?.id,
    ).toBe("promo-menu-item");
    expect(
      selectPromotionForMenuItem(
        { menuItem: { id: "nested-03" } },
        { promotionByItemId },
      )?.id,
    ).toBe("promo-menu-item");
  });

  it("matches category promotion by nested category.id and category._id", () => {
    const promotions = [
      normalizeMenuPromotion({
        id: "promo-category",
        scope: "CATEGORY",
        promotionType: "PERCENTAGE",
        discountType: "PERCENT",
        discountValue: 5,
        categoryId: "cat-01",
      }),
    ];
    const promotionByCategoryId = buildPromotionLookup(promotions, "categoryId");

    expect(
      selectPromotionForMenuItem(
        { category: { id: "cat-01" } },
        { promotionByCategoryId },
      )?.id,
    ).toBe("promo-category");
    expect(
      selectPromotionForMenuItem(
        { category: { _id: "cat-01" } },
        { promotionByCategoryId },
      )?.id,
    ).toBe("promo-category");
  });

  it("collects candidate ids for menu item and category aliases", () => {
    expect(
      getMenuItemCandidateIds({
        id: "menu-1",
        _id: "menu-1",
        dishId: "dish-1",
        menuId: "menu-ref-1",
        menuItemId: "menu-item-1",
        menuItem: { id: "nested-1", _id: "nested-2" },
      }),
    ).toEqual([
      "menu-1",
      "dish-1",
      "menu-ref-1",
      "menu-item-1",
      "nested-1",
      "nested-2",
    ]);
    expect(
      getMenuCategoryCandidateIds({
        categoryId: "cat-1",
        category: { id: "cat-2", _id: "cat-3" },
      }),
    ).toEqual(["cat-1", "cat-2", "cat-3"]);
  });

  it("keeps only the highest-level promotion inside the same scope", () => {
    const promotions = [
      normalizeMenuPromotion({
        id: "promo-low",
        scope: "CATEGORY",
        promotionType: "PERCENTAGE",
        discountType: "PERCENT",
        discountValue: 5,
        categoryId: "cat_drink",
        level: 1,
      }),
      normalizeMenuPromotion({
        id: "promo-high",
        scope: "CATEGORY",
        promotionType: "FIXED",
        discountType: "AMOUNT",
        discountValue: 10000,
        categoryId: "cat_drink",
        level: 9,
      }),
    ];

    const promotionByCategoryId = buildPromotionLookup(promotions, "categoryId");

    expect(promotionByCategoryId.cat_drink?.id).toBe("promo-high");
  });

  it("filters out unsupported scopes and non-direct discount promotion types", () => {
    const itemPromotion = normalizeMenuPromotion({
      id: "promo-item",
      scope: "ITEM",
      promotionType: "PERCENTAGE",
      discountType: "PERCENT",
    });
    const orderPromotion = normalizeMenuPromotion({
      id: "promo-order",
      scope: "ORDER",
      promotionType: "PERCENTAGE",
      discountType: "PERCENT",
    });
    const bogoPromotion = normalizeMenuPromotion({
      id: "promo-bogo",
      scope: "ITEM",
      promotionType: "BOGO",
      discountType: "PERCENT",
    });

    expect(isSupportedDisplayPromotion(itemPromotion)).toBe(true);
    expect(isSupportedDisplayPromotion(orderPromotion)).toBe(false);
    expect(isSupportedDisplayPromotion(bogoPromotion)).toBe(false);
  });

  it("formats promotion labels for percentage, fixed amount, and fallback cases", () => {
    expect(
      getPromotionLabel(
        normalizeMenuPromotion({
          id: "promo-percent",
          scope: "ITEM",
          promotionType: "PERCENTAGE",
          discountType: "PERCENT",
          discountValue: 5,
        }),
      ),
    ).toBe("-5%");

    expect(
      getPromotionLabel(
        normalizeMenuPromotion({
          id: "promo-fixed",
          scope: "ITEM",
          promotionType: "FIXED",
          discountType: "AMOUNT",
          discountValue: 10000,
        }),
      ),
    ).toBe("Giảm 10.000đ");

    expect(
      getPromotionLabel({
        id: "promo-fallback",
        promotionType: "",
        discountType: "",
      }),
    ).toBe("Ưu đãi");
  });
});
