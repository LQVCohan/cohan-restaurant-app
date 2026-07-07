// graphql/resolvers/order/query.js
import mongoose from "mongoose";
import {
  Order,
  User,
  Table,
  Customer,
  MenuItem,
  StockItem,
  Supply,
  Promotion,
  Staff,
  Review,
  KitchenOrderWorkItem,
  Reservation,
} from "../../../models/index.js";
import { buildPricedOrderItems } from "../../../src/services/orderItemPricing.service.js";
import { toId } from "../order/helper/orderUtils.js";
import { resolveTableSafe } from "../order/helper/tableUtils.js";
import TableCustomer from "../../../models/tableCustomer.model.js";
import { buildDemandForecast } from "../../../src/services/ai/demandForecast.service.js";
import { buildMenuEngineeringAssistant } from "../../../src/services/ai/menuEngineeringAssistant.service.js";
import { buildSmartPromotionEngine } from "../../../src/services/ai/smartPromotionEngine.service.js";
import { listStaffPerformanceSummaries } from "../../../src/services/performance/staffPerformanceReporting.service.js";
import { getManagerPerformanceRiskEmployees } from "../../../src/services/performance/managerPerformanceDashboard.service.js";
import { requireRoles } from "../../guards.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";
import { OrderCoreRecoveryQuery } from "./queryCoreRecovery.js";
import {
  activeTableSessionLookupFilter,
  childOrdersForSessionFilter,
  orderBatchOrLegacyFilter,
  withOrderBatchOrLegacyFilter,
} from "../../../utils/orderLifecycle.js";
import { calculateDiscountBreakdown } from "../../../src/services/discountCalculation.service.js";
import {
  ensureOrderTracking,
  computePublicOrderStatus,
  toCustomerTrackingPayload,
  buildOrderTrackingQrDataUrl,
} from "../../../src/services/orderTracking.service.js";
const INACTIVE_STATUSES = ["draft", "cancelled", "completed", "failed"];
const ACTIVE_VIEW_PAYMENT_FILTER = {
  orderPaymentStatus: { $ne: "paid" },
  "payment.status": { $ne: "paid" },
};

/**
 * Root grouping key:
 * - bình thường: rootCode = orderCode
 * - tách đơn: rootCode = parentOrderCode (child) / orderCode (parent)
 */
function getRootCode(ord) {
  return ord.parentOrderCode || ord.orderCode || "unknown";
}

function buildFilter(filter = {}) {
  const q = {};

  if (filter.restaurantId && mongoose.isValidObjectId(filter.restaurantId)) {
    q.restaurantId = toId(filter.restaurantId);
  }

  if (filter.tableCode) {
    q.tableCode = String(filter.tableCode).trim().toUpperCase();
  }

  if (filter.orderCode) {
    q.orderCode = String(filter.orderCode).trim();
  }

  if (filter.parentOrderCode) {
    q.parentOrderCode = String(filter.parentOrderCode).trim();
  }

  if (filter.orderType) {
    q.orderType = String(filter.orderType).trim();
  }

  // status / statuses
  if (Array.isArray(filter.statuses) && filter.statuses.length) {
    q.currentStatus = { $in: filter.statuses.map(String) };
  } else if (filter.status) {
    q.currentStatus = String(filter.status);
  }

  // date range
  if (filter.dateFrom || filter.dateTo) {
    q.createdAt = {};
    if (filter.dateFrom) q.createdAt.$gte = new Date(filter.dateFrom);
    if (filter.dateTo) q.createdAt.$lte = new Date(filter.dateTo);
  }

  // keyword search (basic)
  if (filter.keyword) {
    const k = String(filter.keyword).trim();
    q.$or = [
      { orderCode: new RegExp(k, "i") },
      { parentOrderCode: new RegExp(k, "i") },
      { note: new RegExp(k, "i") },
      { tableCode: new RegExp(k, "i") },
    ];
  }

  return q;
}

async function requireQueryRestaurantAccess(ctx, restaurantId) {
  if (!restaurantId || !mongoose.isValidObjectId(restaurantId)) {
    throw new Error("Invalid restaurantId");
  }
  const rid = toId(restaurantId);
  await requireRestaurantPermission(ctx, rid, PERMISSIONS.ORDER_READ);
  return rid;
}

