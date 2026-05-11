import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import process from "node:process";
const paymentModalPath = path.resolve(
  process.cwd(),
  "src/components/Dashboard_Manager/POS/components/modals/PaymentModal.jsx",
);
const orderManagementPath = path.resolve(
  process.cwd(),
  "src/hooks/useOrderManagement.js",
);

const paymentModalSource = fs.readFileSync(paymentModalPath, "utf8");
const orderManagementSource = fs.readFileSync(orderManagementPath, "utf8");

describe("PaymentModal voucher payment flow", () => {
  it("forwards payment-stage pricing and promotionIds through useOrderManagement", () => {
    const src = fs.readFileSync("src/hooks/useOrderManagement.js", "utf8");

    expect(src).toMatch(/pricing\s*(?:=\s*null)?\s*,/);
    expect(src).toMatch(/promotionIds\s*(?:=\s*\[\])?\s*,/);
    expect(src).toMatch(/paymentInputExtras/);
    expect(src).toMatch(/\.\.\.paymentInputExtras/);

    expect(src).toMatch(/discountReason/);
    expect(src).toMatch(/voucherCode/);
    expect(src).toMatch(/promotionId/);
    expect(src).toMatch(/shippingFee/);
  });
  it("keeps voucher preview helpers and routes payment through confirmPayment", () => {
    expect(paymentModalSource).toContain("useDiscountPreview");
    expect(paymentModalSource).toContain("buildOrderDiscountPreviewInput");
    expect(paymentModalSource).toContain("buildDiscountPricingInput");
    expect(paymentModalSource).toContain("getDiscountBreakdownTotal");
    expect(paymentModalSource).not.toContain(
      "PAY_ORDERS_BY_TABLE_ID_WITH_TOTALS",
    );
    expect(paymentModalSource).not.toContain(
      "useMutation(PAY_ORDERS_BY_TABLE_ID_WITH_TOTALS)",
    );
    expect(paymentModalSource).not.toContain(
      "mutation PayOrdersByTableIdWithTotals",
    );
    expect(paymentModalSource).not.toContain("executeDiscountedDineInPayment");
    expect(paymentModalSource).toContain("confirmPayment({");
    expect(paymentModalSource).toContain("pricing: paymentPricing");
    expect(paymentModalSource).toContain("promotionIds: selectedPromotionIds");
    expect(paymentModalSource).toContain(
      "paidAmount: Number(payableTotalVnd || 0)",
    );
    expect(paymentModalSource).toContain("discountBlocksPayment");
    expect(paymentModalSource).toContain("discountNeedsReapply");
    expect(paymentModalSource).toContain(
      "Vui lòng áp dụng voucher hợp lệ trước khi xác nhận thanh toán.",
    );
  });
});

describe("useOrderManagement payment mutation payload", () => {
  it("accepts pricing and promotionIds and requests richer invoice totals", () => {
    expect(orderManagementSource).toMatch(/pricing\s*(?:=\s*null)?\s*,/);
    expect(orderManagementSource).toContain("promotionIds = []");
    expect(orderManagementSource).toContain("...(pricing ? { pricing } : {})");
    expect(orderManagementSource).toContain(
      "...(Array.isArray(promotionIds) && promotionIds.length",
    );
    expect(orderManagementSource).toContain("discountReason");
    expect(orderManagementSource).toContain("voucherCode");
    expect(orderManagementSource).toContain("promotionId");
    expect(orderManagementSource).toContain("shippingFee");
  });
});
