import { describe, expect, it } from "vitest";
import fs from "node:fs";

const SRC_PATH =
  "src/components/Customer/BookingDishesModal/OrderSummaryModal.jsx";

const readSource = () => fs.readFileSync(SRC_PATH, "utf8");

const getCheckoutInputSource = (src) => {
  const persistStart = src.indexOf("const persistAllOrders = useCallback(");
  expect(persistStart).toBeGreaterThanOrEqual(0);

  const inputStart = src.indexOf("const input = {", persistStart);
  expect(inputStart).toBeGreaterThan(persistStart);

  const submitStart = src.indexOf("createCheckoutOrders({", inputStart);
  expect(submitStart).toBeGreaterThan(inputStart);

  return src.slice(inputStart, submitStart);
};

describe("OrderSummaryModal discount integration", () => {
  it("uses shared discount preview helpers", () => {
    const src = readSource();

    expect(src).toMatch(/useDiscountPreview/);
    expect(src).toMatch(/buildOrderDiscountPreviewInput/);
    expect(src).toMatch(/buildDiscountPricingInput/);
    expect(src).toMatch(/mapCartItemToOrderItemInput/);
  });

  it("does not send client-calculated discount totals in createCheckoutOrders pricing", () => {
    const src = readSource();
    const checkoutInputSrc = getCheckoutInputSource(src);

    expect(src).toMatch(/createCheckoutOrders\(\{\s*variables:\s*\{\s*input\s*\}/);
    expect(checkoutInputSrc).toMatch(/pricing:\s*buildDiscountPricingInput\(\{/);
    expect(checkoutInputSrc).toMatch(/promotionIds:/);
    expect(checkoutInputSrc).not.toMatch(/voucherDiscount:/);
    expect(checkoutInputSrc).not.toMatch(/promotionDiscount:/);
    expect(checkoutInputSrc).not.toMatch(/discountAmount:/);
    expect(checkoutInputSrc).not.toMatch(/finalTotal:/);
    expect(checkoutInputSrc).not.toMatch(/grandTotal:/);
  });

  it("blocks stale voucher checkout when preview is required", () => {
    const src = readSource();

    expect(src).toMatch(/shouldBlockCheckoutForDiscount/);
    expect(src).toMatch(/Vui lòng áp dụng voucher hợp lệ trước khi đặt hàng/);
  });

  it("disables voucher preview for multi-restaurant cart", () => {
    const src = readSource();

    expect(src).toMatch(/canPreviewDiscount/);
    expect(src).toMatch(
      /Voucher hiện chỉ(?:\s+hỗ trợ)?\s+áp dụng cho đơn thuộc một\s+nhà hàng/,
    );
  });
});
