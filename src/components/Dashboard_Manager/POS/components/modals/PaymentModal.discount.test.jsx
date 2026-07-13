import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { describe, expect, it } from "vitest";

const read = (relativePath) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

const paymentModalSource = read(
  "src/components/Dashboard_Manager/POS/components/modals/PaymentModal.jsx",
);
const paymentModalLegacySource = read(
  "src/components/Dashboard_Manager/POS/components/modals/PaymentModalLegacy.jsx",
);
const paymentModalStylesSource = read(
  "src/components/Dashboard_Manager/POS/components/modals/PaymentModal.module.scss",
);
const partialPaymentStylesSource = read(
  "src/components/Dashboard_Manager/POS/components/modals/PartialTablePayment.scss",
);
const orderManagementSource = read("src/hooks/useOrderManagement.js");
const orderManagementLegacySource = read(
  "src/hooks/useOrderManagementLegacy.js",
);

describe("PaymentModal voucher payment flow", () => {
  it("keeps voucher preview helpers and the existing payment-stage flow", () => {
    expect(paymentModalLegacySource).toContain("useDiscountPreview");
    expect(paymentModalLegacySource).toContain(
      "buildOrderDiscountPreviewInput",
    );
    expect(paymentModalLegacySource).toContain("buildDiscountPricingInput");
    expect(paymentModalLegacySource).toContain("getDiscountBreakdownTotal");
    expect(paymentModalLegacySource).toContain("formatDiscountReasonLabel");
    expect(paymentModalLegacySource).toContain("confirmPayment({");
    expect(paymentModalLegacySource).toContain("pricing: paymentPricing");
    expect(paymentModalLegacySource).toContain(
      "promotionIds: selectedPromotionIds",
    );

    expect(paymentModalLegacySource).not.toContain(
      "PAY_ORDERS_BY_TABLE_ID_WITH_TOTALS",
    );
    expect(paymentModalLegacySource).not.toContain(
      "executeDiscountedDineInPayment",
    );
  });

  it("allows selecting an active promotion in the legacy payment body", () => {
    expect(paymentModalLegacySource).toContain(
      "useActiveDiscountPromotions",
    );
    expect(paymentModalLegacySource).toContain("activePromotions");
    expect(paymentModalLegacySource).toContain("selectedPromotionId");
    expect(paymentModalLegacySource).toContain(
      "Chương trình khuyến mãi",
    );
    expect(paymentModalLegacySource).toContain(
      "setSelectedPromotionIds",
    );
  });

  it("keeps the line-level promotion breakdown block and styles", () => {
    expect(paymentModalLegacySource).toContain("promotionLineItems");
    expect(paymentModalLegacySource).toContain(
      "discountBreakdown?.promotionLines",
    );
    expect(paymentModalLegacySource).toContain("Ưu đãi theo món");
    expect(paymentModalStylesSource).toContain(
      ".linePromotionBreakdown",
    );
    expect(paymentModalStylesSource).toContain(".linePromotionTitle");
    expect(paymentModalStylesSource).toContain(".linePromotionRow");
  });
});

describe("partial table payment batches", () => {
  it("defaults to every batch and filters the legacy modal when partially selected", () => {
    expect(paymentModalSource).toContain("PaymentModalLegacy");
    expect(paymentModalSource).toContain("groupItemsByBatch");
    expect(paymentModalSource).toContain(
      "setSelectedOrderIds(allOrderIds)",
    );
    expect(paymentModalSource).toContain("selectedOrderIds");
    expect(paymentModalSource).toContain("selectedItems");
    expect(paymentModalSource).toContain(
      "totalAmount={selectedTotalAmount}",
    );
    expect(paymentModalSource).toContain("Đợt gọi món");
    expect(partialPaymentStylesSource).toContain(
      ".partial-table-payment-panel",
    );
  });

  it("routes only a partial selection to payOrdersByOrderIds and keeps the all-table fallback", () => {
    expect(orderManagementSource).toContain(
      "useOrderManagementLegacy",
    );
    expect(orderManagementSource).toContain(
      "PAY_SELECTED_TABLE_ORDERS",
    );
    expect(orderManagementSource).toContain("payOrdersByOrderIds");
    expect(orderManagementSource).toContain(
      "getPartialTablePaymentSelection",
    );
    expect(orderManagementSource).toContain(
      "return legacy.confirmPayment",
    );
    expect(orderManagementSource).toContain(
      "return legacy.resolvePayableOrderIds",
    );
  });

  it("preserves payment pricing and promotion metadata in both payment paths", () => {
    expect(orderManagementLegacySource).toMatch(
      /pricing\s*(?:=\s*null)?\s*,/,
    );
    expect(orderManagementLegacySource).toMatch(
      /promotionIds\s*(?:=\s*\[\])?\s*,/,
    );
    expect(orderManagementLegacySource).toContain(
      "paymentInputExtras",
    );
    expect(orderManagementSource).toContain(
      "...(pricing ? { pricing } : {})",
    );
    expect(orderManagementSource).toContain(
      "promotionIds: normalizedPromotionIds",
    );
  });
});
