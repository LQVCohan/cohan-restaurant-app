import mongoose from "mongoose";
import {
  Order,
  Review,
  StaffPerformanceSnapshot,
  Table,
} from "../../../models/index.js";
import { requireAuth, requireRestaurantAccess } from "../../guards.js";
import { buildDemandForecast } from "../../../src/services/ai/demandForecast.service.js";
import { buildMenuEngineeringAssistant } from "../../../src/services/ai/menuEngineeringAssistant.service.js";
import { buildSmartPromotionEngine } from "../../../src/services/ai/smartPromotionEngine.service.js";

const TIMEZONE = "Asia/Ho_Chi_Minh";
const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_LABELS = {
  Mon: "T2",
  Tue: "T3",
  Wed: "T4",
  Thu: "T5",
  Fri: "T6",
  Sat: "T7",
  Sun: "CN",
};
const DAY_ORDER = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const OCCUPANCY_ORDER_STATUSES = new Set([
  "pending",
  "confirmed",
  "customer_attached",
  "preparing",
  "ready",
  "served",
  "completed",
]);

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

const businessParts = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    weekday: "short",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const weekday = parts.find((part) => part.type === "weekday")?.value;
  const hour = Number.parseInt(
    parts.find((part) => part.type === "hour")?.value || "",
    10,
  );
  const dayLabel = DAY_LABELS[weekday];
  return dayLabel && Number.isFinite(hour) ? { dayLabel, hour } : null;
};

const dashboardPeriod = (parent) => {
  const keys = [...new Set(
    (parent?.revenueTrend || [])
      .map((point) => String(point?.key || ""))
      .filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key)),
  )].sort();
  const endKey = keys.at(-1);
  const startKey = keys[0];
  if (startKey && endKey) {
    return {
      start: new Date(`${startKey}T00:00:00+07:00`),
      end: new Date(`${endKey}T23:59:59.999+07:00`),
    };
  }

  const end = new Date();
  const start = new Date(end.getTime() - 6 * DAY_MS);
  return { start, end };
};

export function buildOccupancyHeatmap({ orders = [], tables = [], periodStart, periodEnd }) {
  const totalCapacity = tables
    .filter((table) => String(table?.status || "available") !== "offline")
    .reduce((sum, table) => sum + Math.max(0, Number(table?.capacity || 0)), 0);
  const eligibleOrders = orders.filter(
    (order) =>
      order?.orderType === "dine_in" &&
      OCCUPANCY_ORDER_STATUSES.has(String(order?.currentStatus || "").toLowerCase()),
  );
  if (!totalCapacity || !eligibleOrders.length) return [];

  const dayOccurrences = new Map();
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
    for (let cursor = start.getTime(); cursor <= end.getTime(); cursor += DAY_MS) {
      const parts = businessParts(new Date(cursor));
      if (parts) {
        dayOccurrences.set(
          parts.dayLabel,
          Number(dayOccurrences.get(parts.dayLabel) || 0) + 1,
        );
      }
    }
  }

  const guestsBySlot = new Map();
  const observedHours = new Set();
  for (const order of eligibleOrders) {
    const parts = businessParts(order?.createdAt);
    if (!parts) continue;
    const key = `${parts.dayLabel}|${parts.hour}`;
    guestsBySlot.set(
      key,
      Number(guestsBySlot.get(key) || 0) + Math.max(1, Number(order?.guestCount || 1)),
    );
    observedHours.add(parts.hour);
  }

  const hours = [...observedHours].sort((left, right) => left - right);
  const days = DAY_ORDER.filter((day) => dayOccurrences.has(day));
  return days.flatMap((dayLabel) =>
    hours.map((hour) => {
      const averageGuests =
        Number(guestsBySlot.get(`${dayLabel}|${hour}`) || 0) /
        Math.max(1, Number(dayOccurrences.get(dayLabel) || 1));
      return {
        dayLabel,
        hourLabel: `${String(hour).padStart(2, "0")}:00`,
        occupancyRate: Number(
          Math.min(1, averageGuests / totalCapacity).toFixed(3),
        ),
        staffRequired: averageGuests > 0 ? Math.max(1, Math.ceil(averageGuests / 7)) : 0,
      };
    }),
  );
}

export function buildStaffPerformance(snapshots = []) {
  const latestByEmployee = new Map();
  for (const snapshot of snapshots) {
    const employee = snapshot?.employeeId;
    const staffId = String(employee?._id || employee || "");
    if (!staffId || !employee || typeof employee !== "object") continue;
    if (latestByEmployee.has(staffId)) continue;
    latestByEmployee.set(staffId, {
      staffId,
      fullName: employee?.fullName || "Nhân viên",
      role:
        employee?.positionTitle ||
        employee?.roleName ||
        employee?.department ||
        "Nhân viên",
      status: employee?.employmentStatus || "working",
      ordersHandled: Math.max(0, Number(snapshot?.factors?.orderCount || 0)),
      efficiency: Math.max(
        0,
        Math.min(100, Number(snapshot?.finalPerformanceScore || 0)),
      ),
    });
  }

  return [...latestByEmployee.values()]
    .sort(
      (left, right) =>
        right.efficiency - left.efficiency ||
        right.ordersHandled - left.ordersHandled,
    )
    .slice(0, 20);
}

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

    async occupancyHeatmap(parent, _, ctx) {
      const rid = await authorize(ctx, restaurantIdFromParent(parent));
      const { start, end } = dashboardPeriod(parent);
      const [orders, tables] = await Promise.all([
        Order.find({
          restaurantId: rid,
          createdAt: { $gte: start, $lte: end },
          orderType: "dine_in",
          currentStatus: { $in: [...OCCUPANCY_ORDER_STATUSES] },
        })
          .select({ createdAt: 1, guestCount: 1, orderType: 1, currentStatus: 1 })
          .lean(),
        Table.find({ restaurantId: rid, status: { $ne: "offline" } })
          .select({ capacity: 1, status: 1 })
          .lean(),
      ]);
      return buildOccupancyHeatmap({
        orders,
        tables,
        periodStart: start,
        periodEnd: end,
      });
    },

    async staffPerformance(parent, _, ctx) {
      const rid = await authorize(ctx, restaurantIdFromParent(parent));
      const { start, end } = dashboardPeriod(parent);
      const snapshots = await StaffPerformanceSnapshot.find({
        restaurantId: rid,
        periodEnd: { $gte: start },
        periodStart: { $lte: end },
      })
        .select({
          employeeId: 1,
          periodEnd: 1,
          finalPerformanceScore: 1,
          factors: 1,
          updatedAt: 1,
        })
        .populate({
          path: "employeeId",
          select: "fullName positionTitle roleName department employmentStatus status deletedAt",
          match: { deletedAt: null, status: { $ne: "blocked" } },
        })
        .sort({ periodEnd: -1, updatedAt: -1 })
        .lean();
      return buildStaffPerformance(snapshots);
    },
  },
};
