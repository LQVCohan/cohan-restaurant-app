import { describe, expect, it } from "vitest";
import fs from "node:fs";
import {
  buildEligibilityContextKey,
  getEligibilityRecord,
  normalizeCouponCode,
} from "./OrderSummaryTransferModalUpload.jsx";

const source = () => fs.readFileSync("src/components/Customer/BookingDishesModal/OrderSummaryTransferModalUpload.jsx", "utf8");

describe("checkout coupon backend eligibility gating", () => {
  it("canonicalizes context keys for modifiers and item order", () => {
    const a = buildEligibilityContextKey({
      group: { restaurantId: "r1", items: [
        { dishId: "b", quantity: 1, servingKey: "large", selectedModifiers: [{ groupId: "g2", optionId: "o2" }, { groupId: "g1", optionId: "o1" }] },
        { dishId: "a", quantity: 2, servingKey: "regular", weightGrams: 500 },
      ] },
      orderType: "delivery",
      paymentMethod: "cash",
    });
    const b = buildEligibilityContextKey({
      group: { restaurantId: "r1", items: [
        { dishId: "a", quantity: 2, servingKey: "regular", weightGrams: 500 },
        { dishId: "b", quantity: 1, servingKey: "large", selectedModifiers: [{ groupId: "g1", optionId: "o1" }, { groupId: "g2", optionId: "o2" }] },
      ] },
      orderType: "delivery",
      paymentMethod: "cash",
    });

    expect(a).toBe(b);
    expect(a).toContain('"weightGrams":500');
  });

  it("returns eligibility only for the active context and normalized coupon code", () => {
    const record = { couponCode: "VIP20", eligible: true, estimatedDiscount: 10000 };
    const eligibilityByRestaurant = {
      r1: { contextKey: "current", byCode: { VIP20: record } },
    };

    expect(normalizeCouponCode(" vip20 ")).toBe("VIP20");
    expect(getEligibilityRecord({ eligibilityByRestaurant, restaurantId: "r1", couponCode: "vip20", contextKey: "current" })).toBe(record);
    expect(getEligibilityRecord({ eligibilityByRestaurant, restaurantId: "r1", couponCode: "vip20", contextKey: "stale" })).toBeNull();
  });

  it("renders every coupon in a restaurant group and does not limit UI to the best coupon", () => {
    const src = source();
    expect(src).toContain("coupons.map((coupon)");
    expect(src).not.toContain("const display = best || ineligible");
    expect(src).toContain("coupon-restaurant-group");
  });

  it("only sends selected coupon codes through verified selectedCouponDetails", () => {
    const src = source();
    expect(src).toContain("if (!eligibility?.eligible) return null");
    expect(src).toContain("Object.entries(selectedCouponCodeMap)");
    expect(src).not.toContain("Object.entries(selectedCouponCodesByRestaurant)\n      .filter");
  });
});
