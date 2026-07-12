import crypto from "node:crypto";
import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import PaymentRequestLock from "../../../models/payment-request-lock.model.js";

const KEY_PATTERN = /^[A-Za-z0-9:_-]+$/;
const PROCESSING_WAIT_MS = 3000;
const PROCESSING_POLL_MS = 250;
const STALE_PROCESSING_MS = 2 * 60 * 1000;
const PROCESSING_TTL_MS = 24 * 60 * 60 * 1000;
const FAILED_TTL_MS = 24 * 60 * 60 * 1000;
const COMPLETED_TTL_MS = 90 * 24 * 60 * 60 * 1000;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function paymentError(message, code, extra = {}) {
  return new GraphQLError(message, {
    extensions: { code, ...extra },
  });
}

export function normalizePaymentIdempotencyKey(value) {
  const key = String(value || "").trim();
  if (key.length < 16 || key.length > 200) {
    throw paymentError(
      "idempotencyKey must be between 16 and 200 characters",
      "BAD_USER_INPUT",
    );
  }
  if (!KEY_PATTERN.test(key)) {
    throw paymentError(
      "idempotencyKey contains unsupported characters",
      "BAD_USER_INPUT",
    );
  }
  return key;
}

export function canonicalizePaymentValue(value) {
  if (Array.isArray(value)) return value.map(canonicalizePaymentValue);
  if (!value || typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();

  return Object.keys(value)
    .filter((key) => key !== "idempotencyKey")
    .sort()
    .reduce((result, key) => {
      result[key] = canonicalizePaymentValue(value[key]);
      return result;
    }, {});
}

export function fingerprintPaymentRequest({
  operation,
  userId,
  restaurantId = null,
  input = {},
}) {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        operation: String(operation || ""),
        userId: String(userId || ""),
        restaurantId: restaurantId ? String(restaurantId) : null,
        input: canonicalizePaymentValue(input),
      }),
    )
    .digest("hex");
}

