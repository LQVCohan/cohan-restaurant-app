import crypto from "crypto";
import { GraphQLError } from "graphql";
import {
  CheckoutRequestLock,
  CheckoutSession,
  Order,
} from "../../../models/index.js";

const CLAIM_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PROCESSING_WAIT_MS = 3000;
const PROCESSING_POLL_MS = 250;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizeKey(input = {}) {
  const value = String(
    input.idempotencyKey || input.clientMeta?.idempotencyKey || "",
  ).trim();

  if (!value) {
    throw new GraphQLError("idempotencyKey is required for checkout", {
      extensions: { code: "IDEMPOTENCY_KEY_REQUIRED" },
    });
  }

  if (value.length < 16 || value.length > 200) {
    throw new GraphQLError("idempotencyKey must be between 16 and 200 characters", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  if (!/^[A-Za-z0-9:_-]+$/.test(value)) {
    throw new GraphQLError("idempotencyKey contains unsupported characters", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  return value;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;

  return Object.keys(value)
    .filter((key) => key !== "idempotencyKey")
    .sort()
    .reduce((acc, key) => {
      acc[key] = canonicalize(value[key]);
      return acc;
    }, {});
}

function fingerprintInput(input = {}) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(canonicalize(input)))
    .digest("hex");
}

function resolveUserId(ctx) {
  return ctx?.user?.id || ctx?.user?._id || null;
}

function assertClaimMatches(claim, { userId, requestFingerprint }) {
  if (!claim) return;

  if (String(claim.userId || "") !== String(userId || "")) {
    throw new GraphQLError("idempotencyKey belongs to another account", {
      extensions: { code: "IDEMPOTENCY_KEY_REUSED" },
    });
  }

  if (claim.requestFingerprint !== requestFingerprint) {
    throw new GraphQLError("idempotencyKey was already used for another checkout payload", {
      extensions: { code: "IDEMPOTENCY_KEY_REUSED" },
    });
  }
}

async function loadCheckoutResult({ key, claim }) {
  let checkoutCode = claim?.checkoutCode || null;
  let orderIds = Array.isArray(claim?.orderIds) ? claim.orderIds : [];
  let grandTotal = null;

  if (!orderIds.length) {
    const checkout = await CheckoutSession.findOne({ idempotencyKey: key }).lean();
    if (checkout?.orderIds?.length) {
      checkoutCode = checkout.checkoutCode;
      orderIds = checkout.orderIds;
      grandTotal = Number(checkout?.totals?.grandTotal || 0);
    }
  }

  if (!orderIds.length) return null;

  const orders = await Order.find({ _id: { $in: orderIds } }).lean({ virtuals: true });
  const byId = new Map(orders.map((order) => [String(order._id), order]));
  const ordered = orderIds.map((id) => byId.get(String(id))).filter(Boolean);

  if (grandTotal == null) {
    grandTotal = ordered.reduce(
      (sum, order) => sum + Number(order?.totals?.grandTotal || 0),
      0,
    );
  }

  return {
    checkout: {
      checkoutCode,
      orderIds: orderIds.map(String),
      grandTotal: Math.round(grandTotal),
    },
    orders: ordered,
  };
}

async function waitForClaim(key) {
  const deadline = Date.now() + PROCESSING_WAIT_MS;

  while (Date.now() < deadline) {
    await delay(PROCESSING_POLL_MS);
    const claim = await CheckoutRequestLock.findOne({ key }).lean();
    if (!claim || claim.status !== "PROCESSING") return claim;
  }

  return CheckoutRequestLock.findOne({ key }).lean();
}

async function claimCheckout({ key, userId, requestFingerprint }) {
  const expiresAt = new Date(Date.now() + CLAIM_TTL_MS);
  let inserted = false;

  try {
    const result = await CheckoutRequestLock.updateOne(
      { key },
      {
        $setOnInsert: {
          key,
          userId,
          requestFingerprint,
          status: "PROCESSING",
          attempts: 1,
          startedAt: new Date(),
          expiresAt,
        },
      },
      { upsert: true },
    );
    inserted = Boolean(result?.upsertedCount);
  } catch (error) {
    if (error?.code !== 11000) throw error;
  }

  let claim = await CheckoutRequestLock.findOne({ key }).lean();
  assertClaimMatches(claim, { userId, requestFingerprint });

  if (inserted) return { owner: true, claim };

  if (claim?.status === "COMPLETED") {
    return { owner: false, claim };
  }

  if (claim?.status === "PROCESSING") {
    claim = await waitForClaim(key);
    assertClaimMatches(claim, { userId, requestFingerprint });
    if (claim?.status === "COMPLETED") return { owner: false, claim };
    if (claim?.status === "PROCESSING") {
      throw new GraphQLError("Checkout is already being processed", {
        extensions: { code: "CHECKOUT_IN_PROGRESS", retryAfterMs: 1000 },
      });
    }
  }

  if (claim?.status === "FAILED") {
    const reclaimed = await CheckoutRequestLock.findOneAndUpdate(
      {
        _id: claim._id,
        status: "FAILED",
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
          expiresAt,
        },
        $inc: { attempts: 1 },
      },
      { new: true },
    ).lean();

    if (reclaimed) return { owner: true, claim: reclaimed };
  }

  throw new GraphQLError("Checkout request could not be claimed", {
    extensions: { code: "CHECKOUT_IN_PROGRESS", retryAfterMs: 1000 },
  });
}

async function markCompleted({ key, result }) {
  const checkout = result?.checkout || {};
  await CheckoutRequestLock.updateOne(
    { key },
    {
      $set: {
        status: "COMPLETED",
        checkoutCode: checkout.checkoutCode || null,
        orderIds: checkout.orderIds || [],
        completedAt: new Date(),
        failedAt: null,
        errorCode: null,
        errorMessage: null,
        expiresAt: new Date(Date.now() + CLAIM_TTL_MS),
      },
    },
  );
}

async function markFailed({ key, error }) {
  await CheckoutRequestLock.updateOne(
    { key, status: "PROCESSING" },
    {
      $set: {
        status: "FAILED",
        failedAt: new Date(),
        errorCode: error?.extensions?.code || error?.code || "CHECKOUT_FAILED",
        errorMessage: String(error?.message || "Checkout failed").slice(0, 500),
        expiresAt: new Date(Date.now() + CLAIM_TTL_MS),
      },
    },
  );
}

export function withCheckoutIdempotency(mutations = {}) {
  const createCheckoutOrders = mutations.createCheckoutOrders;
  if (typeof createCheckoutOrders !== "function") return mutations;

  return {
    ...mutations,
    async createCheckoutOrders(parent, args, ctx, info) {
      const input = args?.input || {};
      const userId = resolveUserId(ctx);

      if (!userId) {
        return createCheckoutOrders.call(this, parent, args, ctx, info);
      }

      const key = normalizeKey(input);
      const requestFingerprint = fingerprintInput(input);
      const claimResult = await claimCheckout({ key, userId, requestFingerprint });

      if (!claimResult.owner) {
        const existing = await loadCheckoutResult({ key, claim: claimResult.claim });
        if (existing) return existing;
        throw new GraphQLError("Checkout result is not available yet", {
          extensions: { code: "CHECKOUT_IN_PROGRESS", retryAfterMs: 1000 },
        });
      }

      try {
        const result = await createCheckoutOrders.call(this, parent, args, ctx, info);
        await markCompleted({ key, result });
        return result;
      } catch (error) {
        const recovered = await loadCheckoutResult({ key, claim: null });
        if (recovered) {
          await markCompleted({ key, result: recovered });
          return recovered;
        }

        await markFailed({ key, error });
        throw error;
      }
    },
  };
}
