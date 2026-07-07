import mongoose from "mongoose";
import {
  MenuItem,
  Order,
  Promotion,
  Reservation,
  Staff,
  StockItem,
  Table,
} from "../../../models/index.js";
import {
  requireAuth,
  requireRestaurantAccess,
} from "../../guards.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_RANGE_DAYS = 7;
const MAX_RECENT_ORDERS = 6;
const MAX_PENDING_ITEMS = 8;
const MAX_LOW_STOCK_ITEMS = 8;

const toObjectId = (value) => {
  if (!value || !mongoose.isValidObjectId(value)) return null;
  return new mongoose.Types.ObjectId(value);
};

const startOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfDay = (value) => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

const getRangeDays = (range) => (String(range).toLowerCase() === "month" ? 30 : DEFAULT_RANGE_DAYS);

const getDashboardRanges = (range, now = new Date()) => {
  const days = getRangeDays(range);
  const currentEnd = endOfDay(now);
  const currentStart = startOfDay(new Date(currentEnd.getTime() - (days - 1) * DAY_MS));
  const previousEnd = endOfDay(new Date(currentStart.getTime() - DAY_MS));
  const previousStart = startOfDay(new Date(previousEnd.getTime() - (days - 1) * DAY_MS));

  return {
    days,
    currentStart,
    currentEnd,
    previousStart,
    previousEnd,
  };
};

const toDateKey = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getOrderTotal = (order) => Number(order?.totals?.grandTotal || 0);

const isRevenueOrder = (order) =>
  order?.currentStatus === "completed" ||
  order?.orderPaymentStatus === "paid" ||
  order?.payment?.status === "paid";

const getCustomerName = (order) =>
  order?.userId?.fullName ||
  order?.shipping?.fullName ||
  order?.clientMeta?.customerName ||
  "Khách lẻ";

const mapOrder = (order) => ({
  id: String(order?._id || order?.id || ""),
  orderCode: order?.orderCode || null,
  customerName: getCustomerName(order),
  orderType: order?.orderType || null,
  tableCode: order?.tableCode || order?.tableName || null,
  status: order?.currentStatus || null,
  total: getOrderTotal(order),
  createdAt: order?.createdAt || null,
  itemNames: (order?.items || []).map((item) => item?.name).filter(Boolean),
});

const buildStatusCounts = (orders) => {
  const counts = { pending: 0, preparing: 0, completed: 0, cancelled: 0 };

  for (const order of orders) {
    const status = String(order?.currentStatus || "").toLowerCase();
    if (["pending", "confirmed", "customer_attached"].includes(status)) {
      counts.pending += 1;
    } else if (["preparing", "ready", "served"].includes(status)) {
      counts.preparing += 1;
    } else if (status === "completed") {
      counts.completed += 1;
    } else if (["cancelled", "failed"].includes(status)) {
      counts.cancelled += 1;
    }
  }

  return counts;
};

const buildTrend = ({ currentOrders, previousOrders, days, mode }) => {
  const currentMap = new Map();
  const previousMap = new Map();

  const accumulate = (target, order) => {
    const key = toDateKey(order?.createdAt);
    if (!key) return;
    const value = mode === "revenue" ? (isRevenueOrder(order) ? getOrderTotal(order) : 0) : 1;
    target.set(key, Number(target.get(key) || 0) + value);
  };

  currentOrders.forEach((order) => accumulate(currentMap, order));
  previousOrders.forEach((order) => accumulate(previousMap, order));

  const currentKeys = Array.from(currentMap.keys()).sort();
  const previousKeys = Array.from(previousMap.keys()).sort();
  const fallbackCurrentStart = currentOrders.length
    ? startOfDay(currentOrders.reduce((min, order) => {
        const date = new Date(order.createdAt);
        return date < min ? date : min;
      }, new Date(currentOrders[0].createdAt)))
    : startOfDay(new Date(Date.now() - (days - 1) * DAY_MS));

  return Array.from({ length: days }, (_, index) => {
    const key = currentKeys[index] || toDateKey(new Date(fallbackCurrentStart.getTime() + index * DAY_MS));
    const previousKey = previousKeys[index] || "";
    return {
      key,
      current: Number(currentMap.get(key) || 0),
      previous: Number(previousMap.get(previousKey) || 0),
    };
  });
};

