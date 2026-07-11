import { GraphQLError } from "graphql";
import CheckoutRequestLock from "../../../models/checkout-request-lock.model.js";
import { CheckoutSession, Order } from "../../../models/index.js";
import {
  CLAIM_TTL_MS,
  PROCESSING_POLL_MS,
  PROCESSING_WAIT_MS,
  assertClaimMatches,
  delay,
} from "./checkoutIdempotency.utils.js";

export async function loadCheckoutResult({ key, claim, userId = null }) {
  const ownerId = claim?.userId || userId || null;
  let checkoutCode = claim?.checkoutCode || null;
  let orderIds = Array.isArray(claim?.orderIds) ? claim.orderIds : [];
  let grandTotal = null;

  if (!orderIds.length) {
    const checkoutFilter = { idempotencyKey: key };
    if (ownerId) checkoutFilter.userId = ownerId;
    const checkout = await CheckoutSession.findOne(checkoutFilter).lean();
    if (checkout?.orderIds?.length) {
      checkoutCode = checkout.checkoutCode;
      orderIds = checkout.orderIds;
      grandTotal = Number(checkout?.totals?.grandTotal || 0);
    }
  }

  if (!orderIds.length) return null;

  const orderFilter = { _id: { $in: orderIds } };
  if (ownerId) orderFilter.userId = ownerId;
  const orders = await Order.find(orderFilter).lean({
    virtuals: true,
  });
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

export async function claimCheckout({ key, userId, requestFingerprint }) {
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
  if (claim?.status === "COMPLETED") return { owner: false, claim };

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

export async function markCheckoutCompleted({ key, result }) {
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

export async function markCheckoutFailed({ key, error }) {
  await CheckoutRequestLock.updateOne(
    { key, status: "PROCESSING" },
    {
      $set: {
        status: "FAILED",
        failedAt: new Date(),
        errorCode:
          error?.extensions?.code || error?.code || "CHECKOUT_FAILED",
        errorMessage: String(error?.message || "Checkout failed").slice(0, 500),
        expiresAt: new Date(Date.now() + CLAIM_TTL_MS),
      },
    },
  );
}
