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
const rightPanelSource = read(
  "src/components/Dashboard_Manager/POS/components/pos/RightPanel.jsx",
);
const orderManagementSource = read("src/hooks/useOrderManagement.js");
const orderManagementLegacySource = read(
  "src/hooks/useOrderManagementLegacy.js",
);
const activePromotionsSource = read(
  "src/hooks/useActiveDiscountPromotions.js",
);
const discountDisplaySource = read("src/utils/discountDisplay.js");

describe("voucher promotion POS integration guards", () => {
  it("keeps dine-in payment using backend discount preview and payment-stage payload", () => {
    expect(paymentModalLegacySource).toContain("useDiscountPreview");
    expect(paymentModalLegacySource).toContain(
      "useActiveDiscountPromotions",
    );
    expect(paymentModalLegacySource).toContain("selectedPromotionIds");
    expect(paymentModalLegacySource).toContain(
      "buildDiscountPricingInput",
    );
    expect(paymentModalLegacySource).toContain(
      "pricing: paymentPricing",
    );
    expect(paymentModalLegacySource).toContain(
      "promotionIds: selectedPromotionIds",
    );
    expect(paymentModalLegacySource).toContain("confirmPayment({");

    expect(paymentModalLegacySource).not.toContain(
      "PAY_ORDERS_BY_TABLE_ID_WITH_TOTALS",
    );
    expect(paymentModalLegacySource).not.toContain(
      "executeDiscountedDineInPayment",
    );
  });

  it("keeps off-premise order save guarded by applied discount preview", () => {
    expect(rightPanelSource).toContain("useDiscountPreview");
    expect(rightPanelSource).toContain("useActiveDiscountPromotions");
    expect(rightPanelSource).toContain("selectedPromotionIds");
    expect(rightPanelSource).toContain("hasDiscountSelection");
    expect(rightPanelSource).toContain(
      "shouldBlockSaveForDiscount",
    );
    expect(rightPanelSource).toContain(
      "buildOrderDiscountPreviewInput",
    );
    expect(rightPanelSource).toContain(
      "promotionIds: selectedPromotionIds",
    );
  });

  it("keeps existing order payment mutations forwarding pricing and promotionIds", () => {
    expect(orderManagementLegacySource).toMatch(
      /pricing\s*(?:=\s*null)?\s*,/,
    );
    expect(orderManagementLegacySource).toMatch(
      /promotionIds\s*(?:=\s*\[\])?\s*,/,
    );
    expect(orderManagementLegacySource).toContain(
      "paymentInputExtras",
    );
    expect(orderManagementLegacySource).toContain(
      "...paymentInputExtras",
    );
    expect(orderManagementLegacySource).toContain("discountReason");
    expect(orderManagementLegacySource).toContain("voucherCode");
    expect(orderManagementLegacySource).toContain("promotionId");
    expect(orderManagementLegacySource).toContain("shippingFee");
  });

  it("adds partial batch selection without replacing the original all-table flow", () => {
    expect(paymentModalSource).toContain("groupItemsByBatch");
    expect(paymentModalSource).toContain(
      "setPartialTablePaymentSelection",
    );
    expect(paymentModalSource).toContain("isPartialPayment");
    expect(paymentModalSource).toContain("paidOrderIds");
    expect(paymentModalSource).toContain("remainingOrderIds");

    expect(orderManagementSource).toContain(
      "PAY_SELECTED_TABLE_ORDERS",
    );
    expect(orderManagementSource).toContain("payOrdersByOrderIds");
    expect(orderManagementSource).toContain(
      "return legacy.confirmPayment",
    );
  });

  it("keeps promotion selector source and discount labels user-facing", () => {
    expect(activePromotionsSource).toContain(
      "promotionsByRestaurant",
    );
    expect(activePromotionsSource).toContain("activeOnly: true");
    expect(activePromotionsSource).toContain(
      'scope === "order"',
    );
    expect(discountDisplaySource).toContain(
      "formatDiscountReasonLabel",
    );
    expect(discountDisplaySource).toContain("Coupon hợp lệ");
    expect(discountDisplaySource).toContain(
      "Chương trình khuyến mãi",
    );
  });
});
