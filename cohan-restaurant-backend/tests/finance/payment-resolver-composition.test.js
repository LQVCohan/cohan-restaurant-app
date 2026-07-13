import mongoose from "mongoose";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { describe, expect, it } from "vitest";
import typeDefs from "../../graphql/schema/index.js";
import resolvers from "../../graphql/resolvers/index.js";

const PAYMENT_TYPES = [
  "PaymentSession",
  "PaymentTransaction",
  "Invoice",
  "Cashflow",
  "BankTransaction",
  "PaymentReconciliation",
  "SupplierPayable",
  "PaymentRefund",
];

describe("payment resolver composition", () => {
  it("registers payment object resolvers in the root resolver map", () => {
    PAYMENT_TYPES.forEach((typeName) => {
      expect(resolvers[typeName], `${typeName} resolver is missing`).toBeDefined();
    });
  });

  it("attaches Cashflow.id to the executable schema used by GetTransactionManagement", () => {
    const schema = makeExecutableSchema({ typeDefs, resolvers });
    const idResolver = schema.getType("Cashflow")?.getFields?.().id?.resolve;
    const _id = new mongoose.Types.ObjectId();

    expect(idResolver).toBeTypeOf("function");
    expect(idResolver({ _id }, {}, {}, {})).toBe(String(_id));
  });
});
