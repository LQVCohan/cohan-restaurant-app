import mongoose from "mongoose";
import { Promotion } from "../../../models/index.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

export const PromotionQuery = {
  async promotionsByRestaurant(
    _,
    { restaurantId, activeOnly = true, limit = 20, offset = 0, now },
    ctx
  ) {
    if (!mongoose.isValidObjectId(restaurantId)) {
      throw new Error("Invalid restaurantId");
    }

    const safeLimit = clamp(limit, 1, 100);
    const safeOffset = Math.max(0, Number(offset) || 0);

    const rid = new mongoose.Types.ObjectId(restaurantId);
    if (!activeOnly) {
      await requireRestaurantPermission(ctx, rid, PERMISSIONS.PROMOTION_READ);
    }

    const query = { restaurantId: rid };

    if (activeOnly) {
      query.isActive = true;
      const nowDate = now ? new Date(now) : new Date();
      query.$and = [
        {
          $or: [
            { startAt: { $exists: false } },
            { startAt: null },
            { startAt: { $lte: nowDate } },
          ],
        },
        {
          $or: [
            { endAt: { $exists: false } },
            { endAt: null },
            { endAt: { $gte: nowDate } },
          ],
        },
      ];
      query.$expr = {
        $or: [{ $lte: ["$usageLimit", 0] }, { $lt: ["$usageCount", "$usageLimit"] }],
      };
    }

    return Promotion.find(query)
      .sort({ startAt: -1, _id: -1 })
      .skip(safeOffset)
      .limit(safeLimit)
      .lean({ virtuals: true });
  },
};
