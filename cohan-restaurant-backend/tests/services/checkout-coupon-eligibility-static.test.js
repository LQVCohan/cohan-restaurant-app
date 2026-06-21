import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd().endsWith("cohan-restaurant-backend")
  ? process.cwd()
  : path.join(process.cwd(), "cohan-restaurant-backend");
const readBackend = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
const serviceSource = () => readBackend("src/services/checkoutCouponEligibility.service.js");
const schemaSource = () => readBackend("graphql/schema/order.graphql");

describe("checkout coupon eligibility wiring", () => {
  it("exposes the checkoutCouponEligibilities query shape", () => {
    const schema = schemaSource();
    expect(schema).toContain("input CheckoutCouponEligibilityInput");
    expect(schema).toContain("type CheckoutCouponEligibility");
    expect(schema).toContain("checkoutCouponEligibilities(input: CheckoutCouponEligibilityInput!)");
  });

  it("normalizes codes and returns stable reason codes", () => {
    const src = serviceSource();
    [
      "COUPON_NOT_FOUND",
      "COUPON_NOT_ACTIVE",
      "MIN_ORDER_NOT_MET",
      "CUSTOMER_RANK_NOT_ELIGIBLE",
      "PER_USER_LIMIT_REACHED",
      "FIRST_ORDER_ONLY",
      "NO_ELIGIBLE_CATEGORY_ITEMS",
      "INVALID_ITEMS",
    ].forEach((code) => expect(src).toContain(code));
    expect(src).toContain("slice(0, MAX_COUPON_CODES)");
  });

  it("reuses discount and customer-rank services instead of duplicating eligibility rules", () => {
    const src = serviceSource();
    expect(src).toContain("calculateDiscountBreakdown");
    expect(src).toContain("loadCustomerRankContext");
    expect(src).toContain("resolveCustomerRankAliasesForRestaurant");
    expect(src).toContain("hydrateCheckoutOrderItems");
    expect(src).not.toContain("basePrice");
    expect(src).not.toContain("modifiersPrice: 0");
    expect(src).not.toContain("CouponRedemption.create");
  });
});
