import { describe, expect, it } from "vitest";
import fs from "node:fs";

const SRC = "src/components/Dashboard_Manager/POS/components/pos/RightPanel.jsx";

const getSaveOrderCall = (src) => {
  const match = src.match(/const res = await saveOrder\?\.\(\{[\s\S]*?\n\s*\}\);/);
  return match?.[0] || "";
};

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
    const saveOrderCall = getSaveOrderCall(src);

    expect(saveOrderCall).toMatch(/saveOrder\?\.\(\{/);
    expect(saveOrderCall).toMatch(/pricing:/);
    expect(saveOrderCall).toMatch(/promotionIds:/);

    expect(saveOrderCall).not.toMatch(/voucherDiscount:/);
    expect(saveOrderCall).not.toMatch(/promotionDiscount:/);
    expect(saveOrderCall).not.toMatch(/finalTotal:/);
    expect(saveOrderCall).not.toMatch(/grandTotal:/);
    expect(saveOrderCall).not.toMatch(/discountAmount:/);
  });

  it("does not enable voucher preview for dine-in send-to-kitchen flow", () => {
    const src = fs.readFileSync(SRC, "utf8");

    expect(src).toMatch(/isOffPremise/);
    expect(src).toMatch(/Voucher cho bàn ăn sẽ áp dụng ở bước thanh toán/);
  });
});
