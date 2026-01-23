import mongoose from "mongoose";
import { Promotion } from "../../../models/index.js";

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

export const PromotionQuery = {
  async promotionsByRestaurant(
    _,
    { restaurantId, activeOnly = true, limit = 20, offset = 0, now }
  ) {
    if (!mongoose.isValidObjectId(restaurantId)) {
      throw new Error("Invalid restaurantId");
    }

    const safeLimit = clamp(limit, 1, 100);
    const safeOffset = Math.max(0, Number(offset) || 0);

    const query = {
      restaurantId: new mongoose.Types.ObjectId(restaurantId),
    };

    if (activeOnly) {
      query.isActive = true;
      const nowDate = now ? new Date(now) : new Date();
      query.$or = [
        { startAt: { $exists: false }, endAt: { $exists: false } },
        { startAt: { $lte: nowDate }, endAt: { $gte: nowDate } },
        { startAt: { $lte: nowDate }, endAt: { $exists: false } },
        { startAt: { $exists: false }, endAt: { $gte: nowDate } },
      ];
    }

    return Promotion.find(query)
      .sort({ startAt: -1, _id: -1 })
      .skip(safeOffset)
      .limit(safeLimit)
      .lean({ virtuals: true });
  },
};