const buildTopDishes = (orders) => {
  const totals = new Map();

  for (const order of orders) {
    if (order?.currentStatus !== "completed") continue;
    for (const item of order?.items || []) {
      if (["cancelled", "returned"].includes(item?.status)) continue;
      const name = String(item?.name || "").trim();
      if (!name) continue;
      const quantity = Number(item?.quantity || 0);
      const revenue = Number(item?.lineSubtotal || Number(item?.unitPrice || 0) * quantity);
      const current = totals.get(name) || { dishName: name, quantity: 0, revenue: 0 };
      current.quantity += quantity;
      current.revenue += revenue;
      totals.set(name, current);
    }
  }

  return Array.from(totals.values())
    .sort((left, right) => right.quantity - left.quantity || right.revenue - left.revenue)
    .slice(0, 6);
};

const mapPendingReservation = (reservation) => ({
  id: String(reservation?._id || reservation?.id || ""),
  orderCode: reservation?.orderCode || null,
  customerName: reservation?.customerName || "Khách chưa cập nhật tên",
  customerPhone: reservation?.customerPhone || null,
  tableCode: reservation?.tableId?.code || null,
  partySize: Number(reservation?.partySize || 0),
  timeTo: reservation?.timeTo || null,
  status: reservation?.status || null,
  depositStatus: reservation?.depositStatus || null,
  depositAmount: Number(reservation?.depositAmount || 0),
  note: reservation?.note || null,
  createdAt: reservation?.createdAt || null,
});

const flattenPendingSupportRequests = (orders) =>
  orders.flatMap((order) =>
    (order?.customerRequests || [])
      .filter((request) => ["PENDING", "ACKNOWLEDGED"].includes(request?.status))
      .map((request) => ({
        orderId: String(order?._id || order?.id || ""),
        orderCode: order?.orderCode || null,
        trackingCode: order?.trackingCode || null,
        tableCode: order?.tableCode || null,
        requestId: request?.requestId,
        type: request?.type,
        status: request?.status,
        message: request?.message || null,
        createdAt: request?.createdAt || null,
        acknowledgedAt: request?.acknowledgedAt || null,
        resolvedAt: request?.resolvedAt || null,
      })),
  );

