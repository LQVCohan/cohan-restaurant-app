import mongoose from "mongoose";
import { PaymentSession } from "../../../models/index.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";
import { sanitizePaymentSessionForClient } from "../../../src/services/payment/paymentSession.service.js";
import { expireStaleTransferPayments } from "../../../src/services/payment/transferExpiry.service.js";

const AWAITING_PROOF_STATUS = "INSTRUCTIONS_SHOWN";
const ACTIONABLE_QUEUE_STATUSES = ["SUBMITTED", "VERIFYING"];
const DEFAULT_QUEUE_STATUSES = [
  AWAITING_PROOF_STATUS,
  ...ACTIONABLE_QUEUE_STATUSES,
  "REJECTED",
  "VERIFIED",
];
const REVIEW_QUEUE_STATUSES = [...DEFAULT_QUEUE_STATUSES, "FAILED", "EXPIRED"];

const toObjectId = (value) =>
  value && mongoose.isValidObjectId(value) ? new mongoose.Types.ObjectId(value) : null;

async function requirePaymentReadScope(restaurantId, ctx) {
  const rid = toObjectId(restaurantId);
  if (!rid) throw new Error("Invalid restaurantId");
  await requireRestaurantPermission(ctx, rid, PERMISSIONS.PAYMENT_READ);
  return rid;
}

export function normalizeTransferQueueStatuses({ status, statuses } = {}) {
  if (Array.isArray(statuses) && statuses.length) {
    const normalized = Array.from(
      new Set(statuses.map((value) => String(value || "").toUpperCase()).filter(Boolean)),
    );
    const isManagerOpenQueue = ACTIONABLE_QUEUE_STATUSES.every((value) =>
      normalized.includes(value),
    );

    // The manager screen historically asks for SUBMITTED + VERIFYING for its
    // default queue and for the broader all-status queue. A newly created bank
    // transfer is still INSTRUCTIONS_SHOWN until the customer uploads proof, so
    // include it in those open queues instead of making the payment disappear.
    if (isManagerOpenQueue && !normalized.includes(AWAITING_PROOF_STATUS)) {
      normalized.unshift(AWAITING_PROOF_STATUS);
    }
    return normalized;
  }

  if (status) return [String(status).toUpperCase()];
  return [...DEFAULT_QUEUE_STATUSES];
}

export const BankTransferPaymentQuery = {
  async transferPaymentQueue(_parent, { restaurantId, status, statuses, limit = 50 }, ctx) {
    const rid = await requirePaymentReadScope(restaurantId, ctx);

    await expireStaleTransferPayments({ now: new Date(), limit: 100, io: ctx?.io }).catch(() => {});
    const requestedStatuses = normalizeTransferQueueStatuses({ status, statuses });
    const filter = {
      restaurantId: rid,
      provider: "bank_transfer",
      "transfer.status": { $in: requestedStatuses },
    };

    const safeLimit = Math.min(Math.max(Number(limit || 50), 1), 100);
    const rows = await PaymentSession.find(filter)
      .sort({ "transfer.submittedAt": -1, createdAt: -1 })
      .limit(safeLimit);

    return rows.map((row) => sanitizePaymentSessionForClient(row, { includeRaw: false }));
  },

  async transferPaymentQueueSummary(_parent, { restaurantId }, ctx) {
    const rid = await requirePaymentReadScope(restaurantId, ctx);

    await expireStaleTransferPayments({ now: new Date(), limit: 100, io: ctx?.io }).catch(() => {});
    const grouped = await PaymentSession.aggregate([
      {
        $match: {
          restaurantId: rid,
          provider: "bank_transfer",
          "transfer.status": { $in: REVIEW_QUEUE_STATUSES },
        },
      },
      { $group: { _id: "$transfer.status", count: { $sum: 1 } } },
    ]);
    const counts = Object.fromEntries(
      grouped.map(({ _id, count }) => [String(_id || "").toUpperCase(), Number(count || 0)]),
    );
    const awaitingProof = counts.INSTRUCTIONS_SHOWN || 0;
    const submitted = counts.SUBMITTED || 0;
    const verifying = counts.VERIFYING || 0;
    const rejected = counts.REJECTED || 0;
    const verified = counts.VERIFIED || 0;
    const failed = counts.FAILED || 0;
    const expired = counts.EXPIRED || 0;

    return {
      total: awaitingProof + submitted + verifying + rejected + verified + failed + expired,
      actionable: awaitingProof + submitted + verifying,
      submitted,
      verifying,
      rejected,
      verified,
      failed,
      expired,
    };
  },
};

export default BankTransferPaymentQuery;
