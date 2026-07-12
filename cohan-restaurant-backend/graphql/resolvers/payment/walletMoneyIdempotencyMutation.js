import mongoose from "mongoose";
import {
  EventLog,
  PaymentRefund,
  WalletTransaction,
} from "../../../models/index.js";
import { getWalletSummary } from "../../../src/services/wallet/wallet.service.js";
import { runIdempotentPaymentRequest } from "../../../src/services/payment/paymentRequestIdempotency.service.js";

const OPERATION_BY_FIELD = Object.freeze({
  refundToWallet: "RefundToWallet",
  adjustWalletBalance: "AdjustWalletBalance",
});

const toId = (value) =>
  value && mongoose.isValidObjectId(value)
    ? new mongoose.Types.ObjectId(value)
    : null;

const uniqueSorted = (values = []) => [
  ...new Set((values || []).map(String).filter(Boolean)),
].sort();

function normalizeInput(input = {}) {
  const normalized = {
    ...input,
    amount: Math.round(Number(input?.amount || 0)),
    reason: String(input?.reason || "").trim(),
  };
  delete normalized.idempotencyKey;
  if (Array.isArray(normalized.orderIds)) {
    normalized.orderIds = uniqueSorted(normalized.orderIds);
  }
  return normalized;
}

function metadataSet(key, requestFingerprint, operation, prefix = "metadata") {
  return {
    [`${prefix}.idempotencyKey`]: key,
    [`${prefix}.correlationId`]: key,
    [`${prefix}.requestFingerprint`]: requestFingerprint,
    [`${prefix}.paymentOperation`]: operation,
  };
}

function serializeTransaction(transaction) {
  if (!transaction) return null;
  return {
    id: String(transaction._id || transaction.id),
    userId: String(transaction.userId),
    type: transaction.type,
    amount: Number(transaction.amount || 0),
    currency: transaction.currency || "VND",
    balanceBefore: Number(transaction.balanceBefore || 0),
    balanceAfter: Number(transaction.balanceAfter || 0),
    status: transaction.status || "SUCCESS",
    referenceType: transaction.referenceType || null,
    referenceId: transaction.referenceId ? String(transaction.referenceId) : null,
    orderIds: (transaction.orderIds || []).map(String),
    metadata: transaction.metadata || {},
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt,
  };
}

async function findRefundResult({ input, claim, key }) {
  const userId = toId(input?.userId);
  const restaurantId = toId(input?.restaurantId);
  const orderId = toId(uniqueSorted(input?.orderIds)[0]);
  if (!userId || !restaurantId || !orderId) return null;

  let transaction = await WalletTransaction.findOne({
    userId,
    type: "REFUND",
    "metadata.idempotencyKey": key,
  })
    .sort({ createdAt: -1 })
    .lean({ virtuals: true });
  let refund = transaction?.metadata?.refundId
    ? await PaymentRefund.findById(transaction.metadata.refundId).lean({ virtuals: true })
    : null;

  if (!refund) {
    refund = await PaymentRefund.findOne({
      restaurantId,
      orderId,
      amount: Math.abs(Number(input.amount || 0)),
      reason: String(input.reason || "").trim(),
      createdBy: claim.userId,
      createdAt: { $gte: new Date(new Date(claim.startedAt).getTime() - 5000) },
    })
      .sort({ createdAt: -1 })
      .lean({ virtuals: true });
  }
  if (!refund) return null;

  if (!transaction) {
    transaction = await WalletTransaction.findOne({
      userId,
      type: "REFUND",
      $or: [
        { referenceId: refund._id },
        { "metadata.refundId": String(refund._id) },
      ],
    })
      .sort({ createdAt: -1 })
      .lean({ virtuals: true });
  }
  if (!transaction) return null;

  const summary = await getWalletSummary(userId);
  return {
    ok: true,
    message: "Đã hoàn tiền vào ví khách hàng.",
    wallet: summary.wallet,
    transaction: serializeTransaction(transaction),
    refundId: String(refund._id),
    amount: Number(refund.amount || input.amount || 0),
  };
}

