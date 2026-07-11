import crypto from "node:crypto";
import mongoose from "mongoose";
import {
  EventLog,
  PaymentSession,
  PaymentTransaction,
  WalletTransaction,
} from "../../../models/index.js";
import { payOrdersWithWallet as settleOrdersWithWallet } from "./wallet.service.js";

const WALLET_PROVIDER = "cohan_wallet";
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9:_-]+$/;

const canonicalOrderIds = (orderIds = []) => [
  ...new Set(orderIds.map(String).filter(Boolean)),
].sort();

const sameStrings = (left = [], right = []) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

function requestError(message, code = "BAD_USER_INPUT") {
  const error = new Error(message);
  error.code = code;
  error.extensions = { code };
  return error;
}

function normalizeIdempotencyKey(value) {
  const key = String(value || "").trim();
  if (key.length < 16 || key.length > 200) {
    throw requestError("idempotencyKey must be between 16 and 200 characters");
  }
  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
    throw requestError("idempotencyKey contains unsupported characters");
  }
  return key;
}

export function fingerprintWalletPaymentRequest({
  userId,
  restaurantId,
  orderIds = [],
}) {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        operation: "cohan_wallet_payment_v1",
        userId: String(userId),
        restaurantId: String(restaurantId),
        orderIds: canonicalOrderIds(orderIds),
      }),
    )
    .digest("hex");
}

function storedOrderIds(transaction, paymentSession) {
  return canonicalOrderIds([
    transaction?.orderId,
    ...(transaction?.orderIds || []),
    ...(paymentSession?.metadata?.orderIds || []),
  ]);
}

function assertRequestMatches({
  transaction,
  paymentSession,
  userId,
  restaurantId,
  requestFingerprint,
  orderIds,
}) {
  const storedFingerprint =
    transaction?.meta?.requestFingerprint ||
    paymentSession?.metadata?.requestFingerprint;
  const actualOrderIds = storedOrderIds(transaction, paymentSession);
  const ownerMismatch = Boolean(
    paymentSession &&
      (String(paymentSession.userId || "") !== String(userId) ||
        String(paymentSession.restaurantId || "") !== String(restaurantId)),
  );

  if (
    ownerMismatch ||
    (storedFingerprint && storedFingerprint !== requestFingerprint) ||
    (actualOrderIds.length && !sameStrings(actualOrderIds, orderIds))
  ) {
    throw requestError(
      "idempotencyKey was already used for another wallet payment payload",
      "IDEMPOTENCY_KEY_REUSED",
    );
  }

  return actualOrderIds.length ? actualOrderIds : orderIds;
}

async function attachIdempotencyMetadata({
  userId,
  restaurantId,
  paymentTransactionId,
  idempotencyKey,
  requestFingerprint,
}) {
  await Promise.all([
    PaymentSession.updateOne(
      { provider: WALLET_PROVIDER, reference: idempotencyKey },
      {
        $set: {
          "metadata.correlationId": idempotencyKey,
          "metadata.requestFingerprint": requestFingerprint,
        },
      },
    ),
    PaymentTransaction.updateOne(
      { _id: paymentTransactionId, restaurantId, userId },
      {
        $set: {
          "meta.correlationId": idempotencyKey,
          "meta.requestFingerprint": requestFingerprint,
        },
      },
    ),
    WalletTransaction.updateOne(
      {
        userId,
        type: "PAYMENT",
        referenceId: paymentTransactionId,
      },
      {
        $set: {
          "metadata.correlationId": idempotencyKey,
          "metadata.requestFingerprint": requestFingerprint,
        },
      },
    ),
    EventLog.updateOne(
      {
        restaurantId,
        verb: "order.pay",
        "object.kind": "PaymentTransaction",
        "object.id": paymentTransactionId,
      },
      {
        $set: {
          correlationId: idempotencyKey,
          "meta.correlationId": idempotencyKey,
          "meta.requestFingerprint": requestFingerprint,
        },
      },
    ),
  ]);
}

export async function payOrdersWithWallet({
  userId,
  restaurantId,
  orderIds = [],
  idempotencyKey,
}) {
  if (!mongoose.isValidObjectId(userId)) {
    throw requestError("Unauthorized", "UNAUTHENTICATED");
  }
  if (!mongoose.isValidObjectId(restaurantId)) {
    throw requestError("Invalid restaurantId");
  }

  const normalizedOrderIds = canonicalOrderIds(orderIds);
  if (
    !normalizedOrderIds.length ||
    normalizedOrderIds.some((orderId) => !mongoose.isValidObjectId(orderId))
  ) {
    throw requestError("Invalid orderIds");
  }

  const key = normalizeIdempotencyKey(idempotencyKey);
  const uid = new mongoose.Types.ObjectId(userId);
  const rid = new mongoose.Types.ObjectId(restaurantId);
  const requestFingerprint = fingerprintWalletPaymentRequest({
    userId: uid,
    restaurantId: rid,
    orderIds: normalizedOrderIds,
  });

  const [existingTransaction, existingSession] = await Promise.all([
    PaymentTransaction.findOne({
      restaurantId: rid,
      userId: uid,
      method: "e_wallet",
      externalRef: key,
      status: "SUCCESS",
    }).lean(),
    PaymentSession.findOne({
      provider: WALLET_PROVIDER,
      reference: key,
    }).lean(),
  ]);

  if (existingTransaction || existingSession) {
    assertRequestMatches({
      transaction: existingTransaction,
      paymentSession: existingSession,
      userId: uid,
      restaurantId: rid,
      requestFingerprint,
      orderIds: normalizedOrderIds,
    });
  }

  const result = await settleOrdersWithWallet({
    userId: uid,
    restaurantId: rid,
    orderIds: normalizedOrderIds,
    idempotencyKey: key,
  });

  const [settledTransaction, settledSession] = await Promise.all([
    PaymentTransaction.findOne({
      _id: result?.paymentTransactionId,
      restaurantId: rid,
      userId: uid,
      method: "e_wallet",
      externalRef: key,
      status: "SUCCESS",
    }).lean(),
    PaymentSession.findOne({
      provider: WALLET_PROVIDER,
      reference: key,
    }).lean(),
  ]);

  if (!settledTransaction) {
    throw new Error("Wallet payment transaction was not persisted");
  }

  const settledOrderIds = assertRequestMatches({
    transaction: settledTransaction,
    paymentSession: settledSession,
    userId: uid,
    restaurantId: rid,
    requestFingerprint,
    orderIds: normalizedOrderIds,
  });

  // Metadata is observability-only; a write failure must not turn a committed debit
  // into a client-visible payment failure. Order IDs remain the legacy safety fallback.
  await attachIdempotencyMetadata({
    userId: uid,
    restaurantId: rid,
    paymentTransactionId: settledTransaction._id,
    idempotencyKey: key,
    requestFingerprint,
  }).catch(() => {});

  return {
    ...result,
    orderIds: settledOrderIds,
  };
}
