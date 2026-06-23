import mongoose from "mongoose";
import { Order, Review } from "../../../models/index.js";
import { requireAuth, requireRestaurantAccess } from "../../guards.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";
import { withOrderBatchOrLegacyFilter } from "../../../utils/orderLifecycle.js";
import { buildDemandForecast } from "../../../src/services/ai/demandForecast.service.js";
import { buildMenuEngineeringAssistant } from "../../../src/services/ai/menuEngineeringAssistant.service.js";
import { buildSmartPromotionEngine } from "../../../src/services/ai/smartPromotionEngine.service.js";

const TIMEZONE = "Asia/Ho_Chi_Minh";
const REPORT_EXCLUDED_STATUSES = new Set(["draft", "cancelled", "failed"]);
const REPORT_REVENUE_PAYMENT_STATUSES = new Set(["paid", "partially_refunded"]);

async function authorize(ctx, restaurantId) {
  requireAuth(ctx);
  await requireRestaurantAccess(ctx, restaurantId);
  if (!mongoose.isValidObjectId(restaurantId)) {
    throw new Error("restaurantId không hợp lệ.");
  }
  return new mongoose.Types.ObjectId(restaurantId);
}

async function authorizeReport(ctx, restaurantId) {
  if (!mongoose.isValidObjectId(restaurantId)) {
    throw new Error("restaurantId không hợp lệ.");
  }
  const rid = new mongoose.Types.ObjectId(restaurantId);
  await requireRestaurantPermission(ctx, rid, PERMISSIONS.REPORT_READ);
  return rid;
}

function reportDateRange(startAt, endAt) {
  const start = startAt ? new Date(startAt) : null;
  const end = endAt ? new Date(endAt) : null;
  if ((start && Number.isNaN(start.getTime())) || (end && Number.isNaN(end.getTime()))) {
    throw new Error("REPORT_INVALID_DATE_RANGE");
  }
  if (start && end && start > end) throw new Error("REPORT_INVALID_DATE_RANGE");
  if (!start && !end) return null;
  return {
    ...(start ? { $gte: start } : {}),
    ...(end ? { $lte: end } : {}),
  };
}

const reportStatus = (order) => String(order?.currentStatus || "").toLowerCase();
const reportPaymentStatus = (order) =>
  String(order?.orderPaymentStatus || order?.payment?.status || "").toLowerCase();
const reportOrderTotal = (order) => Number(order?.totals?.grandTotal || 0);
const reportDateKey = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
};

function incrementBucket(map, key) {
  const normalized = String(key || "unknown");
  const current = map.get(normalized) || { key: normalized, label: normalized, count: 0 };
  current.count += 1;
  map.set(normalized, current);
}

function buildReportsOverview(orders) {
  const operationalOrders = (orders || []).filter(
    (order) => !REPORT_EXCLUDED_STATUSES.has(reportStatus(order)),
  );
  const byStatus = new Map();
  const byOrderType = new Map();
  const topDishes = new Map();
  const revenueByDay = new Map();
  let grossRevenue = 0;

  for (const order of operationalOrders) {
    incrementBucket(byStatus, reportStatus(order));
    incrementBucket(byOrderType, order?.orderType || "unknown");

    const date = reportDateKey(order?.createdAt);
    const day = revenueByDay.get(date) || { date, grossRevenue: 0, orders: 0 };
    day.orders += 1;

    if (REPORT_REVENUE_PAYMENT_STATUSES.has(reportPaymentStatus(order))) {
      const revenue = reportOrderTotal(order);
      grossRevenue += revenue;
      day.grossRevenue += revenue;
    }
    if (date) revenueByDay.set(date, day);

    if (reportStatus(order) !== "completed") continue;
    for (const item of order?.items || []) {
      const itemStatus = String(item?.status || "").toLowerCase();
      if (["cancelled", "returned"].includes(itemStatus)) continue;
      const name = String(item?.name || "").trim();
      if (!name) continue;
      const quantity = Number(item?.quantity || 0);
      const revenue = Number(item?.lineSubtotal || Number(item?.unitPrice || 0) * quantity);
      const current = topDishes.get(name) || { name, quantity: 0, revenue: 0 };
      current.quantity += quantity;
      current.revenue += revenue;
      topDishes.set(name, current);
    }
  }

  return {
    totalOrders: operationalOrders.length,
    grossRevenue,
    byStatus: Array.from(byStatus.values()),
    byOrderType: Array.from(byOrderType.values()),
    topDishes: Array.from(topDishes.values()).sort(
      (left, right) => right.quantity - left.quantity || right.revenue - left.revenue,
    ),
    revenueByDay: Array.from(revenueByDay.values()).sort((left, right) =>
      left.date.localeCompare(right.date),
    ),
  };
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
    async reportsOverview(_, { restaurantId, startAt, endAt }, ctx) {
      const rid = await authorizeReport(ctx, restaurantId);
      const dateRange = reportDateRange(startAt, endAt);
      const filter = withOrderBatchOrLegacyFilter({
        restaurantId: rid,
        ...(dateRange ? { createdAt: dateRange } : {}),
      });
      const orders = await Order.find(filter)
        .select({
          currentStatus: 1,
          orderType: 1,
          orderPaymentStatus: 1,
          payment: 1,
          totals: 1,
          items: 1,
          createdAt: 1,
        })
        .sort({ createdAt: 1, _id: 1 })
        .lean();
      return buildReportsOverview(orders);
    },

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
