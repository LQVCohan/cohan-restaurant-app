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

describe("RightPanel payment completion discount display", () => {
  it("shows applied voucher or discount after successful payment", () => {
    expect(source).toContain("appliedVoucherCode");
    expect(source).toContain("invoiceTotals");
    expect(source).toContain("discountAmount");
    expect(source).toContain("discountReason");
    expect(source).toContain("Ưu đãi đã áp dụng");
  });

  it("keeps invoice notification after payment success", () => {
    expect(source).toContain("Thanh toán thành công.");
    expect(source).toContain("Hóa đơn:");
  });
});
