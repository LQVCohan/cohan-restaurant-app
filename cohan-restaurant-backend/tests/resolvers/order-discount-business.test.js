import { describe, it, expect } from "vitest";
import fs from "node:fs";

describe("order resolver discount/usage safety", () => {
  it("uses centralized discount service and does not use legacy voucher helper", () => {
    const src = fs.readFileSync("graphql/resolvers/order/mutation.js", "utf8");
    expect(src).toMatch(/calculateDiscountBreakdown/);
    expect(src).not.toMatch(/resolveVoucherDiscount\(/);
  });
  it("does not pass client-provided voucher or promotion discount into order totals directly", () => {
    const src = fs.readFileSync("graphql/resolvers/order/mutation.js", "utf8");

    expect(src).not.toMatch(/pricing\\.voucherDiscount/);
    expect(src).not.toMatch(/pricing\\.promotionDiscount/);
    expect(src).not.toMatch(/pricing\\.discountAmount/);
  });
  it("uses centralized totals fields for persisted order totals", () => {
    const src = fs.readFileSync("graphql/resolvers/order/mutation.js", "utf8");

    expect(src).toMatch(/const totals = await calculateDiscountBreakdown/);
    expect(src).toMatch(/totals\\.subtotal/);
    expect(src).toMatch(/totals\\.discount/);
    expect(src).toMatch(/totals\\.grandTotal/);
  });
  it("guards coupon usage increment by maxUsage atomically", () => {
    const src = fs.readFileSync("graphql/resolvers/order/mutation.js", "utf8");
    expect(src).toMatch(/\$lt: \["\$used", "\$maxUsage"\]/);
    expect(src).toMatch(/Invalid voucher: usage limit reached/);
  });

  it("keeps coupon increment in create\/commit paths only", () => {
    const src = fs.readFileSync("graphql/resolvers/order/mutation.js", "utf8");
    const count = (src.match(/\$inc: \{ used: 1 \}/g) || []).length;
    expect(count).toBe(2);
  });
});
