import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Coupon, CouponRedemption, UserCoupon } from "../../../models/index.js";
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
    async couponAnalyticsByRestaurant(_, { restaurantId }, ctx) {
      const rid = toObjectId(restaurantId, "restaurantId");
      await requireRestaurantAccess(ctx, rid);

      const now = new Date();
      const soon = new Date(now);
      soon.setDate(soon.getDate() + 7);

      const [
        totalCoupons,
        activeCoupons,
        savedCoupons,
        usedCoupons,
        totalRedemptionResult,
        topCouponRows,
        expiringSoon,
        nearUsageLimitCoupons,
      ] = await Promise.all([
        Coupon.countDocuments({ restaurantId: rid }),

        Coupon.countDocuments({
          restaurantId: rid,
          isActive: true,
          $and: [
            {
              $or: [
                { publishAt: null },
                { publishAt: { $exists: false } },
                { publishAt: { $lte: now } },
              ],
            },
            {
              $or: [
                { startAt: null },
                { startAt: { $exists: false } },
                { startAt: { $lte: now } },
              ],
            },
            {
              $or: [
                { endAt: null },
                { endAt: { $exists: false } },
                { endAt: { $gte: now } },
              ],
            },
          ],
        }),

        UserCoupon.countDocuments({
          restaurantId: rid,
          status: "saved",
        }),

        UserCoupon.countDocuments({
          restaurantId: rid,
          status: "used",
        }),

        CouponRedemption.aggregate([
          { $match: { restaurantId: rid } },
          {
            $group: {
              _id: null,
              totalRedemptions: { $sum: 1 },
              totalDiscountAmount: { $sum: "$discountAmount" },
            },
          },
        ]),

        CouponRedemption.aggregate([
          { $match: { restaurantId: rid } },
          {
            $group: {
              _id: "$couponId",
              usageCount: { $sum: 1 },
              totalDiscount: { $sum: "$discountAmount" },
            },
          },
          { $sort: { usageCount: -1, totalDiscount: -1 } },
          { $limit: 5 },
        ]),

        Coupon.countDocuments({
          restaurantId: rid,
          isActive: true,
          endAt: { $gte: now, $lte: soon },
        }),

        Coupon.find({
          restaurantId: rid,
          maxUsage: { $gt: 0 },
          used: { $gt: 0 },
        })
          .select("_id used maxUsage")
          .lean(),
      ]);

      const couponIds = topCouponRows.map((row) => row._id).filter(Boolean);

      const couponDocs = await Coupon.find({
        _id: { $in: couponIds },
      })
        .select("_id code name")
        .lean();

      const couponMap = new Map(
        couponDocs.map((coupon) => [String(coupon._id), coupon]),
      );

      const totalRedemptions = Number(
        totalRedemptionResult?.[0]?.totalRedemptions || 0,
      );

      const totalDiscountAmount = Number(
        totalRedemptionResult?.[0]?.totalDiscountAmount || 0,
      );

      const nearUsageLimit = nearUsageLimitCoupons.filter((coupon) => {
        const used = Number(coupon.used || 0);
        const maxUsage = Number(coupon.maxUsage || 0);
        if (!(maxUsage > 0)) return false;
        return used / maxUsage >= 0.8;
      }).length;

      const usageRate = totalCoupons
        ? Math.round((totalRedemptions / totalCoupons) * 100)
        : 0;

      return {
        totalCoupons,
        activeCoupons,
        savedCoupons,
        usedCoupons,
        totalRedemptions,
        totalDiscountAmount,
        usageRate,
        expiringSoon,
        nearUsageLimit,
        topCoupons: topCouponRows.map((row) => {
          const coupon = couponMap.get(String(row._id));
          return {
            couponId: String(row._id),
            couponCode: coupon?.code || "",
            couponName: coupon?.name || "",
            usageCount: Number(row.usageCount || 0),
            totalDiscount: Number(row.totalDiscount || 0),
          };
        }),
      };
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
