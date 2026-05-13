import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { CouponRedemption } from "../../../models/index.js";
import { requireAuth, requireRestaurantAccess } from "../../guards.js";

function toObjectId(value, fieldName = "id") {
  if (!value || !mongoose.isValidObjectId(value)) {
    throw new GraphQLError(`Invalid ${fieldName}`);
  }
  return new mongoose.Types.ObjectId(value);
}

function optionalObjectId(value, fieldName) {
  return value ? toObjectId(value, fieldName) : null;
}

function normalizeLimit(limit) {
  const parsed = Number(limit ?? 50);
  if (!Number.isFinite(parsed)) return 50;
  return Math.min(100, Math.max(1, Math.trunc(parsed)));
}

function normalizeOffset(offset) {
  const parsed = Number(offset ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.trunc(parsed));
}

const CouponRedemptionResolvers = {
  Query: {
    async myCouponRedemptions(_, { restaurantId, couponId } = {}, ctx) {
      requireAuth(ctx);
      const userId = toObjectId(ctx.user.id || ctx.user._id, "userId");
      const filter = { userId };

      const rid = optionalObjectId(restaurantId, "restaurantId");
      if (rid) filter.restaurantId = rid;

      const cid = optionalObjectId(couponId, "couponId");
      if (cid) filter.couponId = cid;

      return CouponRedemption.find(filter)
        .populate("couponId")
        .sort({ redeemedAt: -1, createdAt: -1 })
        .lean({ virtuals: true });
    },

    async couponRedemptionsByRestaurant(
      _,
      { restaurantId, couponId, limit = 50, offset = 0 } = {},
      ctx,
    ) {
      const rid = toObjectId(restaurantId, "restaurantId");
      await requireRestaurantAccess(ctx, rid);

      const filter = { restaurantId: rid };
      const cid = optionalObjectId(couponId, "couponId");
      if (cid) filter.couponId = cid;

      return CouponRedemption.find(filter)
        .populate("couponId")
        .sort({ redeemedAt: -1, createdAt: -1 })
        .skip(normalizeOffset(offset))
        .limit(normalizeLimit(limit))
        .lean({ virtuals: true });
    },
  },

  CouponRedemption: {
    id(parent) {
      return String(parent.id || parent._id || "");
    },
    couponId(parent) {
      const coupon = parent.couponId;
      return String(coupon?._id || coupon?.id || coupon || "");
    },
    userId(parent) {
      return parent.userId ? String(parent.userId) : null;
    },
    restaurantId(parent) {
      return String(parent.restaurantId || "");
    },
    orderIds(parent) {
      return (parent.orderIds || []).map(String);
    },
    invoiceId(parent) {
      return parent.invoiceId ? String(parent.invoiceId) : null;
    },
    coupon(parent) {
      return (
        parent.coupon ||
        (typeof parent.couponId === "object" ? parent.couponId : null)
      );
    },
  },
};

export default CouponRedemptionResolvers;
