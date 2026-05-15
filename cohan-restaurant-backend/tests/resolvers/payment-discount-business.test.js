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
    expect(snippet).toMatch(/incrementCouponUsageOnce\(\{/);
    expect(snippet).toMatch(/invoice,/);
    expect(snippet).toMatch(/orderIds,/);
    expect(snippet).toMatch(/restaurantId:\s*rid/);
    expect(snippet).toMatch(/source:\s*"pos"/);
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
    expect(src).toMatch(/CouponRedemption\.findOne/);
    expect(src).toMatch(/CouponRedemption\.create/);
    expect(src).toMatch(/UserCoupon\.updateOne/);
    expect(src).toMatch(/Coupon\.updateOne/);
    expect(src).toMatch(/\$inc:\s*\{\s*used:\s*1\s*\}/);
    expect(src).toMatch(/\$lt:\s*\[\s*"\$used",\s*"\$maxUsage"\s*\]/);
  });
  it("promotion usage increment is atomic and inside payment resolver", () => {
    const src = readFile(PAYMENT_MUTATION_PATH);

    expect(src).toMatch(/async function incrementPromotionUsageOnce/);
    expect(src).toMatch(/Promotion\.updateOne/);
    expect(src).toMatch(/\$inc:\s*\{\s*usageCount:\s*1\s*\}/);
    expect(src).toMatch(
      /\$lt:\s*\[\s*"\$usageCount"\s*,\s*"\$usageLimit"\s*\]/,
    );
    expect(src).toMatch(/\$lte:\s*\[\s*"\$usageLimit"\s*,\s*0\s*\]/);
    expect(src).toMatch(/Invalid promotion: usage limit reached/);
  });

  it("increments promotion usage after successful payment-stage discount", () => {
    const src = readFile(PAYMENT_MUTATION_PATH);
    const tableSnippet = getFunctionSnippet(src, "payOrdersByTableId");
    const orderIdsSnippet = getFunctionSnippet(src, "payOrdersByOrderIds");

    expect(tableSnippet).toMatch(
      /await incrementPromotionUsageOnce\(\{\s*totals:\s*discountTotals,\s*session\s*\}\)/,
    );
    expect(orderIdsSnippet).toMatch(
      /await incrementPromotionUsageOnce\(\{\s*totals:\s*discountTotals,\s*session\s*\}\)/,
    );

    const tableCouponIndex = tableSnippet.indexOf(
      "await incrementCouponUsageOnce",
    );
    const tablePromotionIndex = tableSnippet.indexOf(
      "await incrementPromotionUsageOnce",
    );

    expect(tableCouponIndex).toBeGreaterThanOrEqual(0);
    expect(tablePromotionIndex).toBeGreaterThan(tableCouponIndex);

    const orderIdsCouponIndex = orderIdsSnippet.indexOf(
      "await incrementCouponUsageOnce",
    );
    const orderIdsPromotionIndex = orderIdsSnippet.indexOf(
      "await incrementPromotionUsageOnce",
    );

    expect(orderIdsCouponIndex).toBeGreaterThanOrEqual(0);
    expect(orderIdsPromotionIndex).toBeGreaterThan(orderIdsCouponIndex);
  });
  it("payment amount is backend source-of-truth when discount applies", () => {
    const src = readFile(PAYMENT_MUTATION_PATH);

    expect(src).toMatch(/resolvePaymentAmount/);
    expect(src).toMatch(
      /Payment amount does not match backend discounted total/,
    );
  });


  it("buildAppliedPromotionBreakdown uses appliedPromotionDetails for FREESHIP metadata", () => {
    const src = readFile(PAYMENT_MUTATION_PATH);

    expect(src).toMatch(/const appliedPromotionDetails = Array\.isArray\(discountTotals\?\.appliedPromotionDetails\)/);
    expect(src).toMatch(/promotionType \|\| "FREESHIP"/);
    expect(src).toMatch(/source:\s*"shipping"/);
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
describe("coupon redemption payment integration coverage", () => {
  it("resolves coupon redemption user from payable order customers", () => {
    const src = readFile(PAYMENT_MUTATION_PATH);

    expect(src).toMatch(/function resolveCouponRedemptionUserIdFromOrders/);
    expect(src).toMatch(
      /order\?\.userId\?\._id \|\| order\?\.userId\?\.id \|\| order\?\.userId/,
    );
    expect(src).toMatch(/userIdsByString\.set\(String\(userId\), userId\)/);
    expect(src).toMatch(/userIdsByString\.size === 1[\s\S]*: null/);
  });

  it("passes resolved customer user into discount calculation and redemption", () => {
    const src = readFile(PAYMENT_MUTATION_PATH);
    const tableSnippet = getFunctionSnippet(src, "payOrdersByTableId");
    const orderIdsSnippet = getFunctionSnippet(src, "payOrdersByOrderIds");

    expect(tableSnippet).toMatch(
      /const redemptionUserId = resolveCouponRedemptionUserIdFromOrders\(payOrders\)/,
    );
    expect(orderIdsSnippet).toMatch(
      /const redemptionUserId = resolveCouponRedemptionUserIdFromOrders\(orders\)/,
    );
    expect(tableSnippet).toMatch(/userId:\s*redemptionUserId/);
    expect(orderIdsSnippet).toMatch(/userId:\s*redemptionUserId/);
  });

  it("passes payment method and shared order type context to discount calculation", () => {
    const src = readFile(PAYMENT_MUTATION_PATH);
    const tableSnippet = getFunctionSnippet(src, "payOrdersByTableId");
    const orderIdsSnippet = getFunctionSnippet(src, "payOrdersByOrderIds");

    expect(src).toMatch(/function resolveSharedOrderType/);
    expect(src).toMatch(/orderType:\s*resolveSharedOrderType\(orders\)/);
    expect(tableSnippet).toMatch(/paymentMethod:\s*normMethod/);
    expect(orderIdsSnippet).toMatch(/paymentMethod:\s*normMethod/);
  });

  it("does not use POS actorId for coupon per-user enforcement", () => {
    const src = readFile(PAYMENT_MUTATION_PATH);
    const tableSnippet = getFunctionSnippet(src, "payOrdersByTableId");
    const orderIdsSnippet = getFunctionSnippet(src, "payOrdersByOrderIds");

    expect(tableSnippet).not.toMatch(/userId:\s*actorId/);
    expect(orderIdsSnippet).not.toMatch(/userId:\s*actorId/);
    expect(tableSnippet).toMatch(/"payment\.paidBy": actorId/);
    expect(orderIdsSnippet).toMatch(/"payment\.paidBy": actorId/);
  });

  it("documents null redemption user for walk-in or mixed-customer POS orders", () => {
    const src = readFile(PAYMENT_MUTATION_PATH);

    expect(src).toMatch(/if \(!userId\) continue/);
    expect(src).toMatch(/return userIdsByString\.size === 1[\s\S]*: null/);
    expect(src).toMatch(
      /if \(redemptionUserId\) \{[\s\S]*UserCoupon\.updateOne/,
    );
  });

  it("uses Coupon terminology for new per-user limit errors", () => {
    const src = readFile(PAYMENT_MUTATION_PATH);

    expect(src).toMatch(/Invalid coupon: per-user usage limit reached/);
    expect(src).not.toMatch(/Invalid voucher: per-user usage limit reached/);
  });

  it("records redemption after invoice creation and before promotion usage", () => {
    const src = readFile(PAYMENT_MUTATION_PATH);
    const tableSnippet = getFunctionSnippet(src, "payOrdersByTableId");
    const orderIdsSnippet = getFunctionSnippet(src, "payOrdersByOrderIds");

    expect(
      tableSnippet.indexOf("const invoice = await Invoice.create"),
    ).toBeLessThan(tableSnippet.indexOf("await incrementCouponUsageOnce"));
    expect(
      orderIdsSnippet.indexOf("const invoice = await Invoice.create"),
    ).toBeLessThan(orderIdsSnippet.indexOf("await incrementCouponUsageOnce"));
  });
});
