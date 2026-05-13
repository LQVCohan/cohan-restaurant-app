import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Coupon, UserCoupon } from "../../../models/index.js";
import { requireAuth } from "../../guards.js";

const SAVED_STATUS = "saved";

function toObjectId(value, fieldName = "id") {
  if (!value || !mongoose.isValidObjectId(value)) {
    throw new GraphQLError(`Invalid ${fieldName}`);
  }
  return new mongoose.Types.ObjectId(value);
}

function currentUserId(ctx) {
  requireAuth(ctx);
  return toObjectId(ctx.user.id || ctx.user._id, "userId");
}

function asDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function assertCouponCanBeSaved(coupon, now = new Date()) {
  if (!coupon) {
    throw new GraphQLError("Coupon not found");
  }

  if (coupon.isActive !== true) {
    throw new GraphQLError("Coupon is not active");
  }

  const publishAt = asDate(coupon.publishAt);
  if (publishAt && publishAt > now) {
    throw new GraphQLError("Coupon is not published yet");
  }

  const startAt = asDate(coupon.startAt);
  if (startAt && startAt > now) {
    throw new GraphQLError("Coupon is not active yet");
  }

  const endAt = asDate(coupon.endAt);
  if (endAt && endAt < now) {
    throw new GraphQLError("Coupon has expired");
  }

  const maxUsage = Number(coupon.maxUsage || 0);
  const used = Number(coupon.used || 0);
  if (maxUsage > 0 && used >= maxUsage) {
    throw new GraphQLError("Coupon usage limit reached");
  }

  if (!coupon.restaurantId) {
    throw new GraphQLError("Coupon is missing restaurant scope");
  }
}

async function populateUserCoupon(userCoupon) {
  if (!userCoupon) return null;

  if (typeof userCoupon.populate === "function") {
    return userCoupon.populate("couponId");
  }

  return userCoupon;
}

const UserCouponResolvers = {
  Query: {
    async myCoupons(_, { restaurantId, status } = {}, ctx) {
      const userId = currentUserId(ctx);
      const filter = { userId };

      if (restaurantId) {
        const rid = toObjectId(restaurantId, "restaurantId");
        filter.restaurantId = rid;
      }

      if (status) {
        filter.status = String(status).trim().toLowerCase();
      }

      return UserCoupon.find(filter)
        .populate("couponId")
        .sort({ savedAt: -1, createdAt: -1 })
        .lean({ virtuals: true });
    },

    async isCouponSaved(_, { couponId }, ctx) {
      const userId = currentUserId(ctx);
      const cid = toObjectId(couponId, "couponId");
      const saved = await UserCoupon.exists({
        userId,
        couponId: cid,
        status: SAVED_STATUS,
      });
      return Boolean(saved);
    },
  },

  Mutation: {
    async saveCoupon(_, { couponId }, ctx) {
      const userId = currentUserId(ctx);
      const cid = toObjectId(couponId, "couponId");
      const coupon = await Coupon.findById(cid);

      assertCouponCanBeSaved(coupon);

      const existing = await UserCoupon.findOne({ userId, couponId: cid });
      if (existing) {
        if (existing.status === SAVED_STATUS) {
          throw new GraphQLError("Coupon already saved");
        }
        throw new GraphQLError("Coupon cannot be saved again");
      }

      try {
        const userCoupon = await UserCoupon.create({
          userId,
          couponId: cid,
          restaurantId: coupon.restaurantId,
          status: SAVED_STATUS,
        });
        return populateUserCoupon(userCoupon);
      } catch (error) {
        if (error?.code === 11000) {
          throw new GraphQLError("Coupon already saved");
        }
        throw error;
      }
    },

    async removeSavedCoupon(_, { couponId }, ctx) {
      const userId = currentUserId(ctx);
      const cid = toObjectId(couponId, "couponId");
      const userCoupon = await UserCoupon.findOne({ userId, couponId: cid });

      if (!userCoupon) {
        return false;
      }

      if (userCoupon.status === "used") {
        throw new GraphQLError("Used coupons cannot be removed");
      }

      if (userCoupon.status !== SAVED_STATUS) {
        return false;
      }

      if (typeof userCoupon.deleteOne === "function") {
        await userCoupon.deleteOne();
      } else {
        await UserCoupon.deleteOne({ _id: userCoupon._id });
      }

      return true;
    },
  },

  UserCoupon: {
    id(parent) {
      return String(parent.id || parent._id || "");
    },
    userId(parent) {
      return String(parent.userId || "");
    },
    couponId(parent) {
      const coupon = parent.couponId;
      return String(coupon?._id || coupon?.id || coupon || "");
    },
    restaurantId(parent) {
      return String(parent.restaurantId || "");
    },
    coupon(parent) {
      return parent.coupon || (typeof parent.couponId === "object" ? parent.couponId : null);
    },
  },
};

export { assertCouponCanBeSaved };
export default UserCouponResolvers;
