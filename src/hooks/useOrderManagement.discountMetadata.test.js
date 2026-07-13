import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { describe, expect, it } from "vitest";

const read = (relativePath) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

const source = [
  read("src/hooks/useOrderManagement.js"),
  read("src/hooks/useOrderManagementLegacy.js"),
].join("\n");

describe("useOrderManagement discount metadata query coverage", () => {
  it("requests discount metadata in order totals selections", () => {
    expect(source).toContain("discountReason");
    expect(source).toContain("voucherCode");
    expect(source).toContain("promotionId");
    expect(source).toContain("shippingFee");
  });

  it("keeps payment mutations requesting richer invoice totals", () => {
    expect(source).toContain("mutation PayOrdersByTableId");
    expect(source).toContain("mutation PayOrdersByOrderIds");
    expect(source).toMatch(
      /invoice\s*\{[\s\S]*totals\s*\{[\s\S]*discountReason/,
    );
    expect(source).toMatch(/invoice\s*\{[\s\S]*totals\s*\{[\s\S]*voucherCode/);
    expect(source).toMatch(/invoice\s*\{[\s\S]*totals\s*\{[\s\S]*promotionId/);
    expect(source).toMatch(/invoice\s*\{[\s\S]*totals\s*\{[\s\S]*shippingFee/);
  });
});
