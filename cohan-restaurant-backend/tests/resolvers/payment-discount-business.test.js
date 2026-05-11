import { describe, expect, it } from "vitest";
import fs from "node:fs";

const PAYMENTS_SCHEMA_PATH = "graphql/schema/payments.graphql";
const PAYMENT_MUTATION_PATH = "graphql/resolvers/payment/mutation.js";
const INVOICE_MODEL_PATH = "models/invoice.model.js";

const readFile = (path) => fs.readFileSync(path, "utf8");
const getFunctionSnippet = (src, functionName) => {
  const start = src.indexOf(`export const ${functionName}`);
  if (start < 0) return "";

  const next = src.indexOf("\nexport const ", start + 1);
  return next > start ? src.slice(start, next) : src.slice(start);
};
describe("payment stage discount business coverage", () => {
  it("payments.graphql accepts pricing and promotionIds on payment inputs", () => {
    const src = readFile(PAYMENTS_SCHEMA_PATH);

    expect(src).toMatch(
      /input PayOrdersByTableIdInput \{[\s\S]*pricing: CheckoutPricingInput/,
    );
    expect(src).toMatch(
      /input PayOrdersByTableIdInput \{[\s\S]*promotionIds: \[ID!\]/,
    );
    expect(src).toMatch(
      /input PayOrdersByOrderIdsInput \{[\s\S]*pricing: CheckoutPricingInput/,
    );
    expect(src).toMatch(
      /input PayOrdersByOrderIdsInput \{[\s\S]*promotionIds: \[ID!\]/,
    );
  });
  it("payOrdersByTableId uses backend discounted total and increments coupon usage", () => {
    const src = readFile(PAYMENT_MUTATION_PATH);
    const snippet = getFunctionSnippet(src, "payOrdersByTableId");

    expect(snippet).toMatch(/resolvePaymentAmount\(\{/);
    expect(snippet).toMatch(/expectedTotal:\s*payableTotals\.grandTotal/);
    expect(snippet).toMatch(/appliedDiscount/);
    expect(snippet).toMatch(
      /incrementCouponUsageOnce\(\{\s*totals:\s*discountTotals,\s*session\s*\}\)/,
    );
    expect(snippet).not.toMatch(
      /paidAmount != null \? Number\(paidAmount\) : aggregatedTotals\.grandTotal/,
    );
  });
  it("payment mutation imports and uses calculateDiscountBreakdown", () => {
    const src = readFile(PAYMENT_MUTATION_PATH);

    expect(src).toMatch(/calculateDiscountBreakdown/);
    expect(src).toMatch(/calculatePaymentTotalsWithOptionalDiscount/);
    expect(src).toMatch(/buildDiscountItemsFromOrders/);
  });

  it("coupon usage increment is atomic and inside payment resolver", () => {
    const src = readFile(PAYMENT_MUTATION_PATH);

    expect(src).toMatch(/incrementCouponUsageOnce/);
    expect(src).toMatch(/Coupon\.updateOne/);
    expect(src).toMatch(/\$inc:\s*\{\s*used:\s*1\s*\}/);
    expect(src).toMatch(/\$lt:\s*\[\s*"\$used",\s*"\$maxUsage"\s*\]/);
  });

  it("payment amount is backend source-of-truth when discount applies", () => {
    const src = readFile(PAYMENT_MUTATION_PATH);

    expect(src).toMatch(/resolvePaymentAmount/);
    expect(src).toMatch(
      /Payment amount does not match backend discounted total/,
    );
  });

  it("invoice totals are persisted from payableTotals", () => {
    const src = readFile(PAYMENT_MUTATION_PATH);

    expect(src).toMatch(/subtotal:\s*payableTotals\.subtotal/);
    expect(src).toMatch(/discount:\s*payableTotals\.discount/);
    expect(src).toMatch(/grandTotal:\s*payableTotals\.grandTotal/);
    expect(src).not.toMatch(
      /amountToPay \+ 1e-6 >= aggregatedTotals\.grandTotal/,
    );
  });

  it("invoice model persists discount metadata and payment-stage totals", () => {
    const src = readFile(INVOICE_MODEL_PATH);

    expect(src).toMatch(/meta:\s*\{\s*type:\s*Schema\.Types\.Mixed\s*\}/);
    expect(src).toMatch(/shippingFee:\s*\{\s*type:\s*Number/);
    expect(src).toMatch(/discountReason:\s*\{\s*type:\s*String/);
    expect(src).toMatch(/voucherCode:\s*\{\s*type:\s*String/);
    expect(src).toMatch(/promotionId:\s*\{\s*type:\s*Types\.ObjectId/);
  });
});
