import { describe, expect, it } from "vitest";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

const ORDER_SCHEMA_PATH = "graphql/schema/order.graphql";
const ORDER_MUTATION_PATH = "graphql/resolvers/order/mutation.js";
const ORDER_QUERY_PATH = "graphql/resolvers/order/query.js";

const DISCOUNT_TOTAL_FIELD_PATTERNS = [
  /pricing\??\.promotionDiscount/,
  /pricing\??\.voucherDiscount/,
  /pricing\??\.discountAmount/,
  /pricing\??\.finalTotal/,
  /pricing\??\.grandTotal/,
  /input\??\.pricing\??\.promotionDiscount/,
  /input\??\.pricing\??\.voucherDiscount/,
  /input\??\.pricing\??\.discountAmount/,
  /input\??\.pricing\??\.finalTotal/,
  /input\??\.pricing\??\.grandTotal/,
];

describe("order discount business safety", () => {
  describe("order mutation discount source-of-truth", () => {
    it("uses centralized discount service and does not use legacy voucher helper", () => {
      const src = read(ORDER_MUTATION_PATH);

      expect(src).toMatch(/calculateDiscountBreakdown/);
      expect(src).not.toMatch(/resolveVoucherDiscount\(/);
    });

    it("defines safe pricing and promotion id normalizers", () => {
      const src = read(ORDER_MUTATION_PATH);

      expect(src).toMatch(/function normalizeVoucherCode/);
      expect(src).toMatch(/function buildDiscountPricing/);
      expect(src).toMatch(/function normalizePromotionIds/);

      expect(src).toMatch(
        /voucherCode:\s*normalizeVoucherCode\(pricing\??\.voucherCode\)/,
      );
      expect(src).toMatch(/serviceRate/);
      expect(src).toMatch(/taxRate/);
      expect(src).toMatch(/shippingFee/);
    });

    it("does not trust client-provided discount totals in mutation runtime paths", () => {
      const src = read(ORDER_MUTATION_PATH);

      for (const pattern of DISCOUNT_TOTAL_FIELD_PATTERNS) {
        expect(src).not.toMatch(pattern);
      }
    });

    it("keeps base total helper from applying client discount values", () => {
      const src = read(ORDER_MUTATION_PATH);

      const helperStart = src.indexOf(
        "function computeTotalsFromHydratedItems",
      );
      expect(helperStart).toBeGreaterThanOrEqual(0);

      const helperEnd = src.indexOf("\nasync function", helperStart);
      const helperSrc =
        helperEnd > helperStart
          ? src.slice(helperStart, helperEnd)
          : src.slice(helperStart);

      expect(helperSrc).toMatch(/const discount\s*=\s*0/);
      expect(helperSrc).not.toMatch(/promotionDiscount/);
      expect(helperSrc).not.toMatch(/voucherDiscount/);
      expect(helperSrc).not.toMatch(/discountAmount/);
      expect(helperSrc).not.toMatch(/finalTotal/);
      expect(helperSrc).not.toMatch(/grandTotal/);
    });

    it("centralizes coupon usage increment with maxUsage guard", () => {
      const src = read(ORDER_MUTATION_PATH);

      expect(src).toMatch(/async function incrementCouponUsageOnce/);
      expect(src).toMatch(/Coupon\.updateOne/);
      expect(src).toMatch(/\$inc:\s*\{\s*used:\s*1\s*\}/);
      expect(src).toMatch(/\$lt:\s*\[\s*"\$used"\s*,\s*"\$maxUsage"\s*\]/);
      expect(src).toMatch(/\$lte:\s*\[\s*"\$maxUsage"\s*,\s*0\s*\]/);
      expect(src).toMatch(/Invalid voucher: usage limit reached/);
    });

    it("calls coupon usage increment only through the centralized helper", () => {
      const src = read(ORDER_MUTATION_PATH);

      const updateOneCount = (src.match(/Coupon\.updateOne/g) || []).length;
      const incCount = (src.match(/\$inc:\s*\{\s*used:\s*1\s*\}/g) || [])
        .length;
      const helperCallCount = (
        src.match(
          /await incrementCouponUsageOnce\(\{\s*totals,\s*session\s*\}\)/g,
        ) || []
      ).length;

      expect(updateOneCount).toBe(1);
      expect(incCount).toBe(1);
      expect(helperCallCount).toBeGreaterThanOrEqual(1);
    });

    it("passes sanitized pricing and promotionIds into createOffPremiseOrder discount calculation", () => {
      const src = read(ORDER_MUTATION_PATH);

      expect(src).toMatch(/createOffPremiseOrder/);
      expect(src).toMatch(/promotionIds/);
      expect(src).toMatch(/pricing:\s*buildDiscountPricing\(pricing\)/);
      expect(src).toMatch(
        /promotionIds:\s*normalizePromotionIds\(promotionIds\)/,
      );
    });

    it("forwards promotionIds from createStaffRemoteOrder to createOffPremiseOrder", () => {
      const src = read(ORDER_MUTATION_PATH);

      const staffRemoteStart = src.indexOf("createStaffRemoteOrder");
      expect(staffRemoteStart).toBeGreaterThanOrEqual(0);

      const staffRemoteSrc = src.slice(
        staffRemoteStart,
        staffRemoteStart + 6000,
      );

      expect(staffRemoteSrc).toMatch(/promotionIds/);
      expect(staffRemoteSrc).toMatch(/createOffPremiseOrder/);
    });

    it("calculates checkout order totals with discount service instead of manually trusting pricing", () => {
      const src = read(ORDER_MUTATION_PATH);

      const checkoutStart = src.indexOf("createCheckoutOrders");
      expect(checkoutStart).toBeGreaterThanOrEqual(0);

      const checkoutSrc = src.slice(checkoutStart);

      expect(checkoutSrc).toMatch(/const checkoutTotals\s*=\s*\{/);
      expect(checkoutSrc).toMatch(/groupShippingFee/);
      expect(checkoutSrc).toMatch(
        /const groupPricing\s*=\s*buildDiscountPricing/,
      );
      expect(checkoutSrc).toMatch(/calculateDiscountBreakdown\(\{/);
      expect(checkoutSrc).toMatch(
        /promotionIds:\s*normalizePromotionIds\(promotionIds\)/,
      );
      expect(checkoutSrc).toMatch(
        /checkoutTotals\.promotionDiscount\s*\+=\s*Number\(totals\.promotionDiscount/,
      );
      expect(checkoutSrc).toMatch(
        /checkoutTotals\.voucherDiscount\s*\+=\s*Number\(totals\.voucherDiscount/,
      );
      expect(checkoutSrc).toMatch(/totals:\s*checkoutTotals/);
    });

    it("does not manually rewrite totals grandTotal after discount calculation in checkout flow", () => {
      const src = read(ORDER_MUTATION_PATH);

      const checkoutStart = src.indexOf("createCheckoutOrders");
      expect(checkoutStart).toBeGreaterThanOrEqual(0);

      const checkoutSrc = src.slice(checkoutStart);

      expect(checkoutSrc).not.toMatch(/totals\.grandTotal\s*=\s*Math\.round/);
      expect(checkoutSrc).not.toMatch(
        /totals\.shippingFee\s*=\s*shippingObj\.shippingFee/,
      );
    });

    it("recalculates adjusted order item totals through discount service and does not increment coupon usage", () => {
      const src = read(ORDER_MUTATION_PATH);

      const adjustStart = src.indexOf("adjustOrderItemQuantity");
      expect(adjustStart).toBeGreaterThanOrEqual(0);

      const adjustSrc = src.slice(adjustStart, adjustStart + 9000);

      expect(adjustSrc).toMatch(/calculateDiscountBreakdown\(\{/);
      expect(adjustSrc).toMatch(/pricing:\s*buildDiscountPricing\(\{/);
      expect(adjustSrc).toMatch(
        /voucherCode:\s*order\??\.totals\??\.voucherCode/,
      );
      expect(adjustSrc).toMatch(
        /promotionIds:\s*order\??\.totals\??\.promotionId/,
      );
      expect(adjustSrc).not.toMatch(
        /promotionDiscount:\s*order\??\.totals\??\.promotionDiscount/,
      );
      expect(adjustSrc).not.toMatch(
        /voucherDiscount:\s*order\??\.totals\??\.voucherDiscount/,
      );
      expect(adjustSrc).not.toMatch(/incrementCouponUsageOnce/);
    });

    it("persists order totals from centralized totals fields", () => {
      const src = read(ORDER_MUTATION_PATH);

      expect(src).toMatch(/subtotal:\s*totals\.subtotal/);
      expect(src).toMatch(/discount:\s*totals\.discount/);
      expect(src).toMatch(/discountReason:\s*totals\.discountReason/);
      expect(src).toMatch(/voucherCode:\s*totals\.voucherCode/);
      expect(src).toMatch(/promotionId:\s*totals\.appliedPromotions\?\.\[0\]/);
      expect(src).toMatch(/service:\s*totals\.service/);
      expect(src).toMatch(/tax:\s*totals\.tax/);
      expect(src).toMatch(/shippingFee:\s*totals\.shippingFee/);
      expect(src).toMatch(/grandTotal:\s*totals\.grandTotal/);
    });
  });

  describe("order discount preview schema", () => {
    it("exposes DiscountBreakdown and PreviewOrderDiscountInput", () => {
      const schema = read(ORDER_SCHEMA_PATH);

      expect(schema).toMatch(/type DiscountBreakdown\s*\{/);
      expect(schema).toMatch(/input PreviewOrderDiscountInput\s*\{/);
      expect(schema).toMatch(
        /previewOrderDiscount\(input:\s*PreviewOrderDiscountInput!\):\s*DiscountBreakdown!/,
      );
    });

    it("includes promotionIds on preview and order creation inputs", () => {
      const schema = read(ORDER_SCHEMA_PATH);

      expect(schema).toMatch(
        /input PreviewOrderDiscountInput[\s\S]*promotionIds:\s*\[ID!\]/,
      );
      expect(schema).toMatch(
        /input CreateOffPremiseOrderInput[\s\S]*promotionIds:\s*\[ID!\]/,
      );
      expect(schema).toMatch(
        /input CreateStaffRemoteOrderInput[\s\S]*promotionIds:\s*\[ID!\]/,
      );
      expect(schema).toMatch(
        /input CreateCheckoutOrdersInput[\s\S]*promotionIds:\s*\[ID!\]/,
      );
    });

    it("keeps legacy pricing discount fields in schema only for backward compatibility", () => {
      const schema = read(ORDER_SCHEMA_PATH);

      expect(schema).toMatch(/input CheckoutPricingInput\s*\{/);
      expect(schema).toMatch(/promotionDiscount:\s*Int/);
      expect(schema).toMatch(/voucherDiscount:\s*Int/);
      expect(schema).toMatch(/voucherCode:\s*String/);
    });
  });

  describe("order discount preview resolver safety", () => {
    it("implements previewOrderDiscount in OrderQuery", () => {
      const src = read(ORDER_QUERY_PATH);

      expect(src).toMatch(/previewOrderDiscount/);
      expect(src).toMatch(/calculateDiscountBreakdown/);
    });
    it("uses shared priced order item helper instead of fallback preview item pricing", () => {
      const src = read(ORDER_QUERY_PATH);

      const previewStart = src.indexOf("previewOrderDiscount");
      expect(previewStart).toBeGreaterThanOrEqual(0);

      const previewSrc = src.slice(previewStart, previewStart + 5000);

      expect(previewSrc).toMatch(/buildPricedOrderItems/);
      expect(src).not.toMatch(/function buildPreviewItems/);
    });
    it("enforces restaurant access before preview item pricing and discount calculation", () => {
      const src = read(ORDER_QUERY_PATH);

      const previewStart = src.indexOf("previewOrderDiscount");
      expect(previewStart).toBeGreaterThanOrEqual(0);

      const previewSrc = src.slice(previewStart, previewStart + 5000);

      const accessIndex = previewSrc.indexOf("requireQueryRestaurantAccess");
      const pricingIndex = previewSrc.indexOf("buildPricedOrderItems");
      const discountIndex = previewSrc.indexOf("calculateDiscountBreakdown");

      expect(previewSrc).toMatch(
        /const rid\s*=\s*await requireQueryRestaurantAccess\(ctx,\s*restaurantId\)/,
      );

      expect(accessIndex).toBeGreaterThanOrEqual(0);
      expect(pricingIndex).toBeGreaterThanOrEqual(0);
      expect(discountIndex).toBeGreaterThanOrEqual(0);

      expect(accessIndex).toBeLessThan(pricingIndex);
      expect(accessIndex).toBeLessThan(discountIndex);
    });

    it("does not mutate coupon usage or create orders in preview", () => {
      const src = read(ORDER_QUERY_PATH);

      const previewStart = src.indexOf("previewOrderDiscount");
      expect(previewStart).toBeGreaterThanOrEqual(0);

      const previewSrc = src.slice(previewStart, previewStart + 5000);

      expect(previewSrc).not.toMatch(/Coupon\.updateOne/);
      expect(previewSrc).not.toMatch(/Order\.create/);
      expect(previewSrc).not.toMatch(/CheckoutSession\.create/);
      expect(previewSrc).not.toMatch(/WalletTransaction\.create/);
      expect(previewSrc).not.toMatch(/Payment\.create/);
    });

    it("does not pass client-provided discount totals into preview calculation", () => {
      const src = read(ORDER_QUERY_PATH);

      const previewStart = src.indexOf("previewOrderDiscount");
      expect(previewStart).toBeGreaterThanOrEqual(0);

      const previewSrc = src.slice(previewStart, previewStart + 5000);

      for (const pattern of DISCOUNT_TOTAL_FIELD_PATTERNS) {
        expect(previewSrc).not.toMatch(pattern);
      }
    });

    it("passes only safe pricing fields and promotionIds into preview calculation", () => {
      const src = read(ORDER_QUERY_PATH);

      const previewStart = src.indexOf("previewOrderDiscount");
      expect(previewStart).toBeGreaterThanOrEqual(0);

      const previewSrc = src.slice(previewStart, previewStart + 5000);

      expect(previewSrc).toMatch(/serviceRate:\s*pricing\??\.serviceRate/);
      expect(previewSrc).toMatch(/taxRate:\s*pricing\??\.taxRate/);
      expect(previewSrc).toMatch(/shippingFee:\s*pricing\??\.shippingFee/);
      expect(previewSrc).toMatch(/voucherCode:\s*pricing\??\.voucherCode/);
      expect(previewSrc).toMatch(
        /promotionIds:\s*Array\.isArray\(promotionIds\)\s*\?\s*promotionIds\s*:\s*\[\]/,
      );
    });

    it("uses priced/hydrated items for preview when shared pricing helper is available", () => {
      const src = read(ORDER_QUERY_PATH);

      const hasSharedPricingHelper =
        /buildPricedOrderItems/.test(src) || /hydrateOrderItems/.test(src);

      const hasFallbackPreviewBuilder = /buildPreviewItems/.test(src);

      expect(hasSharedPricingHelper || hasFallbackPreviewBuilder).toBe(true);
    });
  });
});
