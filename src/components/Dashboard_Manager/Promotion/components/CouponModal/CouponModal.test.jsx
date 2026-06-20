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

  it("initializes advanced eligibility fields when editing an existing Coupon", () => {
    expect(source).toContain("perUserLimit:");
    expect(source).toContain("coupon?.perUserLimit");
    expect(source).toContain("orderTypes: toArray(coupon?.orderTypes)");
    expect(source).toContain("paymentMethods: toArray(coupon?.paymentMethods)");
    expect(source).toContain("firstOrderOnly: Boolean(coupon?.firstOrderOnly)");
  });

  it("submits advanced eligibility fields", () => {
    expect(source).toContain('name="perUserLimit"');
    expect(source).toContain('name="orderTypes"');
    expect(source).toContain('name="paymentMethods"');
    expect(source).toContain('name="firstOrderOnly"');
    expect(source).toContain("perUserLimit: formData.perUserLimit");
    expect(source).toContain("orderTypes: toArray(formData.orderTypes)");
    expect(source).toContain(
      "paymentMethods: toArray(formData.paymentMethods)",
    );
    expect(source).toContain(
      "firstOrderOnly: Boolean(formData.firstOrderOnly)",
    );
  });

  it("exposes category scope controls for coupon item categories", () => {
    expect(source).toContain("Phạm vi danh mục áp dụng");
    expect(source).toContain('name="categoryScope"');
    expect(source).toContain("Chỉ danh mục được chọn");
    expect(source).toContain("Vui lòng chọn ít nhất một danh mục áp dụng.");
    expect(source).toContain("categoryIds: selectedIds");
    expect(source).toContain("categories: selectedNames");
  });

});
