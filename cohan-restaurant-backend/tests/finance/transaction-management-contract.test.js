import { readFileSync } from "node:fs";
import { join } from "node:path";
import mongoose from "mongoose";
import { print } from "graphql";
import { afterEach, describe, expect, it, vi } from "vitest";
import typeDefs from "../../graphql/schema/index.js";
import { PaymentResolvers } from "../../graphql/resolvers/payment/types.js";
import Cashflow from "../../models/cashflow.model.js";
import Invoice from "../../models/invoice.model.js";
import PaymentTransaction, {
  ensurePaymentTransactionCashflow,
} from "../../models/payment-transaction.model.js";
import {
  ensureSuccessfulRefundCashflow,
} from "../../models/payment-refund.model.js";

const objectId = () => new mongoose.Types.ObjectId();
const selectLeanQuery = (value) => ({
  select: vi.fn().mockReturnValue({
    lean: vi.fn().mockResolvedValue(value),
  }),
});

const walletServiceSource = readFileSync(
  join(
    process.cwd(),
    "cohan-restaurant-backend/src/services/wallet/wallet.service.js",
  ),
  "utf8",
);

describe("transaction management persistence and GraphQL contracts", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps cashflow validation and idempotency indexes active", () => {
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
    expect(Cashflow.schema.path("method").enumValues).toEqual(
      expect.arrayContaining(["momo", "vnpay"]),
    );

    const indexes = Cashflow.schema.indexes();
    const refundIndex = indexes.find(([keys]) => keys["ref.refundId"] === 1);
    expect(refundIndex?.[1]).toEqual(
      expect.objectContaining({
        unique: true,
        partialFilterExpression: expect.objectContaining({ source: "refund" }),
      }),
    );

    const paymentIndex = indexes.find(
      ([keys]) =>
        keys["ref.paymentTransactionId"] === 1 && keys.source === 1,
    );
    expect(paymentIndex?.[1]).toEqual(
      expect.objectContaining({
        unique: true,
        partialFilterExpression: expect.objectContaining({
          source: { $in: ["order", "reservation"] },
        }),
      }),
    );
  });

  it("normalizes legacy blank cashflow classifications before validation", async () => {
    const cashflow = new Cashflow({
      restaurantId: objectId(),
      type: "OUTFLOW",
      amount: 100,
      category: "",
      subcategory: "",
    });

    await expect(cashflow.validate()).resolves.toBeUndefined();
    expect(cashflow.category).toBe("other");
    expect(cashflow.subcategory).toBe("other");
  });

  it("enriches provider invoice cashflows from their payment transaction", async () => {
    const invoiceId = objectId();
    const transactionId = objectId();
    vi.spyOn(Invoice, "findById").mockReturnValue(
      selectLeanQuery({ refTransactionId: transactionId }),
    );
    vi.spyOn(PaymentTransaction, "findById").mockReturnValue(
      selectLeanQuery({ method: "vnpay" }),
    );

    const cashflow = new Cashflow({
      restaurantId: objectId(),
      type: "INFLOW",
      amount: 500,
      ref: { kind: "Invoice", id: invoiceId },
    });
    await cashflow.validate();

    expect(cashflow.category).toBe("sale");
    expect(cashflow.source).toBe("order");
    expect(cashflow.method).toBe("vnpay");
    expect(String(cashflow.ref.invoiceId)).toBe(String(invoiceId));
    expect(String(cashflow.ref.paymentTransactionId)).toBe(
      String(transactionId),
    );
  });

  it("creates one auditable cashflow for a reservation deposit only", async () => {
    const cashflowId = objectId();
    const findOneAndUpdate = vi
      .spyOn(Cashflow, "findOneAndUpdate")
      .mockResolvedValue({ _id: cashflowId });

    const reservationTransactionId = objectId();
    await ensurePaymentTransactionCashflow({
      _id: reservationTransactionId,
      restaurantId: objectId(),
      orderIds: [],
      method: "momo",
      paidAmount: 300,
      currency: "VND",
      status: "SUCCESS",
      note: "Reservation deposit RES-001",
      paidAt: new Date(),
      $session: () => null,
    });
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "reservation",
        "ref.paymentTransactionId": reservationTransactionId,
      }),
      expect.objectContaining({
        $setOnInsert: expect.objectContaining({
          category: "sale",
          method: "momo",
          source: "reservation",
        }),
      }),
      expect.objectContaining({ upsert: true }),
    );

    findOneAndUpdate.mockClear();
    await ensurePaymentTransactionCashflow({
      _id: objectId(),
      restaurantId: objectId(),
      orderId: objectId(),
      orderIds: [objectId()],
      method: "e_wallet",
      paidAmount: 700,
      status: "SUCCESS",
      $session: () => null,
    });
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("uses transactional idempotent wallet cashflow writes without swallowing errors", () => {
    expect(walletServiceSource).toContain("Cashflow.findOneAndUpdate(");
    expect(walletServiceSource).toContain('source: "order"');
    expect(walletServiceSource).toContain('source: "refund"');
    expect(walletServiceSource).toContain(
      '{ upsert: true, new: true, setDefaultsOnInsert: true, session }',
    );
    expect(walletServiceSource).not.toMatch(/Cashflow\.create\([\s\S]*?\.catch\(/);
  });

  it("creates and links a missing cashflow for a successful direct refund", async () => {
    const cashflowId = objectId();
    vi.spyOn(Cashflow, "findOneAndUpdate").mockResolvedValue({ _id: cashflowId });
    const updateOne = vi.fn().mockResolvedValue({ acknowledged: true });
    const refundId = objectId();
    const refund = {
      _id: refundId,
      restaurantId: objectId(),
      orderId: objectId(),
      amount: 200,
      currency: "VND",
      reason: "Hoàn vào ví",
      method: "e_wallet",
      status: "success",
      cashflowId: null,
      processedAt: new Date(),
      processedBy: objectId(),
      $session: () => null,
      constructor: { updateOne },
    };

    await ensureSuccessfulRefundCashflow(refund);

    expect(Cashflow.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "refund",
        "ref.refundId": refundId,
      }),
      expect.objectContaining({
        $setOnInsert: expect.objectContaining({
          type: "OUTFLOW",
          method: "e_wallet",
          source: "refund",
        }),
      }),
      expect.objectContaining({ upsert: true }),
    );
    expect(refund.cashflowId).toBe(cashflowId);
    expect(updateOne).toHaveBeenCalled();
  });

  it("exposes truthful payment methods and nullable missing order links", () => {
    const schema = print(typeDefs);
    expect(schema).toMatch(/enum PaymentMethod[\s\S]*\bmomo\b/);
    expect(schema).toMatch(/enum PaymentMethod[\s\S]*\bvnpay\b/);
    expect(schema).toMatch(/type Invoice \{[\s\S]*?orderId: ID\n/);
    expect(schema).toMatch(/type PaymentTransaction \{[\s\S]*?orderId: ID\n/);
    expect(PaymentResolvers.PaymentTransaction.method({ method: "momo" })).toBe(
      "momo",
    );
    expect(PaymentResolvers.PaymentTransaction.method({ method: "vnpay" })).toBe(
      "vnpay",
    );
    expect(
      PaymentResolvers.PaymentTransaction.method({ method: "unknown-provider" }),
    ).toBe("other");
    expect(PaymentResolvers.PaymentTransaction.orderId({ _id: objectId() })).toBeNull();
    expect(PaymentResolvers.Invoice.orderId({ _id: objectId() })).toBeNull();
  });
});
