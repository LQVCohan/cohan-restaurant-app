import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import { PaymentResolvers } from "../../graphql/resolvers/payment/types.js";

describe("Cashflow GraphQL id resolver", () => {
  it("resolves id from MongoDB _id on lean cashflow results", () => {
    const _id = new mongoose.Types.ObjectId();

    expect(PaymentResolvers.Cashflow.id({ _id })).toBe(String(_id));
  });

  it("keeps compatibility with already-normalized cashflow ids", () => {
    expect(PaymentResolvers.Cashflow.id({ id: "cashflow-123" })).toBe(
      "cashflow-123",
    );
  });
});
