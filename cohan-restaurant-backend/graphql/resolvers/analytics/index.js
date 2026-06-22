import mongoose from "mongoose";
import { Review } from "../../../models/index.js";
import { requireAuth, requireRestaurantAccess } from "../../guards.js";
import { buildDemandForecast } from "../../../src/services/ai/demandForecast.service.js";
import { buildMenuEngineeringAssistant } from "../../../src/services/ai/menuEngineeringAssistant.service.js";
import { buildSmartPromotionEngine } from "../../../src/services/ai/smartPromotionEngine.service.js";

const TIMEZONE = "Asia/Ho_Chi_Minh";

async function authorize(ctx, restaurantId) {
  requireAuth(ctx);
  await requireRestaurantAccess(ctx, restaurantId);
  if (!mongoose.isValidObjectId(restaurantId)) {
    throw new Error("restaurantId không hợp lệ.");
  }
  return new mongoose.Types.ObjectId(restaurantId);
}

const restaurantIdFromParent = (parent) => parent?.restaurantId || parent?.id;

const sentimentOf = (review) => {
  if (review?.sentiment) return review.sentiment;
  const rating = Number(review?.rating || 0);
  if (rating >= 4) return "positive";
  if (rating <= 2) return "negative";
  return "neutral";
};

async function findReviews(parent, ctx) {
  const rid = await authorize(ctx, restaurantIdFromParent(parent));
  return Review.find({ restaurantId: rid, status: "published" })
    .select({ customerName: 1, rating: 1, content: 1, sentiment: 1, createdAt: 1 })
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();
}

export default {
  Query: {
    async demandForecast(_, { restaurantId, horizonDays = 2 }, ctx) {
      const rid = await authorize(ctx, restaurantId);
      return buildDemandForecast({ restaurantId: rid, horizonDays, timezone: TIMEZONE });
    },

    async menuEngineeringAssistant(_, { restaurantId, lookbackDays = 30 }, ctx) {
      const rid = await authorize(ctx, restaurantId);
      return buildMenuEngineeringAssistant({ restaurantId: rid, lookbackDays, timezone: TIMEZONE });
    },

    async smartPromotionEngine(_, { restaurantId, lookbackDays = 30, horizonDays = 2 }, ctx) {
      const rid = await authorize(ctx, restaurantId);
      return buildSmartPromotionEngine({
        restaurantId: rid,
        lookbackDays,
        horizonDays,
        timezone: TIMEZONE,
      });
    },
  },

  ManagerDashboard: {
    async feedbackSummary(parent, _, ctx) {
      const reviews = await findReviews(parent, ctx);
      const total = reviews.length;
      const avgRating = total
        ? reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / total
        : 0;
      const sentiments = reviews.map(sentimentOf);
      return {
        avgRating: Number(avgRating.toFixed(2)),
        total,
        negative: sentiments.filter((value) => value === "negative").length,
        positive: sentiments.filter((value) => value === "positive").length,
      };
    },

    async feedbackItems(parent, _, ctx) {
      const reviews = await findReviews(parent, ctx);
      return reviews.slice(0, 20).map((review) => ({
        id: String(review._id),
        customerName: review.customerName || "Khách hàng",
        rating: Number(review.rating || 0),
        content: review.content || "",
        createdAt: review.createdAt || null,
        sentiment: sentimentOf(review),
      }));
    },

    occupancyHeatmap: () => [],
    staffPerformance: () => [],
  },
};
