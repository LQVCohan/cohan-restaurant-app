import { describe, expect, it } from "vitest";
import fs from "node:fs";

const source = () => fs.readFileSync("src/components/Customer/BookingDishesModal/OrderSummaryTransferModalUpload.jsx", "utf8");

describe("checkout coupon backend eligibility gating", () => {
  it("queries backend eligibility before auto-selecting coupons", () => {
    const src = source();
    expect(src).toContain("checkoutCouponEligibilities");
    expect(src).toContain("CHECKOUT_COUPON_ELIGIBILITIES");
    expect(src).toContain("eligibilityLoadingByRestaurant");
    expect(src).toContain("eligibilityErrorByRestaurant");
  });

  it("only sends selected coupon codes through verified selectedCouponDetails", () => {
    const src = source();
    expect(src).toContain("if (!eligibility?.eligible) return null");
    expect(src).toContain("Object.entries(selectedCouponCodeMap)");
    expect(src).not.toContain("Object.entries(selectedCouponCodesByRestaurant)\n      .filter");
  });

  it("keeps manual no-coupon choice from being auto-selected again", () => {
    const src = source();
    expect(src).toContain("couponSelectionSourceByRestaurant");
    expect(src).toContain('source === "none"');
    expect(src).toContain('[group.restaurantId]: "none"');
  });
});
