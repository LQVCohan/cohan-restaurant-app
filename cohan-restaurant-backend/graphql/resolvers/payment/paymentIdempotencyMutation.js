import crypto from "node:crypto";
import mongoose from "mongoose";
import {
  Cashflow,
  EventLog,
  Invoice,
  PaymentSession,
  PaymentTransaction,
  Reservation,
  WalletTransaction,
} from "../../../models/index.js";
import { getWalletSummary } from "../../../src/services/wallet/wallet.service.js";
import { runIdempotentPaymentRequest } from "../../../src/services/payment/paymentRequestIdempotency.service.js";

const OPERATION_BY_FIELD = Object.freeze({
  createReservationPayment: "CreateReservationPayment",
  createOrderPayment: "CreateOrderPayment",
  createWalletTopup: "CreateWalletTopup",
  payOrdersByTableId: "PayOrdersByTableId",
  payOrdersByOrderIds: "PayOrdersByOrderIds",
});

const toId = (value) =>
  value && mongoose.isValidObjectId(value)
    ? new mongoose.Types.ObjectId(value)
    : null;

const uniqueSorted = (values = []) => [
  ...new Set((values || []).map(String).filter(Boolean)),
].sort();

function normalizePaymentInput(field, input = {}) {
  const normalized = { ...input };
  delete normalized.idempotencyKey;
  if (Array.isArray(normalized.orderIds)) {
    normalized.orderIds = uniqueSorted(normalized.orderIds);
  }
  if (Array.isArray(normalized.promotionIds)) {
    normalized.promotionIds = uniqueSorted(normalized.promotionIds);
  }
  if (normalized.provider) normalized.provider = String(normalized.provider).toLowerCase();
  if (normalized.paymentMethod) {
    normalized.paymentMethod = String(normalized.paymentMethod).toLowerCase();
  }
  if (normalized.method) normalized.method = String(normalized.method).toLowerCase();
  if (field === "createWalletTopup" && normalized.amount != null) {
    normalized.amount = Math.round(Number(normalized.amount));
  }
  return normalized;
}

function keyToken(key, length = 24) {
  return crypto
    .createHash("sha256")
    .update(String(key))
    .digest("hex")
    .slice(0, length)
    .toUpperCase();
}

function topupReference(key) {
  return `TOPUP-${keyToken(key)}`;
}

function idempotencyMetadata({ key, requestFingerprint, operation }) {
  return {
    idempotencyKey: key,
    correlationId: key,
    requestFingerprint,
    paymentOperation: operation,
  };
}

function metadataSet(metadata, prefix = "metadata") {
  return Object.fromEntries(
    Object.entries(metadata).map(([name, value]) => [`${prefix}.${name}`, value]),
  );
}

async function attachPaymentSessionMetadata({
  paymentId,
  key,
  requestFingerprint,
  operation,
}) {
  const id = toId(paymentId);
  if (!id) return;
  const metadata = idempotencyMetadata({ key, requestFingerprint, operation });
  await Promise.all([
    PaymentSession.updateOne(
      { _id: id },
      { $set: metadataSet(metadata) },
    ),
    EventLog.updateOne(
      { "object.kind": "PaymentSession", "object.id": id },
      {
        $set: {
          correlationId: key,
          ...metadataSet(metadata, "meta"),
        },
      },
    ),
  ]).catch(() => {});
}

async function attachWalletTransactionMetadata({
  transactionId,
  key,
  requestFingerprint,
  operation,
}) {
  const id = toId(transactionId);
  if (!id) return;
  const metadata = idempotencyMetadata({ key, requestFingerprint, operation });
  await WalletTransaction.updateOne(
    { _id: id },
    { $set: metadataSet(metadata) },
  ).catch(() => {});
}

