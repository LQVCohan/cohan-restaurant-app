import { describe, expect, it } from "vitest";
import fs from "node:fs";

const MODEL_PATH = "models/coupon-redemption.model.js";
const INDEX_PATH = "models/index.js";
const SCHEMA_PATH = "graphql/schema/coupon_redemption.graphql";
const SCHEMA_INDEX_PATH = "graphql/schema/index.js";

describe("CouponRedemption model and schema", () => {
  it("defines the redemption history shape and useful indexes", () => {
    const src = fs.readFileSync(MODEL_PATH, "utf8");

    expect(src).toMatch(/couponId:[\s\S]*ref: "Coupon"[\s\S]*required: true/);
    expect(src).toMatch(/userId:[\s\S]*ref: "User"/);
    expect(src).toMatch(/restaurantId:[\s\S]*ref: "Restaurant"[\s\S]*required: true/);
    expect(src).toMatch(/orderIds:[\s\S]*ref: "Order"/);
    expect(src).toMatch(/invoiceId:[\s\S]*ref: "Invoice"/);
    expect(src).toMatch(/couponCode:[\s\S]*uppercase: true/);
    expect(src).toMatch(/enum: \["customer_checkout", "pos", "staff_order"\]/);
    expect(src).toMatch(/CouponRedemptionSchema\.index\(\{ couponId: 1, userId: 1 \}\)/);
    expect(src).toMatch(/CouponRedemptionSchema\.index\(\{ restaurantId: 1, redeemedAt: -1 \}\)/);
    expect(src).toMatch(/CouponRedemptionSchema\.index\(\{ couponCode: 1, restaurantId: 1 \}\)/);
    expect(src).toMatch(/CouponRedemptionSchema\.index\(\{ invoiceId: 1 \}\)/);
    expect(src).toMatch(/unique: true/);
  });

  it("exports the model and registers GraphQL schema", () => {
    expect(fs.readFileSync(INDEX_PATH, "utf8")).toMatch(/CouponRedemption/);
    expect(fs.readFileSync(SCHEMA_INDEX_PATH, "utf8")).toMatch(/coupon_redemption\.graphql/);
    expect(fs.readFileSync(SCHEMA_PATH, "utf8")).toMatch(/type CouponRedemption/);
    expect(fs.readFileSync(SCHEMA_PATH, "utf8")).toMatch(/myCouponRedemptions/);
    expect(fs.readFileSync(SCHEMA_PATH, "utf8")).toMatch(/couponRedemptionsByRestaurant/);
  });
});
