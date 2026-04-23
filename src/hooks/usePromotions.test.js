import { describe, expect, it } from "vitest";

import { __testables } from "./usePromotions";

describe("usePromotions buildPromotionInput", () => {
  it("normalizes datetime-local values to ISO in Vietnam timezone for promotion mutations", () => {
    const input = __testables.buildPromotionInput(
      {
        name: "Mua 1 tang 1",
        code: "BOGO01",
        type: "bogo",
        scope: "item",
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
        itemId: "item-buy",
        giftItemId: "item-gift",
        startAt: "2026-05-01T03:00:00.000Z",
        endAt: "2026-05-05T15:00:00.000Z",
      }),
    );
  });
});
