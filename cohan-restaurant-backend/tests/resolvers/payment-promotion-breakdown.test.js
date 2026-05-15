import { describe, expect, it } from "vitest";
import { buildAppliedPromotionBreakdown } from "../../graphql/resolvers/payment/mutation.js";

describe("buildAppliedPromotionBreakdown", () => {
  it("creates shipping row from appliedPromotionDetails FREESHIP metadata", () => {
    const breakdown = buildAppliedPromotionBreakdown({
      appliedPromotions: ["promo-freeship"],
      appliedPromotionDetails: [
        {
          promotionId: "promo-freeship",
          promotionName: "Free Ship",
          promotionType: "FREESHIP",
          promotionScope: "ORDER",
          discountType: "FIXED",
          discountValue: 15000,
        },
      ],
      promotionLines: [],
      shippingDiscount: 15000,
    });

    expect(breakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          promotionId: "promo-freeship",
          promotionType: "FREESHIP",
          source: "shipping",
          discountAmount: 15000,
        }),
      ]),
    );
  });

  it("keeps line/order rows for BOGO and COMBO", () => {
    const breakdown = buildAppliedPromotionBreakdown({
      promotionLines: [
        {
          promotionId: "promo-bogo",
          promotionName: "Buy One Get One",
          promotionType: "BOGO",
          promotionScope: "ITEM",
          discountType: "BOGO",
          discountValue: 1,
          discount: 12000,
          lineId: "line-1",
          itemName: "Pho",
          quantity: 2,
          freeQuantity: 1,
        },
        {
          promotionId: "promo-combo",
          promotionName: "Combo Family",
          promotionType: "COMBO",
          promotionScope: "ORDER",
          discountType: "PERCENT",
          discountValue: 20,
          discount: 20000,
          comboCount: 2,
          comboBase: 100000,
        },
      ],
      shippingDiscount: 0,
    });

    expect(breakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          promotionId: "promo-bogo",
          source: "line",
          freeQuantity: 1,
          discountAmount: 12000,
        }),
        expect.objectContaining({
          promotionId: "promo-combo",
          source: "order",
          comboCount: 2,
          comboBase: 100000,
          discountAmount: 20000,
        }),
      ]),
    );
  });
});