async function requireReportRestaurantAccess(ctx, restaurantId) {
  if (!restaurantId || !mongoose.isValidObjectId(restaurantId)) throw new Error("Invalid restaurantId");
  const rid = toId(restaurantId);
  await requireRestaurantPermission(ctx, rid, PERMISSIONS.REPORT_READ);
  return rid;
}

async function requireAnalyticsRestaurantAccess(ctx, restaurantId) {
  return requireReportRestaurantAccess(ctx, restaurantId);
}

const NON_OPERATIONAL_ORDER_STATUSES = new Set(["draft", "cancelled", "failed"]);
const REVENUE_PAYMENT_STATUSES = new Set(["paid", "partially_refunded"]);
const INVALID_SOLD_ITEM_STATUSES = new Set(["cancelled", "returned"]);

function isOperationalOrder(order) {
  return !NON_OPERATIONAL_ORDER_STATUSES.has(String(order?.currentStatus || "").toLowerCase());
}

function isRevenueEligibleOrder(order) {
  if (String(order?.currentStatus || "").toLowerCase() !== "completed") return false;
  const paymentStatus = String(order?.payment?.status || order?.orderPaymentStatus || "").toLowerCase();
  return REVENUE_PAYMENT_STATUSES.has(paymentStatus);
}

function getSafeGrandTotal(order) {
  const v = Number(order?.totals?.grandTotal || 0);
  return Number.isFinite(v) && v >= 0 ? v : 0;
}

function isValidSoldItem(item) {
  const st = String(item?.status || "").toLowerCase();
  const qty = Number(item?.quantity || 0);
  return !INVALID_SOLD_ITEM_STATUSES.has(st) && Number.isFinite(qty) && qty > 0;
}

function mapOrderToDashboardAction(order, userMap = new Map()) {
  return {
    id: String(order._id),
    orderCode: order.orderCode || null,
    customerName:
      order?.customerInfo?.name ||
      (order.userId && userMap.get(String(order.userId))) ||
      null,
    orderType: order.orderType || null,
    tableCode: order.tableCode || order?.table?.code || null,
    status: order.currentStatus || null,
    total: Number(order?.totals?.grandTotal || 0),
    createdAt: order.createdAt || null,
    itemNames: (order.items || []).map((x) => x?.name).filter(Boolean),
  };
}

function mapSupportRequestForDashboard(order, req) {
  return {
    orderId: String(order._id),
    orderCode: order.orderCode || String(order._id),
    trackingCode: order.trackingCode || null,
    tableCode: order.tableCode || order?.table?.code || null,
    requestId: req.requestId,
    type: req.type,
    status: req.status,
    message: req.message || null,
    createdAt: req.createdAt,
    acknowledgedAt: req.acknowledgedAt || null,
    resolvedAt: req.resolvedAt || null,
  };
}

/** Group orders by orderCode (no parentOrderCode usage) */
function groupOrdersByRootCode(orders = []) {
  const map = new Map();

  for (const ord of orders) {
    const key = String(getRootCode(ord) || ord._id);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(ord);
  }

  return Array.from(map.entries()).map(([orderCode, group]) => {
    const sorted = group.sort((a, b) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      if (ta !== tb) return ta - tb;
      return String(a._id).localeCompare(String(b._id));
    });

    return {
      orderCode, // root code
      tableCode: sorted[0]?.tableCode || null,
      tableId: sorted[0]?.tableId || null,
      restaurantId: sorted[0]?.restaurantId,
      latestStatus: sorted[sorted.length - 1]?.currentStatus || null,
      count: sorted.length,
      orders: sorted,
    };
  });
}

function buildWorkItemKey(orderId, orderItemId) {
  if (!orderId || !orderItemId) return null;
  return `${String(orderId)}:${String(orderItemId)}`;
}

function sameId(left, right) {
  return Boolean(left && right && String(left) === String(right));
}

function getOrderItemCandidateIds(item) {
  return [
    item?.id,
    item?._id,
    item?.dishId,
    item?.menuId,
    item?.menuItemId,
    item?.menuItem?.id,
    item?.menuItem?._id,
  ]
    .filter(Boolean)
    .map(String);
}

