import mongoose from "mongoose";
import { PaymentSession } from "../../../models/index.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";
import { sanitizePaymentSessionForClient } from "../../../src/services/payment/paymentSession.service.js";
import { expireStaleTransferPayments } from "../../../src/services/payment/transferExpiry.service.js";

const toObjectId = (value) =>
  value && mongoose.isValidObjectId(value) ? new mongoose.Types.ObjectId(value) : null;

export const BankTransferPaymentQuery = {
  async transferPaymentQueue(_parent, { restaurantId, status, statuses, limit = 50 }, ctx) {
    const rid = toObjectId(restaurantId);
    if (!rid) throw new Error("Invalid restaurantId");
    await requireRestaurantPermission(ctx, rid, PERMISSIONS.PAYMENT_READ);

    await expireStaleTransferPayments({ now: new Date(), limit: 100, io: ctx?.io }).catch(() => {});
    const filter = { restaurantId: rid, provider: "bank_transfer" };
    if (Array.isArray(statuses) && statuses.length) {
      filter["transfer.status"] = { $in: statuses.map((x) => String(x).toUpperCase()) };
    } else if (status) {
      filter["transfer.status"] = String(status).toUpperCase();
    } else {
      filter["transfer.status"] = { $in: ["SUBMITTED", "VERIFYING", "REJECTED", "VERIFIED"] };
    }

    const safeLimit = Math.min(Math.max(Number(limit || 50), 1), 100);
    const rows = await PaymentSession.find(filter)
      .sort({ "transfer.submittedAt": -1, createdAt: -1 })
      .limit(safeLimit);

    return rows.map((row) => sanitizePaymentSessionForClient(row, { includeRaw: false }));
  },
};

export default BankTransferPaymentQuery;
