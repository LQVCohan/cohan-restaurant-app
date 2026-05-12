import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { describe, expect, it } from "vitest";

const paymentModalPath = path.resolve(
  process.cwd(),
  "src/components/Dashboard_Manager/POS/components/modals/PaymentModal.jsx",
);

const paymentModalStylesPath = path.resolve(
  process.cwd(),
  "src/components/Dashboard_Manager/POS/components/modals/PaymentModal.module.scss",
);

const orderManagementPath = path.resolve(
  process.cwd(),
  "src/hooks/useOrderManagement.js",
);

const paymentModalSource = fs.readFileSync(paymentModalPath, "utf8");
const paymentModalStylesSource = fs.readFileSync(
  paymentModalStylesPath,
  "utf8",
);
const orderManagementSource = fs.readFileSync(orderManagementPath, "utf8");

describe("PaymentModal voucher payment flow", () => {
  it("forwards payment-stage pricing and promotionIds through useOrderManagement", () => {
    expect(orderManagementSource).toMatch(/pricing\s*(?:=\s*null)?\s*,/);
    expect(orderManagementSource).toMatch(/promotionIds\s*(?:=\s*\[\])?\s*,/);
    expect(orderManagementSource).toMatch(/paymentInputExtras/);
    expect(orderManagementSource).toMatch(/\.\.\.paymentInputExtras/);

    expect(orderManagementSource).toMatch(/discountReason/);
    expect(orderManagementSource).toMatch(/voucherCode/);
    expect(orderManagementSource).toMatch(/promotionId/);
    expect(orderManagementSource).toMatch(/shippingFee/);
  });

  it("keeps voucher preview helpers and routes payment through confirmPayment", () => {
    expect(paymentModalSource).toContain("useDiscountPreview");
    expect(paymentModalSource).toContain("buildOrderDiscountPreviewInput");
    expect(paymentModalSource).toContain("buildDiscountPricingInput");
    expect(paymentModalSource).toContain("getDiscountBreakdownTotal");
    expect(paymentModalSource).toContain("formatDiscountReasonLabel");

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

  it("allows selecting an active promotion in the payment modal", () => {
    expect(paymentModalSource).toContain("useActiveDiscountPromotions");
    expect(paymentModalSource).toContain("activePromotions");
    expect(paymentModalSource).toContain("selectedPromotionId");
    expect(paymentModalSource).toContain("Chương trình khuyến mãi");
    expect(paymentModalSource).toContain("setSelectedPromotionIds");
  });

  it("keeps the line-level promotion breakdown block and styles", () => {
    expect(paymentModalSource).toContain("promotionLineItems");
    expect(paymentModalSource).toContain("discountBreakdown?.promotionLines");
    expect(paymentModalSource).toContain("Ưu đãi theo món");
    expect(paymentModalSource).toContain("Món áp dụng");
    expect(paymentModalSource).toContain("Khuyến mãi");

    expect(paymentModalStylesSource).toContain(".linePromotionBreakdown");
    expect(paymentModalStylesSource).toContain(".linePromotionTitle");
    expect(paymentModalStylesSource).toContain(".linePromotionRow");
  });
});

describe("useOrderManagement payment mutation payload", () => {
  it("accepts pricing and promotionIds and requests richer invoice totals", () => {
    expect(orderManagementSource).toMatch(/pricing\s*(?:=\s*null)?\s*,/);
    expect(orderManagementSource).toMatch(/promotionIds\s*(?:=\s*\[\])?\s*,/);
    expect(orderManagementSource).toMatch(/paymentInputExtras/);
    expect(orderManagementSource).toMatch(/\.\.\.paymentInputExtras/);

    expect(orderManagementSource).toMatch(/discountReason/);
    expect(orderManagementSource).toMatch(/voucherCode/);
    expect(orderManagementSource).toMatch(/promotionId/);
    expect(orderManagementSource).toMatch(/shippingFee/);
  });
});