function orderItemMatchesMenuItem(item, menuItemId) {
  const targetId = menuItemId ? String(menuItemId) : "";
  if (!targetId) return false;
  return getOrderItemCandidateIds(item).includes(targetId);
}

function getOrderLineQuantity(item) {
  const quantity = Number(item?.quantity || 0);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
}

function promotionIsActiveForPreview(promotion, now, subtotal) {
  if (!promotion?.isActive) return false;
  const startAt = promotion.startAt ? new Date(promotion.startAt) : null;
  const endAt = promotion.endAt ? new Date(promotion.endAt) : null;
  if (startAt && startAt > now) return false;
  if (endAt && endAt < now) return false;
  return subtotal >= Math.max(0, Number(promotion.minOrderValue || 0));
}

async function buildEligibleBogoGiftItems({ restaurantId, items = [], subtotal = 0, now = new Date() }) {
  if (!restaurantId || !items.length) return [];

  const bogoPromotions = await Promotion.find({
    restaurantId,
    isActive: true,
    promotionType: "BOGO",
    scope: "ITEM",
  }).lean();

  const eligiblePromotions = (bogoPromotions || []).filter((promotion) =>
    promotionIsActiveForPreview(promotion, now, subtotal),
  );
  if (!eligiblePromotions.length) return [];

  const menuIds = [
    ...new Set(
      eligiblePromotions
        .flatMap((promotion) => [promotion.itemId, promotion.giftItemId])
        .filter(Boolean)
        .map(String),
    ),
  ];

  const menuItems = menuIds.length
    ? await MenuItem.find({ _id: { $in: menuIds }, restaurantId })
        .select("_id name basePrice thumbImage menuId categoryId defaultServingKey")
        .lean()
    : [];
  const menuItemMap = new Map(menuItems.map((item) => [String(item._id), item]));

  const suggestions = [];
  for (const promotion of eligiblePromotions) {
    const buyItemId = promotion.itemId ? String(promotion.itemId) : "";
    const giftItemId = promotion.giftItemId ? String(promotion.giftItemId) : "";
    if (!buyItemId || !giftItemId) continue;

    const buyQuantity = Math.max(1, Number(promotion.buyQuantity || 1));
    const getQuantity = Math.max(1, Number(promotion.getQuantity || 1));

    let purchasedQuantity = 0;
    let giftQuantityInOrder = 0;
    for (const item of items || []) {
      const status = String(item?.status || "").toLowerCase();
      if (status === "cancelled" || status === "returned") continue;
      const quantity = getOrderLineQuantity(item);
      if (quantity <= 0) continue;
      if (orderItemMatchesMenuItem(item, buyItemId)) purchasedQuantity += quantity;
      if (orderItemMatchesMenuItem(item, giftItemId)) giftQuantityInOrder += quantity;
    }

    const giftQuantityLimit = Math.floor(purchasedQuantity / buyQuantity) * getQuantity;
    const missingGiftQuantity = Math.max(0, giftQuantityLimit - giftQuantityInOrder);
    if (missingGiftQuantity <= 0) continue;

    const buyItem = menuItemMap.get(buyItemId);
    const giftItem = menuItemMap.get(giftItemId);
    const giftName = giftItem?.name || "món tặng";

    suggestions.push({
      promotionId: String(promotion._id),
      promotionName: promotion.name || promotion.code || "Mua tặng",
      promotionCode: promotion.code || "",
      buyItemId,
      buyItemName: buyItem?.name || "món mua",
      giftItemId,
      giftItemName: giftName,
      giftItemImage: giftItem?.thumbImage || "",
      giftItemPrice: Number(giftItem?.basePrice || 0),
      giftMenuId: giftItem?.menuId ? String(giftItem.menuId) : null,
      giftCategoryId: giftItem?.categoryId ? String(giftItem.categoryId) : null,
      giftDefaultServingKey: giftItem?.defaultServingKey || "portion",
      buyQuantity,
      getQuantity,
      purchasedQuantity,
      giftQuantityLimit,
      giftQuantityInOrder,
      missingGiftQuantity,
      message: `Đơn đủ điều kiện nhận ${missingGiftQuantity} ${giftName} từ ${promotion.name || promotion.code || "khuyến mãi mua tặng"}.`,
    });
  }

  return suggestions;
}

