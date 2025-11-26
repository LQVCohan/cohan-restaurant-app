// src/graphql/reviews/review.query.js

// src/graphql/review/review.query.js
import Review from "../../../models/review.model.js";

export default {
  // ===========================================================================
  // 1) DANH SÁCH REVIEW (CÓ PHÂN TRANG)
  // ===========================================================================
  reviews: async (
    _,
    {
      restaurantId,
      targetType,
      targetId,
      status,
      minRating,
      maxRating,
      limit = 20,
      skip = 0,
    }
  ) => {
    const filter = {};

    if (restaurantId) filter.restaurantId = restaurantId;
    if (targetType) filter.targetType = targetType;
    if (targetId) filter.targetId = targetId;
    if (status) filter.status = status;

    if (minRating)
      filter.rating = { ...(filter.rating || {}), $gte: minRating };
    if (maxRating)
      filter.rating = { ...(filter.rating || {}), $lte: maxRating };

    const total = await Review.countDocuments(filter);

    const items = await Review.find(filter)
      .sort({ createdAt: -1 }) // Mới nhất lên đầu
      .skip(skip)
      .limit(limit)
      .lean({ virtuals: true });

    return {
      total,
      items,
    };
  },

  // ===========================================================================
  // 2) LẤY CHI TIẾT 1 REVIEW
  // ===========================================================================
  review: async (_, { id }) => {
    return Review.findById(id).lean({ virtuals: true });
  },

  // ===========================================================================
  // 3) THỐNG KÊ REVIEW (CHO HEADER TRANG REVIEW)
  // ===========================================================================
  reviewStats: async (_, { restaurantId, targetType, targetId }) => {
    const filter = {};

    if (restaurantId) filter.restaurantId = restaurantId;
    if (targetType) filter.targetType = targetType;
    if (targetId) filter.targetId = targetId;

    const total = await Review.countDocuments(filter);
    const pending = await Review.countDocuments({
      ...filter,
      status: "pending",
    });

    // Tính điểm trung bình
    const ratingAgg = await Review.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          avg: { $avg: "$rating" },
        },
      },
    ]);

    const avgRating =
      ratingAgg.length > 0 ? Number(ratingAgg[0].avg.toFixed(2)) : 0;

    // Phân bố rating 1–5
    const breakdownAgg = await Review.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$rating",
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const ratingBreakdown = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };

    breakdownAgg.forEach((item) => {
      ratingBreakdown[item._id] = item.count;
    });

    return {
      total,
      pending,
      avgRating,
      ratingBreakdown,
    };
  },
};