async function findAdjustmentResult({ input, claim, key }) {
  const userId = toId(input?.userId);
  const restaurantId = toId(input?.restaurantId);
  if (!userId || !restaurantId) return null;
  const signedAmount = Math.round(Number(input?.amount || 0));
  const direction = signedAmount > 0 ? "credit" : "debit";

  const transaction = await WalletTransaction.findOne({
    userId,
    type: "ADJUSTMENT",
    $or: [
      { "metadata.idempotencyKey": key },
      {
        amount: Math.abs(signedAmount),
        "metadata.restaurantId": String(restaurantId),
        "metadata.direction": direction,
        "metadata.reason": String(input?.reason || "").trim(),
        "metadata.actorId": String(claim.userId),
        createdAt: { $gte: new Date(new Date(claim.startedAt).getTime() - 5000) },
      },
    ],
  })
    .sort({ createdAt: -1 })
    .lean({ virtuals: true });
  if (!transaction) return null;

  const summary = await getWalletSummary(userId);
  return {
    ok: true,
    message: "Đã điều chỉnh số dư ví.",
    wallet: summary.wallet,
    transaction: serializeTransaction(transaction),
  };
}

async function attachResultMetadata({
  field,
  result,
  key,
  requestFingerprint,
  operation,
}) {
  const transactionId = toId(result?.transaction?.id || result?.transaction?._id);
  const refundId = toId(result?.refundId);
  const writes = [];
  if (transactionId) {
    writes.push(
      WalletTransaction.updateOne(
        { _id: transactionId },
        { $set: metadataSet(key, requestFingerprint, operation) },
      ),
    );
  }
  if (field === "refundToWallet" && refundId) {
    writes.push(
      PaymentRefund.updateOne(
        { _id: refundId },
        { $set: metadataSet(key, requestFingerprint, operation, "meta") },
      ),
      EventLog.updateOne(
        { "object.kind": "PaymentRefund", "object.id": refundId },
        {
          $set: {
            correlationId: key,
            ...metadataSet(key, requestFingerprint, operation, "meta"),
          },
        },
      ),
    );
  } else if (transactionId) {
    writes.push(
      EventLog.updateOne(
        { "object.kind": "WalletTransaction", "object.id": transactionId },
        {
          $set: {
            correlationId: key,
            ...metadataSet(key, requestFingerprint, operation, "meta"),
          },
        },
      ),
    );
  }
  await Promise.all(writes).catch(() => {});

  if (result?.transaction) {
    result.transaction.metadata = {
      ...(result.transaction.metadata || {}),
      idempotencyKey: key,
      correlationId: key,
      requestFingerprint,
      paymentOperation: operation,
    };
  }
}

function wrapWalletMoneyMutation(field, resolver) {
  const operation = OPERATION_BY_FIELD[field];
  if (!operation || typeof resolver !== "function") return resolver;

  return async function idempotentWalletMoneyMutation(parent, args = {}, ctx, info) {
    const actorId = ctx?.user?.id || ctx?.user?._id;
    if (!actorId) throw new Error("Unauthorized");
    const input = args?.input || {};
    const normalizedInput = normalizeInput(input);

    return runIdempotentPaymentRequest({
      idempotencyKey: input?.idempotencyKey,
      operation,
      userId: actorId,
      restaurantId: input?.restaurantId,
      input: normalizedInput,
      recover: ({ claim, key }) =>
        field === "refundToWallet"
          ? findRefundResult({ input: normalizedInput, claim, key })
          : findAdjustmentResult({ input: normalizedInput, claim, key }),
      execute: async ({ key, requestFingerprint }) => {
        const result = await resolver(parent, args, ctx, info);
        await attachResultMetadata({
          field,
          result,
          key,
          requestFingerprint,
          operation,
        });
        return result;
      },
    });
  };
}

export function withWalletMoneyIdempotency(mutation = {}) {
  return Object.fromEntries(
    Object.entries(mutation).map(([field, resolver]) => [
      field,
      wrapWalletMoneyMutation(field, resolver),
    ]),
  );
}

export default withWalletMoneyIdempotency;