async function attachKitchenWorkItemInfoToOrders({ rid, orders }) {
  const slice = orders || [];
  if (!rid || !slice.length) return slice;

  const orderIds = slice.map((order) => order?._id).filter(Boolean);
  if (!orderIds.length) return slice;

  const workItems = await KitchenOrderWorkItem.find({
    restaurantId: rid,
    orderId: { $in: orderIds },
  })
    .select({
      restaurantId: 1,
      orderId: 1,
      orderItemId: 1,
      station: 1,
      kitchenEnteredAt: 1,
      preparingAt: 1,
      readyAt: 1,
      actualPrepMinutes: 1,
      targetPrepMinutes: 1,
      timeLevel: 1,
      unaccepted: 1,
      unacceptedAfterMinutes: 1,
      unacceptedReason: 1,
    })
    .lean();

  const byOrderItem = new Map(
    workItems
      .filter((workItem) => sameId(workItem?.restaurantId, rid))
      .map((workItem) => [buildWorkItemKey(workItem.orderId, workItem.orderItemId), workItem])
      .filter(([key]) => Boolean(key)),
  );

  return slice.map((order) => ({
    ...order,
    items: (order.items || []).map((item) => {
      const snapshotStation = item?.station || item?.prepStation || null;
      const workItem = byOrderItem.get(buildWorkItemKey(order._id, item?._id));
      if (!workItem) {
        return {
          ...item,
          station: snapshotStation,
        };
      }
      return {
        ...item,
        station: workItem.station || snapshotStation,
        kitchenEnteredAt: workItem.kitchenEnteredAt || null,
        preparingAt: workItem.preparingAt || null,
        readyAt: workItem.readyAt || null,
        actualPrepMinutes: workItem.actualPrepMinutes ?? null,
        targetPrepMinutes: workItem.targetPrepMinutes ?? null,
        timeLevel: workItem.timeLevel || null,
        unaccepted: workItem.unaccepted === true,
        unacceptedAfterMinutes: workItem.unacceptedAfterMinutes ?? null,
        unacceptedReason: workItem.unacceptedReason || null,
      };
    }),
  }));
}

async function attachCustomerInfoToOrders({ rid, orders }) {
  const slice = orders || [];
  if (!slice.length) return [];

  const tableCodes = [
    ...new Set(slice.map((o) => o.tableCode).filter(Boolean)),
  ];
  const tableIds = [...new Set(slice.map((o) => o.tableId).filter(Boolean))];

  const customerDocs = await TableCustomer.find({
    restaurantId: rid,
    $or: [
      ...(tableCodes.length ? [{ tableCode: { $in: tableCodes } }] : []),
      ...(tableIds.length ? [{ tableId: { $in: tableIds } }] : []),
    ],
  })
    .select({
      tableCode: 1,
      tableId: 1,
      customerName: 1,
      customerPhone: 1,
      customerEmail: 1,
      note: 1,
      partySize: 1,
      timeTo: 1,
    })
    .lean();

  const byTableCode = new Map();
  const byTableId = new Map();
  for (const c of customerDocs) {
    if (c.tableCode) byTableCode.set(String(c.tableCode), c);
    if (c.tableId) byTableId.set(String(c.tableId), c);
  }

  return slice.map((o) => {
    const tc =
      (o.tableId && byTableId.get(String(o.tableId))) ||
      (o.tableCode && byTableCode.get(String(o.tableCode))) ||
      null;

    const customerInfo = tc
      ? {
          name: tc.customerName || null,
          phone: tc.customerPhone || null,
          email: tc.customerEmail || null,
          note: tc.note || null,
          partySize: tc.partySize || null,
          timeTo: tc.timeTo || null,
        }
      : null;

    return {
      ...o,
      customerInfo,
    };
  });
}