function jsonSafe(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

function sameId(left, right) {
  return String(left || "") === String(right || "");
}

function assertClaimMatches(claim, expected) {
  if (
    !claim ||
    claim.operation !== expected.operation ||
    !sameId(claim.userId, expected.userId) ||
    !sameId(claim.restaurantId, expected.restaurantId) ||
    claim.requestFingerprint !== expected.requestFingerprint
  ) {
    throw paymentError(
      "idempotencyKey was already used for another payment request",
      "IDEMPOTENCY_KEY_REUSED",
    );
  }
}

async function waitForClaim(key) {
  const deadline = Date.now() + PROCESSING_WAIT_MS;
  while (Date.now() < deadline) {
    await delay(PROCESSING_POLL_MS);
    const claim = await PaymentRequestLock.findOne({ key }).lean();
    if (!claim || claim.status !== "PROCESSING") return claim;
  }
  return PaymentRequestLock.findOne({ key }).lean();
}

async function markCompleted({ key, result }) {
  const resultPayload = jsonSafe(result);
  await PaymentRequestLock.updateOne(
    { key },
    {
      $set: {
        status: "COMPLETED",
        resultPayload,
        completedAt: new Date(),
        failedAt: null,
        errorCode: null,
        errorMessage: null,
        expiresAt: new Date(Date.now() + COMPLETED_TTL_MS),
      },
    },
  );
  return resultPayload;
}

async function markFailed({ key, error }) {
  await PaymentRequestLock.updateOne(
    { key, status: "PROCESSING" },
    {
      $set: {
        status: "FAILED",
        failedAt: new Date(),
        errorCode: error?.extensions?.code || error?.code || "PAYMENT_FAILED",
        errorMessage: String(error?.message || "Payment failed").slice(0, 500),
        expiresAt: new Date(Date.now() + FAILED_TTL_MS),
      },
    },
  );
}

async function recoverCompleted({ recover, claim, key, requestFingerprint }) {
  if (typeof recover !== "function") return null;
  const recovered = await recover({ claim, key, requestFingerprint });
  if (recovered == null) return null;
  return markCompleted({ key, result: recovered });
}

async function claimPaymentRequest({
  key,
  operation,
  userId,
  restaurantId,
  requestFingerprint,
  recover,
}) {
  const expected = {
    operation,
    userId,
    restaurantId,
    requestFingerprint,
  };
  let inserted = false;

  try {
    const result = await PaymentRequestLock.updateOne(
      { key },
      {
        $setOnInsert: {
          key,
          operation,
          userId,
          restaurantId: restaurantId || undefined,
          requestFingerprint,
          status: "PROCESSING",
          attempts: 1,
          startedAt: new Date(),
          expiresAt: new Date(Date.now() + PROCESSING_TTL_MS),
        },
      },
      { upsert: true },
    );
    inserted = Boolean(result?.upsertedCount);
  } catch (error) {
    if (error?.code !== 11000) throw error;
  }

  let claim = await PaymentRequestLock.findOne({ key }).lean();
  assertClaimMatches(claim, expected);
  if (inserted) return { owner: true, claim };
  if (claim.status === "COMPLETED") {
    return { owner: false, claim, result: claim.resultPayload };
  }

  if (claim.status === "PROCESSING") {
    claim = await waitForClaim(key);
    assertClaimMatches(claim, expected);
    if (claim.status === "COMPLETED") {
      return { owner: false, claim, result: claim.resultPayload };
    }
    if (claim.status === "FAILED") {
      const recovered = await recoverCompleted({
        recover,
        claim,
        key,
        requestFingerprint,
      });
      if (recovered != null) return { owner: false, claim, result: recovered };
    } else {
      const startedAt = new Date(claim.startedAt || 0).getTime();
      if (Date.now() - startedAt < STALE_PROCESSING_MS) {
        throw paymentError("Payment is already being processed", "PAYMENT_IN_PROGRESS", {
          retryAfterMs: 1000,
        });
      }

      const recovered = await recoverCompleted({
        recover,
        claim,
        key,
        requestFingerprint,
      });
      if (recovered != null) return { owner: false, claim, result: recovered };

      const reclaimed = await PaymentRequestLock.findOneAndUpdate(
        {
          _id: claim._id,
          status: "PROCESSING",
          startedAt: claim.startedAt,
          requestFingerprint,
        },
        {
          $set: {
            startedAt: new Date(),
            expiresAt: new Date(Date.now() + PROCESSING_TTL_MS),
          },
          $inc: { attempts: 1 },
        },
        { new: true },
      ).lean();
      if (reclaimed) return { owner: true, claim: reclaimed };
    }
  }

  if (claim.status === "FAILED") {
    const recovered = await recoverCompleted({
      recover,
      claim,
      key,
      requestFingerprint,
    });
    if (recovered != null) return { owner: false, claim, result: recovered };

    const reclaimed = await PaymentRequestLock.findOneAndUpdate(
      {
        _id: claim._id,
        status: "FAILED",
        operation,
        userId,
        requestFingerprint,
      },
      {
        $set: {
          status: "PROCESSING",
          startedAt: new Date(),
          failedAt: null,
          errorCode: null,
          errorMessage: null,
          expiresAt: new Date(Date.now() + PROCESSING_TTL_MS),
        },
        $inc: { attempts: 1 },
      },
      { new: true },
    ).lean();
    if (reclaimed) return { owner: true, claim: reclaimed };
  }

  throw paymentError("Payment request could not be claimed", "PAYMENT_IN_PROGRESS", {
    retryAfterMs: 1000,
  });
}

export async function runIdempotentPaymentRequest({
  idempotencyKey,
  operation,
  userId,
  restaurantId = null,
  input = {},
  execute,
  recover,
}) {
  const key = normalizePaymentIdempotencyKey(idempotencyKey);
  if (!mongoose.isValidObjectId(userId)) {
    throw paymentError("Unauthorized", "UNAUTHENTICATED");
  }
  if (restaurantId && !mongoose.isValidObjectId(restaurantId)) {
    throw paymentError("Invalid restaurantId", "BAD_USER_INPUT");
  }

  const uid = new mongoose.Types.ObjectId(userId);
  const rid = restaurantId ? new mongoose.Types.ObjectId(restaurantId) : null;
  const requestFingerprint = fingerprintPaymentRequest({
    operation,
    userId: uid,
    restaurantId: rid,
    input,
  });
  const claimed = await claimPaymentRequest({
    key,
    operation,
    userId: uid,
    restaurantId: rid,
    requestFingerprint,
    recover,
  });
  if (!claimed.owner) return claimed.result;

  try {
    const result = await execute({
      claim: claimed.claim,
      key,
      requestFingerprint,
    });
    await markCompleted({ key, result });
    return result;
  } catch (error) {
    try {
      const recovered = await recoverCompleted({
        recover,
        claim: claimed.claim,
        key,
        requestFingerprint,
      });
      if (recovered != null) return recovered;
    } catch (recoveryError) {
      if (recoveryError?.extensions?.code === "IDEMPOTENCY_KEY_REUSED") {
        await markFailed({ key, error: recoveryError });
        throw recoveryError;
      }
    }
    await markFailed({ key, error });
    throw error;
  }
}
