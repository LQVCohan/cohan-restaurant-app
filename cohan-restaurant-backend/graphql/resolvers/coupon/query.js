import mongoose from "mongoose";
import { Coupon, VoucherPackage } from "../../../models/index.js";

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function buildActiveQuery(activeOnly, now) {
  if (!activeOnly) return {};
  const nowDate = now ? new Date(now) : new Date();
  return {
    isActive: true,
    $or: [
      { startAt: { $exists: false }, endAt: { $exists: false } },
      { startAt: { $lte: nowDate }, endAt: { $gte: nowDate } },
      { startAt: { $lte: nowDate }, endAt: { $exists: false } },
      { startAt: { $exists: false }, endAt: { $gte: nowDate } },
    ],
  };
}

export const CouponQuery = {
  async coupons(_, { restaurantId, activeOnly = true, limit = 50, offset = 0, now }) {
    const safeLimit = clamp(limit, 1, 200);
    const safeOffset = Math.max(0, Number(offset) || 0);

    const query = buildActiveQuery(activeOnly, now);
    if (restaurantId && mongoose.isValidObjectId(restaurantId)) {
      query.restaurantId = new mongoose.Types.ObjectId(restaurantId);
    }

    return Coupon.find(query)
      .sort({ startAt: -1, _id: -1 })
      .skip(safeOffset)
      .limit(safeLimit)
      .lean({ virtuals: true });
  },

  async couponByCode(_, { code }) {
    const norm = String(code || "").trim().toUpperCase();
    if (!norm) return null;
    return Coupon.findOne({ code: norm }).lean({ virtuals: true });
  },

  async voucherPackages(_, { restaurantId }) {
    const query = {};
    if (restaurantId && mongoose.isValidObjectId(restaurantId)) {
      query.restaurantId = new mongoose.Types.ObjectId(restaurantId);
    }
    return VoucherPackage.find(query).sort({ createdAt: -1, _id: -1 }).lean({ virtuals: true });
  },
};
