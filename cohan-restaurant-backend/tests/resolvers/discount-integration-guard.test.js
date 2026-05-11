import { describe, expect, it } from "vitest";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

const ORDER_MUTATION_PATH = "graphql/resolvers/order/mutation.js";
const PAYMENT_MUTATION_PATH = "graphql/resolvers/payment/mutation.js";
const ORDER_QUERY_PATH = "graphql/resolvers/order/query.js";
const DISCOUNT_SERVICE_PATH = "src/services/discountCalculation.service.js";

describe("voucher promotion discount integration guards", () => {
  it("keeps preview read-only and backed by centralized discount service", () => {
    const querySrc = read(ORDER_QUERY_PATH);

    const previewStart = querySrc.indexOf("previewOrderDiscount");
    expect(previewStart).toBeGreaterThanOrEqual(0);

    const previewSrc = querySrc.slice(previewStart, previewStart + 6000);

    expect(previewSrc).toMatch(/calculateDiscountBreakdown/);
    expect(previewSrc).not.toMatch(/Coupon\.updateOne/);
    expect(previewSrc).not.toMatch(/Promotion\.updateOne/);
    expect(previewSrc).not.toMatch(/usageCount/);
    expect(previewSrc).not.toMatch(/used:\s*1/);
  });

  it("keeps order creation as the only order-side usage mutation path", () => {
    const mutationSrc = read(ORDER_MUTATION_PATH);

    expect(mutationSrc).toMatch(/async function incrementCouponUsageOnce/);
    expect(mutationSrc).toMatch(/async function incrementPromotionUsageOnce/);
    expect(mutationSrc).toMatch(/Coupon\.updateOne/);
    expect(mutationSrc).toMatch(/Promotion\.updateOne/);
    expect(mutationSrc).toMatch(/\$inc:\s*\{\s*used:\s*1\s*\}/);
    expect(mutationSrc).toMatch(/\$inc:\s*\{\s*usageCount:\s*1\s*\}/);

    expect(mutationSrc).not.toMatch(
      /await\s+incrementCouponUsageOnce\([\s\S]*?\);\s*if\s*\(\s*!updateResult\.modifiedCount\s*\)/,
    );
  });

  it("keeps payment-stage discounts using payableTotals and usage helpers", () => {
    const paymentSrc = read(PAYMENT_MUTATION_PATH);

    expect(paymentSrc).toMatch(/calculatePaymentTotalsWithOptionalDiscount/);
    expect(paymentSrc).toMatch(/resolvePaymentAmount/);
    expect(paymentSrc).toMatch(/expectedTotal:\s*payableTotals\.grandTotal/);
    expect(paymentSrc).toMatch(/buildInvoiceMeta/);
    expect(paymentSrc).toMatch(/incrementCouponUsageOnce/);
    expect(paymentSrc).toMatch(/incrementPromotionUsageOnce/);
    expect(paymentSrc).toMatch(
      /Payment amount does not match backend discounted total/,
    );
  });

  it("keeps stacking rules centralized in discount service", () => {
    const serviceSrc = read(DISCOUNT_SERVICE_PATH);

    expect(serviceSrc).toMatch(/stacking/);
    expect(serviceSrc).toMatch(/combinableWithPromotions/);
    expect(serviceSrc).toMatch(/exclusive/);
    expect(serviceSrc).toMatch(/priority/);
    expect(serviceSrc).toMatch(/appliedPromotions/);
    expect(serviceSrc).toMatch(/couponId/);
  });
});
