import { describe, expect, it } from "vitest";
import {
  getOrderTypeDisplayLabel,
  getPaymentRequestGroupLabel,
  getVirtualTableCodeLabel,
  isRealTableCode,
} from "./posDisplayLabels";

describe("POS display labels", () => {
  it("treats dine-in real table codes as real table codes", () => {
    expect(isRealTableCode("dine_in", "A1")).toBe(true);
  });

  it("does not treat virtual table codes as real dine-in tables", () => {
    expect(isRealTableCode("dine_in", "TAKEAWAY")).toBe(false);
    expect(isRealTableCode("delivery", "DELIVERY")).toBe(false);
  });

  it.each([
    ["delivery", "Giao hàng"],
    ["takeaway", "Mang đi"],
    ["remote", "Đặt từ xa"],
    ["online", "Đặt từ xa"],
    ["dine_in", "Tại bàn"],
  ])("maps order type %s to %s", (orderType, label) => {
    expect(getOrderTypeDisplayLabel(orderType)).toBe(label);
  });

  it.each([
    ["DELIVERY", "Giao hàng"],
    ["TAKEAWAY", "Mang đi"],
    ["REMOTE", "Đặt từ xa"],
    ["ONLINE", "Đặt từ xa"],
  ])("maps virtual table code %s to %s", (code, label) => {
    expect(getVirtualTableCodeLabel(code)).toBe(label);
  });

  it("builds dine-in group label as table label", () => {
    expect(
      getPaymentRequestGroupLabel({
        isTableGroup: true,
        orderType: "dine_in",
        tableCode: "A1",
      }),
    ).toBe("Bàn A1");
  });

  it("builds delivery/takeaway labels without virtual table code leakage", () => {
    expect(
      getPaymentRequestGroupLabel({
        isTableGroup: true,
        orderType: "delivery",
        tableCode: "DELIVERY",
      }),
    ).toBe("Giao hàng");
    expect(
      getPaymentRequestGroupLabel({
        isTableGroup: true,
        orderType: "takeaway",
        tableCode: "TAKEAWAY",
      }),
    ).toBe("Mang đi");
  });

  it("falls back to remote/online virtual labels when orderType is missing", () => {
    expect(getPaymentRequestGroupLabel({ tableCode: "REMOTE" })).toBe("Đặt từ xa");
    expect(getPaymentRequestGroupLabel({ tableCode: "ONLINE" })).toBe("Đặt từ xa");
  });

  it("falls back to unassigned label when order info is missing", () => {
    expect(getPaymentRequestGroupLabel({})).toBe("Không gắn bàn");
  });
});
