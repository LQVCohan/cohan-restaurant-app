import { GraphQLError } from "graphql";
import mongoose from "mongoose";
import { Coupon, VoucherPackage } from "../../../models/index.js";
import { requireRoles } from "../../guards.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";

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

function buildVoucherPackageActiveQuery(activeOnly, now) {
  if (!activeOnly) return {};
  const nowDate = now ? new Date(now) : new Date();
  return {
    isActive: true,
    $and: [
      { $or: [{ publishAt: { $exists: false } }, { publishAt: null }, { publishAt: { $lte: nowDate } }] },
      { $or: [{ startAt: { $exists: false } }, { startAt: null }, { startAt: { $lte: nowDate } }] },
      { $or: [{ endAt: { $exists: false } }, { endAt: null }, { endAt: { $gte: nowDate } }] },
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
  async coupons(_, { restaurantId, activeOnly = true, limit = 50, offset = 0, now } = {}, ctx) {
    const activeQuery = buildActiveQuery(activeOnly, now);

    if (restaurantId) {
      const rid = toObjectId(restaurantId);
      if (!rid) throw new GraphQLError("Invalid restaurantId");
      if (!activeOnly) {
        await requireRestaurantPermission(ctx, rid, PERMISSIONS.COUPON_READ);
      }
      return Coupon.find({ restaurantId: rid, ...activeQuery })
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .lean({ virtuals: true });
    }

    requireRoles(ctx, ["ADMIN"]);
    return Coupon.find(activeQuery)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean({ virtuals: true });
  },

  async couponByCode(_, { code, restaurantId } = {}, ctx) {
    const norm = String(code || "").trim().toUpperCase();
    if (!norm) return null;

    const rid = requireRestaurantIdForCouponLookup(restaurantId);
    return Coupon.findOne({
      code: norm,
      restaurantId: rid,
      ...buildActiveQuery(true),
    }).lean({ virtuals: true });
  },

  async voucherPackages(_, { restaurantId, activeOnly = true, now } = {}, ctx) {
    const activeQuery = buildVoucherPackageActiveQuery(activeOnly, now);

    if (restaurantId) {
      const rid = toObjectId(restaurantId);
      if (!rid) throw new GraphQLError("Invalid restaurantId");
      if (!activeOnly) {
        await requireRestaurantPermission(ctx, rid, PERMISSIONS.COUPON_READ);
      }
      return VoucherPackage.find({ restaurantId: rid, ...activeQuery })
        .sort({ level: 1, createdAt: -1 })
        .lean({ virtuals: true });
    }

    requireRoles(ctx, ["ADMIN"]);
    return VoucherPackage.find(activeQuery)
      .sort({ level: 1, createdAt: -1 })
      .lean({ virtuals: true });
  },
};

export default CouponQuery;