async function buildCursorConnection({ baseFilter, limit = 20, cursor, rid }) {
  const safeLimit = Math.max(1, Math.min(200, limit));

  const q = Order.find(baseFilter).sort({ _id: 1 });
  if (cursor) q.where("_id").gt(cursor);
  q.limit(safeLimit + 1);

  const rows = await q.lean({ virtuals: true });

  const hasNextPage = rows.length > safeLimit;
  const slice = hasNextPage ? rows.slice(0, safeLimit) : rows;

  const lastCursor = slice.length ? String(slice[slice.length - 1]._id) : null;

  const withKitchenWorkItems = await attachKitchenWorkItemInfoToOrders({
    rid,
    orders: slice,
  });

  const withCustomer = await attachCustomerInfoToOrders({
    rid,
    orders: withKitchenWorkItems,
  });

  const edges = withCustomer.map((o) => ({
    cursor: String(o._id),
    node: {
      id: String(o._id),
      ...o,
    },
  }));

  return {
    edges,
    pageInfo: {
      endCursor: lastCursor,
      hasNextPage,
    },
  };
}

function isRevenueOrder(order) {
  const status = String(order?.currentStatus || "").toLowerCase();
  if (["cancelled", "failed", "draft"].includes(status)) return false;
  const pay = String(order?.orderPaymentStatus || order?.payment?.status || "").toLowerCase();
  return ["paid", "partially_refunded"].includes(pay);
}

function bump(map, key, amount = 1) {
  const k = key || "unknown";
  map.set(k, (map.get(k) || 0) + amount);
}

async function leanFindRows(model, filter, sortSpec, leanOptions = { virtuals: true }) {
  const query = model.find(filter);
  if (query?.sort) return query.sort(sortSpec).lean(leanOptions);
  if (query?.lean) return query.lean(leanOptions);
  return query || [];
}

async function reportsOverviewResolver(_, { restaurantId, startAt, endAt } = {}, ctx) {
  if (!restaurantId || !mongoose.isValidObjectId(restaurantId)) throw new Error("Invalid restaurantId");
  const rid = toId(restaurantId);
  await requireRestaurantPermission(ctx, rid, PERMISSIONS.REPORT_READ || "report.read");
  const and = [{ restaurantId: rid }, orderBatchOrLegacyFilter()];
  if (startAt || endAt) {
    const range = {};
    if (startAt) range.$gte = new Date(startAt);
    if (endAt) range.$lte = new Date(endAt);
    if ((range.$gte && Number.isNaN(range.$gte.getTime())) || (range.$lte && Number.isNaN(range.$lte.getTime())) || (range.$gte && range.$lte && range.$gte > range.$lte)) throw new Error("REPORT_INVALID_DATE_RANGE");
    and.unshift({ createdAt: range });
  }
  const rows = await leanFindRows(Order, { $and: and }, { createdAt: 1, _id: 1 });
  const active = (rows || []).filter((o) => !["cancelled", "failed", "draft"].includes(String(o?.currentStatus || "").toLowerCase()));
  const byStatus = new Map();
  const byOrderType = new Map();
  const byDay = new Map();
  const dishes = new Map();
  let grossRevenue = 0;
  for (const order of active) {
    bump(byStatus, String(order.currentStatus || "unknown").toLowerCase());
    bump(byOrderType, order.orderType || "unknown");
    const date = new Date(order.createdAt || Date.now()).toISOString().slice(0, 10);
    const day = byDay.get(date) || { date, grossRevenue: 0, orders: 0 };
    day.orders += 1;
    const revenue = isRevenueOrder(order) ? Math.max(0, Number(order?.totals?.grandTotal || order?.grandTotal || 0)) : 0;
    grossRevenue += revenue;
    day.grossRevenue += revenue;
    byDay.set(date, day);
    if (!revenue) continue;
    for (const item of order.items || []) {
      if (["cancelled", "returned", "voided"].includes(String(item?.status || "").toLowerCase())) continue;
      const name = String(item?.name || item?.dishName || "").trim();
      if (!name) continue;
      const cur = dishes.get(name) || { name, quantity: 0, revenue: 0 };
      cur.quantity += Number(item?.quantity || 0);
      cur.revenue += Math.max(0, Number(item?.lineSubtotal || item?.subtotal || 0));
      dishes.set(name, cur);
    }
  }
  return {
    totalOrders: active.length,
    grossRevenue,
    byStatus: [...byStatus.entries()].map(([key, count]) => ({ key, count })),
    byOrderType: [...byOrderType.entries()].map(([key, count]) => ({ key, count })),
    topDishes: [...dishes.values()].sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity).slice(0, 10),
    revenueByDay: [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date)),
  };
}

