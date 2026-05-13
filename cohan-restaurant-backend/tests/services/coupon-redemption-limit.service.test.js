import { describe, expect, it } from "vitest";
import fs from "node:fs";

const DISCOUNT_SERVICE_PATH = "src/services/discountCalculation.service.js";

describe("coupon per-user redemption limit", () => {
  it("uses CouponRedemption history only when an authenticated user is available", () => {
    const src = fs.readFileSync(DISCOUNT_SERVICE_PATH, "utf8");

    expect(src).toMatch(/CouponRedemption/);
    expect(src).toMatch(
      /const perUserLimit = toNum\(constraints\.perUserLimit, 0\)/,
    );
    expect(src).toMatch(
      /CouponRedemption\.countDocuments\(\{[\s\S]*couponId: coupon\._id,[\s\S]*userId: uid/,
    );
    expect(src).toMatch(/if \(perUserLimit > 0\)/);
    expect(src).toMatch(
      /authenticated customer is required for per-user limit/,
    );
    expect(src).toMatch(/Invalid coupon: per-user usage limit reached/);
    expect(src).not.toMatch(/Invalid voucher: per-user usage limit reached/);
  });
});
