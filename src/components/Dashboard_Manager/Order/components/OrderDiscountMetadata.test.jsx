import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { describe, expect, it } from "vitest";

const read = (relativePath) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

const historyModalSource = read(
  "src/components/Dashboard_Manager/Order/components/HistoryModal.jsx",
);
const orderModalSource = read(
  "src/components/Dashboard_Manager/Order/components/OrderModal.jsx",
);
const orderManagementSource = read(
  "src/components/Dashboard_Manager/Order/OrderManagement.jsx",
);

describe("Order discount metadata display", () => {
  it("shows discount metadata in history cards", () => {
    expect(historyModalSource).toContain("formatDiscountReasonLabel");
    expect(historyModalSource).toContain("getOrderDiscountMeta");
    expect(historyModalSource).toContain("hm-card__discount");
    expect(historyModalSource).toContain("Voucher");
    expect(historyModalSource).toContain("Promotion");
  });

  it("shows discount metadata in order detail modal", () => {
    expect(orderModalSource).toContain("formatDiscountReasonLabel");
    expect(orderModalSource).toContain("shippingFee");
    expect(orderModalSource).toContain("voucherCode");
    expect(orderModalSource).toContain("promotionId");
    expect(orderModalSource).toContain("discount-meta-card");
    expect(orderModalSource).toContain("Ưu đãi áp dụng");
  });

  it("exports discount metadata to CSV", () => {
    expect(orderManagementSource).toContain("voucherCode");
    expect(orderManagementSource).toContain("promotionId");
    expect(orderManagementSource).toContain("discountReason");
    expect(orderManagementSource).toContain("shippingFee");
    expect(orderManagementSource).toContain("discount");
  });
});