const managerDashboard = async (_, { restaurantId, range = "week" }, ctx) => {
  requireAuth(ctx);
  await requireRestaurantAccess(ctx, restaurantId);

  const rid = toObjectId(restaurantId);
  if (!rid) throw new Error("restaurantId không hợp lệ.");

  const now = new Date();
  const { days, currentStart, currentEnd, previousStart, previousEnd } =
    getDashboardRanges(range, now);
  const currentDateFilter = { $gte: currentStart, $lte: currentEnd };
  const previousDateFilter = { $gte: previousStart, $lte: previousEnd };
  const staffRestaurantFilter = { restaurantForStaff: rid };

  const [
    currentOrders,
    previousOrders,
    pendingOrders,
    pendingReservations,
    supportOrders,
    tables,
    menuItems,
    activePromotions,
    workingStaff,
    lowStockItems,
  ] = await Promise.all([
    Order.find({ restaurantId: rid, createdAt: currentDateFilter })
      .select({
        orderCode: 1,
        trackingCode: 1,
        userId: 1,
        restaurantId: 1,
        orderType: 1,
        tableCode: 1,
        tableName: 1,
        shipping: 1,
        clientMeta: 1,
        currentStatus: 1,
        orderPaymentStatus: 1,
        payment: 1,
        totals: 1,
        items: 1,
        customerRequests: 1,
        createdAt: 1,
      })
      .populate("userId", "fullName")
      .sort({ createdAt: -1 })
      .lean(),
    Order.find({ restaurantId: rid, createdAt: previousDateFilter })
      .select({ currentStatus: 1, orderPaymentStatus: 1, payment: 1, totals: 1, createdAt: 1 })
      .lean(),
    Order.find({
      restaurantId: rid,
      currentStatus: { $in: ["pending", "customer_attached"] },
    })
      .select({
        orderCode: 1,
        userId: 1,
        orderType: 1,
        tableCode: 1,
        tableName: 1,
        shipping: 1,
        clientMeta: 1,
        currentStatus: 1,
        totals: 1,
        items: 1,
        createdAt: 1,
      })
      .populate("userId", "fullName")
      .sort({ createdAt: 1 })
      .limit(MAX_PENDING_ITEMS)
      .lean(),
    Reservation.find({
      restaurantId: rid,
      status: { $in: ["pending_payment", "pending_change"] },
    })
      .populate("tableId", "code")
      .sort({ createdAt: 1 })
      .limit(MAX_PENDING_ITEMS)
      .lean(),
    Order.find({
      restaurantId: rid,
      customerRequests: {
        $elemMatch: { status: { $in: ["PENDING", "ACKNOWLEDGED"] } },
      },
    })
      .select({ orderCode: 1, trackingCode: 1, tableCode: 1, customerRequests: 1 })
      .sort({ "customerRequests.createdAt": 1 })
      .limit(MAX_PENDING_ITEMS)
      .lean(),
    Table.countDocuments({ restaurantId: rid }),
    MenuItem.countDocuments({ restaurantId: rid, status: { $ne: "hidden" } }),
    Promotion.countDocuments({
      restaurantId: rid,
      isActive: true,
      $and: [
        { $or: [{ startAt: null }, { startAt: { $exists: false } }, { startAt: { $lte: now } }] },
        { $or: [{ endAt: null }, { endAt: { $exists: false } }, { endAt: { $gte: now } }] },
      ],
    }),
    Staff.countDocuments({
      userType: "STAFF",
      deletedAt: null,
      status: { $ne: "blocked" },
      employmentStatus: "working",
      ...staffRestaurantFilter,
    }),
    StockItem.find({
      restaurantId: rid,
      $expr: {
        $lte: [
          { $subtract: [{ $ifNull: ["$onHand", 0] }, { $ifNull: ["$reserved", 0] }] },
          10,
        ],
      },
    })
      .select({ ingredientId: 1, supplyId: 1, onHand: 1, reserved: 1 })
      .populate("ingredientId", "name")
      .populate("supplyId", "name")
      .sort({ onHand: 1 })
      .limit(MAX_LOW_STOCK_ITEMS)
      .lean(),
  ]);

  const completedRevenue = currentOrders
    .filter(isRevenueOrder)
    .reduce((sum, order) => sum + getOrderTotal(order), 0);
  const customerIds = new Set(
    currentOrders.map((order) => String(order?.userId?._id || order?.userId || "")).filter(Boolean),
  );
  const pendingSupportRequests = flattenPendingSupportRequests(supportOrders).slice(
    0,
    MAX_PENDING_ITEMS,
  );

  return {
    restaurantId: String(rid),
    revenue: completedRevenue,
    orders: currentOrders.length,
    customers: customerIds.size,
    tables,
    menuItems,
    activePromotions,
    workingStaff,
    statusCounts: buildStatusCounts(currentOrders),
    revenueTrend: buildTrend({
      currentOrders,
      previousOrders,
      days,
      mode: "revenue",
    }),
    orderTrend: buildTrend({
      currentOrders,
      previousOrders,
      days,
      mode: "orders",
    }),
    topDishes: buildTopDishes(currentOrders),
    recentOrders: currentOrders.slice(0, MAX_RECENT_ORDERS).map(mapOrder),
    lowStockItems: lowStockItems.map((item) => ({
      id: String(item._id),
      name:
        item?.ingredientId?.name ||
        item?.supplyId?.name ||
        "Mặt hàng chưa đặt tên",
      onHand: Number(item?.onHand || 0),
      reserved: Number(item?.reserved || 0),
    })),
    pendingOrderCount: pendingOrders.length,
    pendingReservationCount: pendingReservations.length,
    pendingSupportRequestCount: pendingSupportRequests.length,
    pendingOrders: pendingOrders.map(mapOrder),
    pendingReservations: pendingReservations.map(mapPendingReservation),
    pendingSupportRequests,
  };
};

export {
  buildStatusCounts,
  buildTopDishes,
  buildTrend,
  getDashboardRanges,
  mapOrder,
};

export default {
  Query: {
    managerDashboard,
  },
};