async function attachPosMetadata({
  transactionId,
  invoiceId,
  key,
  requestFingerprint,
  operation,
}) {
  const transactionObjectId = toId(transactionId);
  const invoiceObjectId = toId(invoiceId);
  if (!transactionObjectId) return;
  const metadata = idempotencyMetadata({ key, requestFingerprint, operation });
  const writes = [
    PaymentTransaction.updateOne(
      { _id: transactionObjectId },
      { $set: metadataSet(metadata, "meta") },
    ),
  ];
  if (invoiceObjectId) {
    writes.push(
      EventLog.updateOne(
        { "target.kind": "Invoice", "target.id": invoiceObjectId },
        {
          $set: {
            correlationId: key,
            ...metadataSet(metadata, "meta"),
          },
        },
      ),
    );
  }
  await Promise.all(writes).catch(() => {});
}

function paymentIdFromResult(field, result) {
  if (field === "createWalletTopup") {
    return result?.paymentSession?.id || result?.paymentSession?._id;
  }
  if (["createOrderPayment", "createReservationPayment"].includes(field)) {
    return result?.id || result?._id;
  }
  return null;
}

async function recoverPaymentSession({ field, input, key, claim }) {
  const provider = String(input?.provider || "").toLowerCase();
  const byKey = await PaymentSession.findOne({
    userId: claim.userId,
    provider,
    "metadata.idempotencyKey": key,
  }).lean({ virtuals: true });
  if (byKey) return byKey;

  const base = {
    userId: claim.userId,
    provider,
    createdAt: { $gte: new Date(new Date(claim.startedAt).getTime() - 5000) },
  };
  if (field === "createReservationPayment") {
    const reservationId = toId(input?.reservationId);
    if (!reservationId) return null;
    return PaymentSession.findOne({ ...base, reservationId })
      .sort({ createdAt: -1 })
      .lean({ virtuals: true });
  }
  if (field === "createOrderPayment") {
    const orderIds = uniqueSorted(input?.orderIds);
    const candidates = await PaymentSession.find({
      ...base,
      restaurantId: toId(input?.restaurantId),
      "metadata.source": "order_payment",
    })
      .sort({ createdAt: -1 })
      .lean({ virtuals: true });
    return (
      candidates.find((candidate) => {
        const stored = uniqueSorted(candidate?.metadata?.orderIds);
        return stored.length === orderIds.length && stored.every((id, index) => id === orderIds[index]);
      }) || null
    );
  }
  return null;
}

