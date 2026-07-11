import { print } from "graphql";
import { describe, expect, it } from "vitest";
import typeDefs from "../../graphql/schema/index.js";
import { PaymentResolvers } from "../../graphql/resolvers/payment/types.js";
import Cashflow from "../../models/cashflow.model.js";

describe("transaction management persistence and GraphQL contracts", () => {
  it("keeps cashflow category validation and refund idempotency indexes active", () => {
    expect(Cashflow.schema.path("category").enumValues).toEqual(
      expect.arrayContaining([
        "sale",
        "refund",
        "payroll",
        "inventory",
        "operations",
        "supplier_payment",
        "adjustment",
        "other",
      ]),
    );
    expect(Cashflow.schema.path("subcategory").enumValues).toContain("cogs");

    const refundIndex = Cashflow.schema
      .indexes()
      .find(([keys]) => keys["ref.refundId"] === 1);
    expect(refundIndex?.[1]).toEqual(
      expect.objectContaining({
        unique: true,
        partialFilterExpression: expect.objectContaining({ source: "refund" }),
      }),
    );
  });

  it("exposes and preserves MoMo/VNPAY payment methods", () => {
    const schema = print(typeDefs);
    expect(schema).toMatch(/enum PaymentMethod[\s\S]*\bmomo\b/);
    expect(schema).toMatch(/enum PaymentMethod[\s\S]*\bvnpay\b/);
    expect(PaymentResolvers.PaymentTransaction.method({ method: "momo" })).toBe(
      "momo",
    );
    expect(PaymentResolvers.PaymentTransaction.method({ method: "vnpay" })).toBe(
      "vnpay",
    );
    expect(
      PaymentResolvers.PaymentTransaction.method({ method: "unknown-provider" }),
    ).toBe("other");
  });
});
