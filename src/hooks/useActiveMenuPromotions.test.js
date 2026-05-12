import { describe, expect, it } from "vitest";
import { __testables } from "./useActiveMenuPromotions";

describe("useActiveMenuPromotions", () => {
  it("normalizes item promotion rows", () => {
    const promotion = __testables.normalizeMenuPromotion({
      id: "promo-icecream",
      name: "Ưu đãi mùa hè",
      promotionType: "PERCENTAGE",
      scope: "ITEM",
      discountType: "PERCENT",
      discountValue: 5,
      itemId: "item-icecream",
      level: 2,
    });

    expect(promotion).toMatchObject({
      id: "promo-icecream",
      name: "Ưu đãi mùa hè",
      type: "percentage",
      scope: "item",
      discountType: "percent",
      discountValue: 5,
      itemId: "item-icecream",
      level: 2,
    });
  });

  it("normalizes category promotion rows", () => {
    const promotion = __testables.normalizeMenuPromotion({
      id: "promo-dessert",
      name: "Tráng miệng giảm giá",
      promotionType: "FIXED",
      scope: "CATEGORY",
      discountType: "AMOUNT",
      discountValue: 10000,
      categoryId: "cat-dessert",
    });

    expect(promotion).toMatchObject({
      id: "promo-dessert",
      scope: "category",
      type: "fixed",
      discountType: "fixed",
      discountValue: 10000,
      categoryId: "cat-dessert",
    });
  });

  it("formats percentage and fixed labels", () => {
    expect(
      __testables.getPromotionLabel({
        discountType: "percent",
        discountValue: 5,
      }),
    ).toBe("-5%");

    expect(
      __testables.getPromotionLabel({
        discountType: "fixed",
        discountValue: 10000,
      }),
    ).toBe("Giảm 10.000đ");
  });

  it("ranks item promotion above category promotion", () => {
    const itemPromotion = { scope: "item", level: 1 };
    const categoryPromotion = { scope: "category", level: 9 };

    expect(__testables.getPromotionRank(itemPromotion)).toBeGreaterThan(
      __testables.getPromotionRank(categoryPromotion),
    );
  });
});