function serializeWalletTransaction(transaction) {
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

async function recoverWalletTopup({ input, key, claim }) {
  const provider = String(input?.provider || "momo").toLowerCase();
  const reference = topupReference(key);
  const paymentSession = await PaymentSession.findOne({ provider, reference }).lean({
    virtuals: true,
  });
  const transaction = await WalletTransaction.findOne({
    userId: claim.userId,
    type: "TOPUP",
    $or: [
      { "metadata.idempotencyKey": key },
      { "metadata.reference": reference },
    ],
  })
    .sort({ createdAt: -1 })
    .lean({ virtuals: true });
  if (!paymentSession && !transaction) return null;
  const summary = await getWalletSummary(claim.userId);
  return {
    ok: true,
    message: transaction
      ? "Nạp ví đã được xử lý."
      : "Phiên nạp ví đã được tạo.",
    wallet: summary.wallet,
    transaction: serializeWalletTransaction(transaction),
    paymentSession,
    amount: Number(transaction?.amount || paymentSession?.amount || input?.amount || 0),
  };
}

async function recoverPosPayment({ input, externalRef }) {
  const restaurantId = toId(input?.restaurantId);
  if (!restaurantId) return null;
  const transaction = await PaymentTransaction.findOne({
    restaurantId,
    externalRef,
    status: "SUCCESS",
  }).lean({ virtuals: true });
  if (!transaction) return null;
  const invoice = await Invoice.findOne({
    restaurantId,
    refTransactionId: transaction._id,
  }).lean({ virtuals: true });
  const cashflow = invoice
    ? await Cashflow.findOne({
        restaurantId,
        $or: [
          { "ref.id": invoice._id },
          { "ref.invoiceId": invoice._id },
          { "ref.paymentTransactionId": transaction._id },
        ],
      }).lean({ virtuals: true })
    : null;
  return {
    warning: false,
    pendingOrderCodes: [],
    invoice,
    transaction,
    cashflow,
  };
}

async function resolveRestaurantId(field, input) {
  if (input?.restaurantId) return input.restaurantId;
  if (field !== "createReservationPayment" || !toId(input?.reservationId)) {
    return null;
  }
  const reservation = await Reservation.findById(input.reservationId)
    .select({ restaurantId: 1 })
    .lean();
  return reservation?.restaurantId || null;
}

function prepareInput({ field, input, key, requestFingerprint, operation }) {
  const metadata = idempotencyMetadata({ key, requestFingerprint, operation });
  if (field === "createWalletTopup") {
    return {
      ...input,
      reference: topupReference(key),
      metadata: { ...(input?.metadata || {}), ...metadata },
    };
  }
  if (["payOrdersByTableId", "payOrdersByOrderIds"].includes(field)) {
    return {
      ...input,
      externalRef: input?.externalRef || `PAY-${keyToken(key)}`,
    };
  }
  return input;
}

function wrapPaymentMutation(field, resolver) {
  const operation = OPERATION_BY_FIELD[field];
  if (!operation || typeof resolver !== "function") return resolver;

  return async function idempotentPaymentMutation(parent, args = {}, ctx, info) {
    const userId = ctx?.user?.id || ctx?.user?._id;
    if (!userId) throw new Error("Unauthorized");
    const input = args?.input || {};
    const restaurantId = await resolveRestaurantId(field, input);
    const normalizedInput = normalizePaymentInput(field, input);
    const externalRef = input?.externalRef || `PAY-${keyToken(input?.idempotencyKey)}`;

    return runIdempotentPaymentRequest({
      idempotencyKey: input?.idempotencyKey,
      operation,
      userId,
      restaurantId,
      input: normalizedInput,
      recover: async ({ claim, key }) => {
        if (field === "createWalletTopup") {
          return recoverWalletTopup({ input: normalizedInput, key, claim });
        }
        if (["createOrderPayment", "createReservationPayment"].includes(field)) {
          return recoverPaymentSession({ field, input: normalizedInput, key, claim });
        }
        return recoverPosPayment({ input: normalizedInput, externalRef });
      },
      execute: async ({ key, requestFingerprint }) => {
        const preparedInput = prepareInput({
          field,
          input,
          key,
          requestFingerprint,
          operation,
        });
        const result = await resolver(
          parent,
          { ...args, input: preparedInput },
          ctx,
          info,
        );
        const metadata = idempotencyMetadata({ key, requestFingerprint, operation });
        const paymentId = paymentIdFromResult(field, result);
        if (paymentId) {
          await attachPaymentSessionMetadata({
            paymentId,
            key,
            requestFingerprint,
            operation,
          });
          if (field === "createWalletTopup" && result?.paymentSession) {
            result.paymentSession.metadata = {
              ...(result.paymentSession.metadata || {}),
              ...metadata,
            };
          } else if (result && typeof result === "object") {
            result.metadata = { ...(result.metadata || {}), ...metadata };
          }
        }
        if (field === "createWalletTopup" && result?.transaction) {
          await attachWalletTransactionMetadata({
            transactionId: result.transaction.id || result.transaction._id,
            key,
            requestFingerprint,
            operation,
          });
          result.transaction.metadata = {
            ...(result.transaction.metadata || {}),
            ...metadata,
          };
        }
        if (["payOrdersByTableId", "payOrdersByOrderIds"].includes(field)) {
          await attachPosMetadata({
            transactionId: result?.transaction?.id || result?.transaction?._id,
            invoiceId: result?.invoice?.id || result?.invoice?._id,
            key,
            requestFingerprint,
            operation,
          });
        }
        return result;
      },
    });
  };
}

export function withPaymentIdempotency(mutation = {}) {
  return Object.fromEntries(
    Object.entries(mutation).map(([field, resolver]) => [
      field,
      wrapPaymentMutation(field, resolver),
    ]),
  );
}

export default withPaymentIdempotency;
