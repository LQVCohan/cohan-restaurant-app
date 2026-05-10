import { describe, expect, it } from "vitest";
import fs from "node:fs";

const SRC = "src/components/Dashboard_Manager/POS/components/pos/RightPanel.jsx";

describe("RightPanel discount integration", () => {
  it("uses discount preview before off-premise save", () => {
    const src = fs.readFileSync(SRC, "utf8");

    expect(src).toMatch(/useDiscountPreview/);
    expect(src).toMatch(/buildOrderDiscountPreviewInput/);
    expect(src).toMatch(/handleApplyDiscountPreview/);
    expect(src).toMatch(/shouldBlockSaveForDiscount/);
  });

  it("passes only safe pricing and promotionIds to saveOrder", () => {
    const src = fs.readFileSync(SRC, "utf8");

    expect(src).toMatch(/saveOrder\?\.\(\{/);
    expect(src).toMatch(/pricing:/);
    expect(src).toMatch(/promotionIds:/);

    expect(src).not.toMatch(/voucherDiscount:/);
    expect(src).not.toMatch(/promotionDiscount:/);
    expect(src).not.toMatch(/finalTotal:/);
    expect(src).not.toMatch(/grandTotal:/);
    expect(src).not.toMatch(/discountAmount:/);
  });

  it("does not enable voucher preview for dine-in send-to-kitchen flow", () => {
    const src = fs.readFileSync(SRC, "utf8");

    expect(src).toMatch(/isOffPremise/);
    expect(src).toMatch(/Voucher cho bàn ăn sẽ áp dụng ở bước thanh toán/);
  });
});
