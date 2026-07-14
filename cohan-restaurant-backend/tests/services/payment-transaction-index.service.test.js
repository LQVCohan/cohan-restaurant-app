import mongoose from "mongoose";
import { describe, expect, it, vi } from "vitest";
import PaymentTransaction from "../../models/payment-transaction.model.js";
import {
  ensurePaymentTransactionTxnRefIndex,
  isDesiredPaymentTransactionTxnRefIndex,
  PAYMENT_TRANSACTION_TXN_REF_INDEX,
} from "../../src/services/payment/paymentTransactionIndex.service.js";

const desiredIndex = {
  name: PAYMENT_TRANSACTION_TXN_REF_INDEX,
  key: { restaurantId: 1, txnRef: 1 },
  unique: true,
  partialFilterExpression: { txnRef: { $type: "string" } },
};

function createDb(indexes) {
  const collection = {
    indexes: vi.fn(async () => indexes),
    dropIndex: vi.fn(async () => undefined),
    updateMany: vi.fn(async () => ({ acknowledged: true, modifiedCount: 1 })),
    createIndex: vi.fn(async () => PAYMENT_TRANSACTION_TXN_REF_INDEX),
  };

  return {
    db: { collection: vi.fn(() => collection) },
    collection,
  };
}

describe("payment transaction txnRef index", () => {
  it("replaces the legacy sparse index with a partial unique index", async () => {
    const legacyIndex = {
      name: PAYMENT_TRANSACTION_TXN_REF_INDEX,
      key: { restaurantId: 1, txnRef: 1 },
      unique: true,
      sparse: true,
    };
    const { db, collection } = createDb([
      { name: "_id_", key: { _id: 1 } },
      legacyIndex,
    ]);
    const logger = { info: vi.fn() };

    const result = await ensurePaymentTransactionTxnRefIndex(db, { logger });

    expect(result).toEqual({
      changed: true,
      indexName: PAYMENT_TRANSACTION_TXN_REF_INDEX,
    });
    expect(collection.dropIndex).toHaveBeenCalledWith(
      PAYMENT_TRANSACTION_TXN_REF_INDEX,
    );
    expect(collection.updateMany).toHaveBeenCalledOnce();
    expect(collection.createIndex).toHaveBeenCalledWith(
      { restaurantId: 1, txnRef: 1 },
      {
        name: PAYMENT_TRANSACTION_TXN_REF_INDEX,
        unique: true,
        partialFilterExpression: { txnRef: { $type: "string" } },
      },
    );
  });

  it("keeps an already-correct partial unique index unchanged", async () => {
    const { db, collection } = createDb([desiredIndex]);

    const result = await ensurePaymentTransactionTxnRefIndex(db, {
      logger: { info: vi.fn() },
    });

    expect(result.changed).toBe(false);
    expect(collection.dropIndex).not.toHaveBeenCalled();
    expect(collection.updateMany).not.toHaveBeenCalled();
    expect(collection.createIndex).not.toHaveBeenCalled();
  });

  it("recognizes only the intended index contract", () => {
    expect(isDesiredPaymentTransactionTxnRefIndex(desiredIndex)).toBe(true);
    expect(
      isDesiredPaymentTransactionTxnRefIndex({
        ...desiredIndex,
        partialFilterExpression: undefined,
        sparse: true,
      }),
    ).toBe(false);
  });
});

describe("PaymentTransaction txnRef normalization", () => {
  it("omits null and blank provider references from cash transactions", () => {
    const transaction = new PaymentTransaction({
      restaurantId: new mongoose.Types.ObjectId(),
      method: "cash",
      paidAmount: 229000,
      txnRef: null,
    });

    expect(transaction.txnRef).toBeUndefined();

    transaction.txnRef = "   ";
    expect(transaction.txnRef).toBeUndefined();

    transaction.txnRef = " VNPAY-REF-001 ";
    expect(transaction.txnRef).toBe("VNPAY-REF-001");
  });

  it("declares uniqueness only for real string transaction references", () => {
    const txnRefIndex = PaymentTransaction.schema
      .indexes()
      .find(
        ([keys]) =>
          keys?.restaurantId === 1 && keys?.txnRef === 1,
      );

    expect(txnRefIndex).toBeTruthy();
    expect(txnRefIndex[1]).toMatchObject({
      unique: true,
      partialFilterExpression: { txnRef: { $type: "string" } },
    });
    expect(txnRefIndex[1].sparse).not.toBe(true);
  });
});
