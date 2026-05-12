import { describe, expect, it } from "vitest";
import { __testables } from "./useActiveMenuPromotions";

const {
  buildPromotionLookup,
  getPromotionLabel,
  isSupportedDisplayPromotion,
  normalizeMenuPromotion,
  selectPromotionForMenuItem,
} = __testables;

describe("useActiveMenuPromotions helpers", () => {
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
