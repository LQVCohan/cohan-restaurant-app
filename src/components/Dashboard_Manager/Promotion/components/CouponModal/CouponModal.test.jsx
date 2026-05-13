import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.resolve(
    process.cwd(),
    "src/components/Dashboard_Manager/Promotion/components/CouponModal/CouponModal.jsx",
  ),
  "utf8",
);

describe("Coupon modal stacking config", () => {
  it("exposes coupon stacking controls", () => {
    expect(source).toContain("Cấu hình dùng chồng");
    expect(source).toContain('name="stackable"');
    expect(source).toContain('name="combinableWithPromotions"');
    expect(source).toContain('name="exclusive"');
    expect(source).toContain('name="priority"');
  });

  it("submits stacking fields", () => {
    expect(source).toContain("stackable: Boolean(formData.stackable)");
    expect(source).toContain(
      "combinableWithPromotions: Boolean(formData.combinableWithPromotions)",
    );
    expect(source).toContain("exclusive: Boolean(formData.exclusive)");
    expect(source).toContain("priority: formData.priority");
  });
});
