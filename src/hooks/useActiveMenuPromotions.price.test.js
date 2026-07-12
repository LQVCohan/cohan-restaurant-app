import { describe, expect, it } from "vitest";
import {
  __testables,
  calculatePromotionPricePreview,
} from "./useActiveMenuPromotions";

const { getPromotionLabel } = __testables;

describe("customer promotion price preview", () => {
  it("matches backend percentage rounding and max discount", () => {
    expect(
      calculatePromotionPricePreview(
        {
          discountType: "PERCENT",
          discountValue: 20,
          maxDiscount: 15000,
        },
        100000,
      ),
    ).toEqual({
      originalTotal: 100000,
      finalTotal: 85000,
      discount: 15000,
      requiresOrderMinimum: false,
    });
  });

  it("applies a fixed discount once to the line total", () => {
    expect(
      calculatePromotionPricePreview(
        { discountType: "AMOUNT", discountValue: 10000 },
        50000,
        2,
      ),
    ).toEqual({
      originalTotal: 100000,
      finalTotal: 90000,
      discount: 10000,
      requiresOrderMinimum: false,
    });
  });

  it("does not claim an immediate lower price when minimum order is required", () => {
    expect(
      calculatePromotionPricePreview(
        {
          discountType: "PERCENT",
          discountValue: 10,
          minOrderValue: 200000,
        },
        100000,
      ),
    ).toEqual({
      originalTotal: 100000,
      finalTotal: 100000,
      discount: 0,
      requiresOrderMinimum: true,
    });

    expect(
      getPromotionLabel({
        discountType: "PERCENT",
        discountValue: 10,
        minOrderValue: 200000,
      }),
    ).toBe("-10% · đơn từ 200.000đ");
  });
});
