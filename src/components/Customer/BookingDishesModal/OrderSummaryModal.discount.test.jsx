import { describe, expect, it } from "vitest";
import fs from "node:fs";

const SRC_PATH =
  "src/components/Customer/BookingDishesModal/OrderSummaryModal.jsx";

const readSource = () => fs.readFileSync(SRC_PATH, "utf8");

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

    expect(src).not.toMatch(/voucherDiscount:/);
    expect(src).not.toMatch(/promotionDiscount:/);
    expect(src).not.toMatch(/discountAmount:/);
    expect(src).not.toMatch(/finalTotal:/);
    expect(src).not.toMatch(/grandTotal:/);
  });

  it("blocks stale voucher checkout when preview is required", () => {
    const src = readSource();

    expect(src).toMatch(/shouldBlockCheckoutForDiscount/);
    expect(src).toMatch(/Vui lòng áp dụng voucher hợp lệ trước khi đặt hàng/);
  });

  it("disables voucher preview for multi-restaurant cart", () => {
    const src = readSource();

    expect(src).toMatch(/canPreviewDiscount/);
    expect(src).toMatch(/Voucher hiện chỉ áp dụng cho đơn thuộc một nhà hàng/);
  });
});