export const OrderQuery = {
  ...OrderCoreRecoveryQuery,
  async managerDashboard(_, { restaurantId, range = "week" } = {}, ctx) {
    await requireQueryRestaurantAccess(ctx, restaurantId);
    return { restaurantId: String(restaurantId), range, totals: {} };
  },
  reportsOverview: reportsOverviewResolver,
  async ordersByRestaurantNow(_, { restaurantId, limit = 20, cursor }, ctx) {
    const rid = await requireQueryRestaurantAccess(ctx, restaurantId);
    const baseFilter = withOrderBatchOrLegacyFilter({
      restaurantId: rid,
      currentStatus: { $nin: INACTIVE_STATUSES },
    });
    return buildCursorConnection({ baseFilter, limit, cursor, rid });
  },

  async activeTableSessionOrders(_, { restaurantId, tableId }, ctx) {
    const rid = await requireQueryRestaurantAccess(ctx, restaurantId);
    if (!tableId || !mongoose.isValidObjectId(tableId)) throw new Error("Invalid tableId");
    const table = await Table.findOne({ _id: tableId, restaurantId: rid }).select({ _id: 1, code: 1 }).lean();
    if (!table) return { session: null, orders: [], tableId, tableCode: null };
    const safeCode = String(table.code || "").toUpperCase();
    const session = await Order.findOne(activeTableSessionLookupFilter({ restaurantId: rid, tableId: table._id, tableCode: safeCode }))
      .sort({ openedAt: -1, createdAt: -1, _id: -1 })
      .lean({ virtuals: true });
    const readOrders = (filter) => Order.find(filter).sort({ createdAt: 1, _id: 1 }).lean({ virtuals: true });
    let orders = [];
    if (session?._id) {
      orders = await readOrders({
        ...childOrdersForSessionFilter({ restaurantId: rid, parentOrderId: session._id }),
        currentStatus: { $nin: INACTIVE_STATUSES },
      });
    }
    if (!orders.length) {
      orders = await readOrders({
        restaurantId: rid,
        tableId: table._id,
        tableCode: safeCode,
        ...orderBatchOrLegacyFilter(),
        currentStatus: { $nin: INACTIVE_STATUSES },
      });
    }
    return {
      session: session || null,
      orders: (orders || []).filter((order) => order?.orderKind !== "table_session"),
      tableId: String(table._id),
      tableCode: safeCode || null,
    };
  },

  async customerServiceRequests(_, { restaurantId, status = "PENDING", type, limit = 50 }, ctx) {
    const rid = await requireQueryRestaurantAccess(ctx, restaurantId);
    const normalized = String(status || "PENDING").toUpperCase();
    const normalizedType = type ? String(type).toUpperCase() : null;
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 50));
    const elemMatch = { status: normalized };
    if (normalizedType) elemMatch.type = normalizedType;
    const orders = await Order.find({
      restaurantId: rid,
      customerRequests: { $elemMatch: elemMatch },
    }).select({ orderCode: 1, trackingCode: 1, tableCode: 1, customerRequests: 1 });
    const out = [];
    for (const order of orders) {
      for (const req of order.customerRequests || []) {
        if (String(req?.status || "").toUpperCase() !== normalized) continue;
        if (normalizedType && String(req?.type || "").toUpperCase() !== normalizedType) continue;
        out.push({
          orderId: String(order._id),
          orderCode: order.orderCode,
          trackingCode: order.trackingCode || null,
          tableCode: order.tableCode || null,
          requestId: req.requestId,
          type: req.type,
          status: req.status,
          message: req.message || null,
          createdAt: req.createdAt,
          acknowledgedAt: req.acknowledgedAt || null,
          resolvedAt: req.resolvedAt || null,
        });
      }
    }
    return out.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, safeLimit);
  },
  async customerTrackOrder(_, { trackingToken }) {
    const order = await Order.findOne({ trackingToken }).select({
      trackingCode: 1, publicStatus: 1, customerVisibleNote: 1, estimatedReadyAt: 1, statusHistory: 1, items: 1, orderPaymentStatus: 1, payment: 1, totals: 1, customerRequests: 1, trackingQrRevokedAt: 1, currentStatus: 1, kitchenStatus: 1, sessionStatus: 1, orderType: 1, shipping: 1, createdAt: 1, updatedAt: 1,
    });
    if (!order) return null;
    if (order.trackingQrRevokedAt) throw new Error("Tracking link has expired");
    order.publicStatus = computePublicOrderStatus(order);
    return toCustomerTrackingPayload(order.toObject());
  },
  async orderTrackingQrSvg(_, { orderId }, ctx) {
    const order = await Order.findById(orderId);
    if (!order) throw new Error("Order not found");
    await requireRestaurantPermission(ctx, order.restaurantId, PERMISSIONS.ORDER_READ);
    await ensureOrderTracking(order);
    await order.save();
    return buildOrderTrackingQrDataUrl(order);
  },
  /** Single */
  async order(_, { id }, ctx) {
    if (!mongoose.isValidObjectId(id)) return null;

    const order = await Order.findById(id).lean({ virtuals: true });
    if (!order) return null;

    if (!order.restaurantId || !mongoose.isValidObjectId(order.restaurantId)) {
      throw new Error("Invalid restaurantId");
    }

    await requireRestaurantPermission(ctx, order.restaurantId, PERMISSIONS.ORDER_READ);
    return order;
  },
  async previewOrderDiscount(_, { input }, ctx) {
    const {
      restaurantId,
      items = [],
      pricing = {},
      promotionIds = [],
    } = input || {};

    const rid = await requireQueryRestaurantAccess(ctx, restaurantId);

    const previewItems = await buildPricedOrderItems({
      restaurantId: rid,
      items,
    });

    if (!previewItems.length) {
      throw new Error("No valid order items for discount preview");
    }

    const subtotal = previewItems.reduce((sum, item) => {
      const status = String(item?.status || "").toLowerCase();
      if (status === "cancelled" || status === "returned") return sum;
      return sum + Math.max(0, Number(item?.lineSubtotal || 0));
    }, 0);
    const eligibleGiftItems = await buildEligibleBogoGiftItems({
      restaurantId: rid,
      items: previewItems,
      subtotal,
    });

    const breakdown = await calculateDiscountBreakdown({
      restaurantId: rid,
      items: previewItems,
      pricing: {
        taxRate: pricing?.taxRate,
        serviceRate: pricing?.serviceRate,
        shippingFee: pricing?.shippingFee,
        voucherCode: pricing?.voucherCode,
      },
      promotionIds: Array.isArray(promotionIds) ? promotionIds : [],
    });

    return {
      ...breakdown,
      eligibleGiftItems,
    };
  },
  /** List with offset pagination */
  async orders(_, { filter = {}, limit = 50, offset = 0 }, ctx) {
    const baseQ = buildFilter(filter);
    if (filter.restaurantId) {
      if (!mongoose.isValidObjectId(filter.restaurantId)) {
        throw new Error("Invalid restaurantId");
      }
      await requireRestaurantPermission(ctx, baseQ.restaurantId, PERMISSIONS.ORDER_READ);
    } else {
      requireRoles(ctx, ["ADMIN"]);
    }

    const q = withOrderBatchOrLegacyFilter(baseQ);
    const safeLimit = Math.max(1, Math.min(200, limit));
    const safeOffset = Math.max(0, offset);
    const [itemsRaw, totalCount] = await Promise.all([
      (() => {
        const query = Order.find(q);
        if (query?.sort) {
          const sorted = query.sort({ createdAt: -1, _id: -1 });
          if (sorted?.skip) return sorted.skip(safeOffset).limit(safeLimit).lean({ virtuals: true });
          if (sorted?.lean) return sorted.lean({ virtuals: true });
        }
        if (query?.lean) return query.lean({ virtuals: true });
        return query || [];
      })(),
      Order.countDocuments(q),
    ]);
    let items = itemsRaw;
    if (baseQ.restaurantId) {
      items = await attachCustomerInfoToOrders({ rid: baseQ.restaurantId, orders: itemsRaw });
    }
    return { items, totalCount };
  },
};

export default { OrderQuery };
