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
});
