import { describe, expect, it } from "vitest";
import fs from "node:fs";

const SRC_PATH =
  "src/components/Customer/BookingDishesModal/OrderSummaryModal.jsx";

const readSource = () => fs.readFileSync(SRC_PATH, "utf8");

const getCreateCheckoutInputSnippet = (src) => {
  const match = src.match(/const input = \{[\s\S]*?\n      \};/);
  return match?.[0] || "";
};

describe("OrderSummaryModal discount integration", () => {
  it("uses shared discount preview helpers", () => {
    const src = readSource();

    expect(src).toMatch(/useDiscountPreview/);
    expect(src).toMatch(/buildOrderDiscountPreviewInput/);
    expect(src).toMatch(/buildDiscountPricingInput/);
    expect(src).toMatch(/mapCartItemToOrderItemInput/);
  });

  it("does not send client calculated discount totals in createCheckoutOrders pricing", () => {
    const src = readSource();
    const inputSnippet = getCreateCheckoutInputSnippet(src);

    expect(inputSnippet).toMatch(/buildDiscountPricingInput/);
    expect(inputSnippet).toMatch(/voucherCode/);
    expect(inputSnippet).toMatch(/promotionIds/);

    expect(inputSnippet).not.toMatch(/voucherDiscount/);
    expect(inputSnippet).not.toMatch(/promotionDiscount/);
    expect(inputSnippet).not.toMatch(/discountAmount/);
    expect(inputSnippet).not.toMatch(/finalTotal/);
    expect(inputSnippet).not.toMatch(/grandTotal/);
  });

  it("blocks stale coupon checkout when preview is required", () => {
    const src = readSource();

    expect(src).toMatch(/shouldBlockCheckoutForDiscount/);
    expect(src).toMatch(/Vui lòng áp dụng coupon hợp lệ trước khi đặt hàng/);
  });

  it("disables coupon preview for multi restaurant cart", () => {
    const src = readSource();

    expect(src).toMatch(/canPreviewDiscount/);
    expect(src).toMatch(/Voucher hiện chỉ áp dụng cho đơn thuộc một\s+nhà hàng\./);
  });
});
