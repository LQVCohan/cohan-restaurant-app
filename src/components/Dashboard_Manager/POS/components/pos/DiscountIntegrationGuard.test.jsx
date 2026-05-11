import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { describe, expect, it } from "vitest";

const read = (relativePath) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

const paymentModalSource = read(
  "src/components/Dashboard_Manager/POS/components/modals/PaymentModal.jsx",
);
const rightPanelSource = read(
  "src/components/Dashboard_Manager/POS/components/pos/RightPanel.jsx",
);
const orderManagementSource = read("src/hooks/useOrderManagement.js");
const activePromotionsSource = read("src/hooks/useActiveDiscountPromotions.js");
const discountDisplaySource = read("src/utils/discountDisplay.js");

describe("voucher promotion POS integration guards", () => {
  it("keeps dine-in payment using backend discount preview and payment-stage payload", () => {
    expect(paymentModalSource).toContain("useDiscountPreview");
    expect(paymentModalSource).toContain("useActiveDiscountPromotions");
    expect(paymentModalSource).toContain("selectedPromotionIds");
    expect(paymentModalSource).toContain("buildDiscountPricingInput");
    expect(paymentModalSource).toContain("pricing: paymentPricing");
    expect(paymentModalSource).toContain("promotionIds: selectedPromotionIds");
    expect(paymentModalSource).toContain("confirmPayment({");

    expect(paymentModalSource).not.toContain(
      "PAY_ORDERS_BY_TABLE_ID_WITH_TOTALS",
    );
    expect(paymentModalSource).not.toContain("executeDiscountedDineInPayment");
  });

  it("keeps off-premise order save guarded by applied discount preview", () => {
    expect(rightPanelSource).toContain("useDiscountPreview");
    expect(rightPanelSource).toContain("useActiveDiscountPromotions");
    expect(rightPanelSource).toContain("selectedPromotionIds");
    expect(rightPanelSource).toContain("hasDiscountSelection");
    expect(rightPanelSource).toContain("shouldBlockSaveForDiscount");
    expect(rightPanelSource).toContain("buildOrderDiscountPreviewInput");
    expect(rightPanelSource).toContain("promotionIds: selectedPromotionIds");
  });

  it("keeps order payment mutations forwarding pricing and promotionIds", () => {
    expect(orderManagementSource).toMatch(/pricing\s*(?:=\s*null)?\s*,/);
    expect(orderManagementSource).toMatch(/promotionIds\s*(?:=\s*\[\])?\s*,/);
    expect(orderManagementSource).toContain("paymentInputExtras");
    expect(orderManagementSource).toContain("...paymentInputExtras");
    expect(orderManagementSource).toContain("discountReason");
    expect(orderManagementSource).toContain("voucherCode");
    expect(orderManagementSource).toContain("promotionId");
    expect(orderManagementSource).toContain("shippingFee");
  });

  it("keeps promotion selector source and discount labels user-facing", () => {
    expect(activePromotionsSource).toContain("promotionsByRestaurant");
    expect(activePromotionsSource).toContain("activeOnly: true");
    expect(activePromotionsSource).toContain('scope === "order"');
    expect(discountDisplaySource).toContain("formatDiscountReasonLabel");
    expect(discountDisplaySource).toContain("Voucher hợp lệ");
    expect(discountDisplaySource).toContain("Chương trình khuyến mãi");
  });
});
