import { describe, expect, it } from "vitest";
import { __testables } from "./useActiveDiscountPromotions";

describe("useActiveDiscountPromotions", () => {
  it("normalizes percentage promotion rows", () => {
    const promotion = __testables.normalizeDiscountPromotion({
      id: "promo-1",
      name: "Giảm 10%",
      code: "PROMO10",
      promotionType: "PERCENTAGE",
      scope: "ORDER",
      discountType: "PERCENT",
      discountValue: 10,
      minOrderValue: 100000,
      maxDiscount: 30000,
      level: 2,
      stacking: true,
    });

    expect(promotion).toMatchObject({
      id: "promo-1",
      name: "Giảm 10%",
      code: "PROMO10",
      type: "percentage",
      promotionType: "PERCENTAGE",
      scope: "order",
      discountType: "percent",
      discountValue: 10,
      minOrderValue: 100000,
      maxDiscount: 30000,
      level: 2,
      stacking: true,
    });
  });

  it("normalizes fixed amount promotion rows", () => {
    const promotion = __testables.normalizeDiscountPromotion({
      id: "promo-2",
      name: "Giảm 20k",
      promotionType: "FIXED",
      scope: "ORDER",
      discountType: "AMOUNT",
      discountValue: 20000,
    });

    expect(promotion.type).toBe("fixed");
    expect(promotion.discountType).toBe("fixed");
    expect(promotion.discountValue).toBe(20000);
  });

  it.each([
    ["COMBO", "combo"],
    ["FREESHIP", "freeship"],
  ])("preserves %s order promotions for POS selectors", (promotionType, type) => {
    const promotion = __testables.normalizeDiscountPromotion({
      id: `promo-${type}`,
      name: type,
      promotionType,
      scope: "ORDER",
      discountType: "AMOUNT",
      discountValue: 0,
    });

    expect(promotion).toMatchObject({
      id: `promo-${type}`,
      promotionType,
      scope: "order",
      type,
    });
  });
});
