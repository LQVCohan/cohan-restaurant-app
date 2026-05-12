import { describe, expect, it } from "vitest";
import { formatDiscountReasonLabel } from "./discountDisplay";

describe("discountDisplay", () => {
  it("formats internal coupon discount reason for UI", () => {
    expect(formatDiscountReasonLabel("coupon:665abc")).toBe("Coupon hợp lệ");
  });

  it("formats internal promotion discount reason for UI", () => {
    expect(formatDiscountReasonLabel("promotion:665abc")).toBe(
      "Chương trình khuyến mãi",
    );
  });

  it("preserves readable discount reason", () => {
    expect(formatDiscountReasonLabel("Giảm giá khai trương")).toBe(
      "Giảm giá khai trương",
    );
  });

  it("returns empty string for empty reason", () => {
    expect(formatDiscountReasonLabel("")).toBe("");
    expect(formatDiscountReasonLabel(null)).toBe("");
  });
});
