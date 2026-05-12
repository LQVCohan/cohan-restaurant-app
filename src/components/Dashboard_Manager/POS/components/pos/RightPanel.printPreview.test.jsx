import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.resolve(
    process.cwd(),
    "src/components/Dashboard_Manager/POS/components/pos/RightPanel.jsx",
  ),
  "utf8",
);

describe("RightPanel temp print preview discount display", () => {
  it("includes payment totals in temp print preview", () => {
    expect(source).toContain("Tạm tính:");
    expect(source).toContain("Giảm giá:");
    expect(source).toContain("Phí phục vụ:");
    expect(source).toContain("Thuế:");
    expect(source).toContain("Tổng cần trả:");
  });

  it("includes voucher discount metadata when present", () => {
    expect(source).toContain("discountBreakdown?.voucherCode");
    expect(source).toContain("Coupon:");
    expect(source).toContain("discountBreakdown?.discountReason");
    expect(source).toContain("Ưu đãi:");
  });
});
expect(source).toContain("formatDiscountReasonLabel");
expect(source).toContain("discountReasonLabel");
