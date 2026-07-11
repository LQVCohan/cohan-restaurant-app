import { describe, expect, it } from "vitest";

import { __testables } from "./usePromotions";

describe("usePromotions buildPromotionInput", () => {
  it("maps item scope to itemId and clears category targeting fields", () => {
    const input = __testables.buildPromotionInput(
      {
        name: "Mua 1 tang 1",
        code: "BOGO01",
        type: "bogo",
        scope: "item",
        categoryId: "cat-filter",
        itemId: "item-buy",
        giftItemId: "item-gift",
        buyQuantity: 1,
        getQuantity: 1,
        startDate: "2026-05-01T10:00",
        endDate: "2026-05-05T22:00",
        status: "active",
      },
      "restaurant-1",
    );

    expect(input).toEqual(
      expect.objectContaining({
        promotionType: "BOGO",
        scope: "ITEM",
        categoryId: null,
        itemId: "item-buy",
        giftItemId: "item-gift",
        startAt: "2026-05-01T03:00:00.000Z",
        endAt: "2026-05-05T15:00:00.000Z",
      }),
    );
    expect(input).not.toHaveProperty("menuId");
  });

  it("maps category scope to categoryId and clears item targeting fields", () => {
    const input = __testables.buildPromotionInput(
      {
        name: "Giam mon chinh",
        code: "CAT10",
        type: "percentage",
        scope: "category",
        categoryId: "cat-1",
        itemId: "item-should-not-send",
        discountValue: 10,
        startDate: "2026-05-01T10:00",
        endDate: "2026-05-05T22:00",
        status: "active",
      },
      "restaurant-1",
    );

    expect(input).toEqual(
      expect.objectContaining({
        promotionType: "PERCENTAGE",
        scope: "CATEGORY",
        categoryId: "cat-1",
        itemId: null,
      }),
    );
    expect(input).not.toHaveProperty("menuId");
  });

  it("preserves comboItems for combo promotions", () => {
    const input = __testables.buildPromotionInput(
      {
        name: "Combo burger",
        code: "COMBO10",
        type: "combo",
        scope: "item",
        itemId: "should-clear",
        giftItemId: "gift-should-clear",
        discountType: "fixed",
        discountValue: 10000,
        comboItems: [
          { itemId: "burger", quantity: 1 },
          { itemId: "coke", quantity: 2 },
        ],
        startDate: "2026-05-01T10:00",
        endDate: "2026-05-05T22:00",
        status: "active",
      },
      "restaurant-1",
    );

    expect(input).toEqual(
      expect.objectContaining({
        promotionType: "COMBO",
        scope: "ORDER",
        itemId: null,
        giftItemId: null,
        buyQuantity: 0,
        getQuantity: 0,
        discountType: "AMOUNT",
        discountValue: 10000,
        comboItems: [
          { itemId: "burger", quantity: 1 },
          { itemId: "coke", quantity: 2 },
        ],
      }),
    );
  });
});

describe("usePromotions management helpers", () => {
  const currentPromotion = {
    id: "promotion-1",
    restaurantId: "restaurant-1",
    name: "Lunch",
    code: "LUNCH10",
    type: "percentage",
    scope: "order",
    discountType: "percent",
    discountValue: 10,
    minOrderValue: 0,
    maxDiscount: 0,
    usageLimit: 0,
    targetAudience: "all",
    conditions: [],
    level: 1,
    startDate: "2026-05-01T10:00",
    endDate: "2026-05-05T22:00",
    status: "active",
    stacking: false,
  };

  it("detects status-only changes so the dedicated toggle mutation can be used", () => {
    expect(
      __testables.isStatusOnlyPromotionUpdate(
        currentPromotion,
        { ...currentPromotion, status: "draft" },
        "restaurant-1",
      ),
    ).toBe(true);

    expect(
      __testables.isStatusOnlyPromotionUpdate(
        currentPromotion,
        { ...currentPromotion, status: "draft", discountValue: 20 },
        "restaurant-1",
      ),
    ).toBe(false);
  });

  it("builds a unique duplicate code without changing the source promotion", () => {
    expect(
      __testables.buildDuplicatePromotionCode("LUNCH10", [
        { code: "LUNCH10" },
        { code: "LUNCH10_COPY" },
        { code: "LUNCH10_COPY_2" },
      ]),
    ).toBe("LUNCH10_COPY_3");
  });
});

describe("usePromotions normalizePromotion", () => {
  it("preserves comboItems from API", () => {
    const normalized = __testables.normalizePromotion({
      id: "promo-combo",
      name: "Combo burger",
      promotionType: "COMBO",
      discountType: "AMOUNT",
      comboItems: [
        { itemId: "burger", quantity: 1 },
        { itemId: "coke", quantity: 2 },
      ],
      isActive: true,
    });

    expect(normalized).toEqual(
      expect.objectContaining({
        type: "combo",
        discountType: "fixed",
        comboItems: [
          { itemId: "burger", quantity: 1 },
          { itemId: "coke", quantity: 2 },
        ],
      }),
    );
  });
});
