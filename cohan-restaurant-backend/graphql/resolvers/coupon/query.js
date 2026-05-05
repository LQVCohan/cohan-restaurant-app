import { GraphQLError } from "graphql";
import mongoose from "mongoose";
import { Coupon, VoucherPackage } from "../../../models/index.js";

function toObjectId(value) {
  if (!value || !mongoose.isValidObjectId(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

function buildActiveQuery(activeOnly, now) {
  if (!activeOnly) return {};
  const nowDate = now ? new Date(now) : new Date();
  return {
    isActive: true,
    $and: [
      { $or: [{ publishAt: { $exists: false } }, { publishAt: null }, { publishAt: { $lte: nowDate } }] },
      { $or: [{ startAt: { $exists: false } }, { startAt: null }, { startAt: { $lte: nowDate } }] },
      { $or: [{ endAt: { $exists: false } }, { endAt: null }, { endAt: { $gte: nowDate } }] },
      { $or: [{ maxUsage: { $lte: 0 } }, { $expr: { $lt: ["$used", "$maxUsage"] } }] },
    ],
  };
}

function requireRestaurantIdForCouponLookup(restaurantId) {
  const rid = toObjectId(restaurantId);
  if (!rid) {
    throw new GraphQLError("restaurantId is required for coupon lookup");
  }
  return rid;
}

export const CouponQuery = {
  async coupons(_, { restaurantId, activeOnly = false, limit = 50, offset = 0, now } = {}) {
    const query = {
      ...(restaurantId ? { restaurantId: toObjectId(restaurantId) || restaurantId } : {}),
      ...buildActiveQuery(activeOnly, now),
    };

    return Coupon.find(query)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean({ virtuals: true });
  },

  async couponByCode(_, { code, restaurantId } = {}) {
    const norm = String(code || "").trim().toUpperCase();
    if (!norm) return null;

    const rid = requireRestaurantIdForCouponLookup(restaurantId);
    return Coupon.findOne({ code: norm, restaurantId: rid }).lean({ virtuals: true });
  },

  async voucherPackages(_, { restaurantId } = {}) {
    const query = restaurantId ? { restaurantId: toObjectId(restaurantId) || restaurantId } : {};
    return VoucherPackage.find(query)
      .sort({ level: 1, createdAt: -1 })
      .lean({ virtuals: true });
  },
};

export default CouponQuery;
