import mongoose from "mongoose";
import { PaymentSession } from "../../../models/index.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";
import { sanitizePaymentSessionForClient } from "../../../src/services/payment/paymentSession.service.js";
import { expireStaleTransferPayments } from "../../../src/services/payment/transferExpiry.service.js";

const DEFAULT_QUEUE_STATUSES = ["SUBMITTED", "VERIFYING", "REJECTED", "VERIFIED"];
const REVIEW_QUEUE_STATUSES = [...DEFAULT_QUEUE_STATUSES, "FAILED", "EXPIRED"];

const toObjectId = (value) =>
  value && mongoose.isValidObjectId(value) ? new mongoose.Types.ObjectId(value) : null;

async function requirePaymentReadScope(restaurantId, ctx) {
  const rid = toObjectId(restaurantId);
  if (!rid) throw new Error("Invalid restaurantId");
  await requireRestaurantPermission(ctx, rid, PERMISSIONS.PAYMENT_READ);
  return rid;
}

export const BankTransferPaymentQuery = {
  async transferPaymentQueue(_parent, { restaurantId, status, statuses, limit = 50 }, ctx) {
    const rid = await requirePaymentReadScope(restaurantId, ctx);

    await expireStaleTransferPayments({ now: new Date(), limit: 100, io: ctx?.io }).catch(() => {});
    const filter = { restaurantId: rid, provider: "bank_transfer" };
    if (Array.isArray(statuses) && statuses.length) {
      filter["transfer.status"] = { $in: statuses.map((value) => String(value).toUpperCase()) };
    } else if (status) {
      filter["transfer.status"] = String(status).toUpperCase();
    } else {
      filter["transfer.status"] = { $in: DEFAULT_QUEUE_STATUSES };
    }

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
    const submitted = counts.SUBMITTED || 0;
    const verifying = counts.VERIFYING || 0;
    const rejected = counts.REJECTED || 0;
    const verified = counts.VERIFIED || 0;
    const failed = counts.FAILED || 0;
    const expired = counts.EXPIRED || 0;

    return {
      total: submitted + verifying + rejected + verified + failed + expired,
      actionable: submitted + verifying,
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
