import { describe, expect, it } from "vitest";
import fs from "node:fs";

const ORDER_SCHEMA_PATH = "graphql/schema/order.graphql";

describe("order discount line schema", () => {
  it("exposes promotion line breakdown in discount preview", () => {
    const src = fs.readFileSync(ORDER_SCHEMA_PATH, "utf8");

    expect(src).toMatch(/type DiscountLine/);
    expect(src).toMatch(/promotionLines:\s*\[DiscountLine!\]!/);
    expect(src).toMatch(/promotionId:\s*ID!/);
    expect(src).toMatch(/promotionName:\s*String/);
    expect(src).toMatch(/promotionScope:\s*String/);
    expect(src).toMatch(/lineSubtotal:\s*Int!/);
    expect(src).toMatch(/discount:\s*Int!/);
  });
});
