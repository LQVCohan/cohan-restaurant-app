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
} from "../../../models/index.js";
import { toId } from "../order/helper/orderUtils.js";
import { resolveTableSafe } from "../order/helper/tableUtils.js";
import TableCustomer from "../../../models/tableCustomer.model.js";

const INACTIVE_STATUSES = ["cancelled", "completed"];

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

async function attachCustomerInfoToOrders({ rid, orders }) {
  const slice = orders || [];
  if (!slice.length) return [];

  const tableCodes = [
    ...new Set(slice.map((o) => o.tableCode).filter(Boolean)),
  ];
  const tableIds = [
    ...new Set(slice.map((o) => o.tableId).filter(Boolean)),
  ];

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

  const withCustomer = await attachCustomerInfoToOrders({
    rid,
    orders: slice,
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

export const OrderQuery = {
  /** Single */
  async order(_, { id }) {
    if (!mongoose.isValidObjectId(id)) return null;
    return Order.findById(id).lean({ virtuals: true });
  },

  /** List with offset pagination */
  async orders(_, { filter = {}, limit = 50, offset = 0 }) {
    const q = buildFilter(filter);

    const safeLimit = Math.max(1, Math.min(200, limit));
    const safeOffset = Math.max(0, offset);

    const [itemsRaw, totalCount] = await Promise.all([
      Order.find(q)
        .sort({ createdAt: -1, _id: -1 })
        .skip(safeOffset)
        .limit(safeLimit)
        .lean({ virtuals: true }),
      Order.countDocuments(q),
    ]);

    // Attach customerInfo if restaurantId exists
    let items = itemsRaw;
    if (q.restaurantId) {
      items = await attachCustomerInfoToOrders({
        rid: q.restaurantId,
        orders: itemsRaw,
      });
    }

    return { items, totalCount };
  },

  /**
   * ACTIVE orders (exclude completed/cancelled) — cursor connection
   */
  async ordersByRestaurantNow(_, { restaurantId, limit = 20, cursor }) {
    if (!restaurantId) throw new Error("restaurantId is required");
    if (!mongoose.isValidObjectId(restaurantId))
      throw new Error("Invalid restaurantId");

    const rid = toId(restaurantId);

    const baseFilter = {
      restaurantId: rid,
      currentStatus: { $nin: INACTIVE_STATUSES },
    };

    return buildCursorConnection({ baseFilter, limit, cursor, rid });
  },

  /**
   * ALL orders by restaurant — cursor connection
   * (schema có ordersByRestaurant nhưng file cũ chưa implement)
   */
  async ordersByRestaurant(_, { restaurantId, limit = 20, cursor }) {
    if (!restaurantId) throw new Error("restaurantId is required");
    if (!mongoose.isValidObjectId(restaurantId))
      throw new Error("Invalid restaurantId");

    const rid = toId(restaurantId);

    const baseFilter = {
      restaurantId: rid,
      // không lọc status để lấy lịch sử đầy đủ
    };

    return buildCursorConnection({ baseFilter, limit, cursor, rid });
  },

  /**
   * Orders by tableCode (history batches)
   */
  async ordersByTableCode(
    _,
    { restaurantId, tableCode, limit = 50, offset = 0 }
  ) {
    if (!mongoose.isValidObjectId(restaurantId)) {
      throw new Error("Invalid restaurantId");
    }

    const rid = toId(restaurantId);
    const safeTableCode = String(tableCode).trim().toUpperCase();

    const q = { restaurantId: rid, tableCode: safeTableCode };

    const safeLimit = Math.max(1, Math.min(200, limit));
    const safeOffset = Math.max(0, offset);

    const [itemsRaw, totalCount] = await Promise.all([
      Order.find(q)
        .sort({ createdAt: -1, _id: -1 })
        .skip(safeOffset)
        .limit(safeLimit)
        .lean({ virtuals: true }),
      Order.countDocuments(q),
    ]);

    const items = await attachCustomerInfoToOrders({ rid, orders: itemsRaw });
    return { items, totalCount };
  },

  /**
   * Group by table => group theo rootCode (parentOrderCode || orderCode)
   * - hỗ trợ tách đơn: các đơn con sẽ vào chung group của đơn cha
   */
  async ordersGroupedByTable(_, { restaurantId, tableId, tableCode }) {
    if (!mongoose.isValidObjectId(restaurantId)) {
      throw new Error("Invalid restaurantId");
    }

    const rid = toId(restaurantId);
    let t = null;
    if (tableId && mongoose.isValidObjectId(tableId)) {
      t = await Table.findOne({ _id: tableId, restaurantId: rid })
        .select({ _id: 1, code: 1 })
        .lean();
    } else if (tableCode) {
      const safe = String(tableCode).trim().toUpperCase();
      t = await resolveTableSafe(restaurantId, safe);
    }
    if (!t) return [];

    const safeCode = (t.code || tableCode || "").toUpperCase();

    const f = {
      restaurantId: rid,
      tableId: t._id,
      tableCode: safeCode,
      // nếu muốn chỉ "đang hoạt động": currentStatus: { $nin: INACTIVE_STATUSES }
    };

    const docs = await Order.find(f)
      .sort({ createdAt: 1, _id: 1 })
      .lean({ virtuals: true });

    if (!docs.length) return [];

    // attach user (optional)
    const userIds = [
      ...new Set(
        docs.map((o) => (o.userId ? String(o.userId) : null)).filter(Boolean)
      ),
    ];

    let userMap = new Map();
    if (userIds.length) {
      const users = await User.find({ _id: { $in: userIds } })
        .select({ _id: 1, fullName: 1, email: 1, phone: 1 })
        .lean();

      userMap = new Map(
        users.map((u) => [
          String(u._id),
          {
            id: String(u._id),
            fullName: u.fullName || null,
            email: u.email || null,
            phone: u.phone || null,
          },
        ])
      );
    }

    const docsWithUser = docs.map((o) => {
      const u =
        (o.user && o.user.id && o.user) ||
        (o.userId && userMap.get(String(o.userId))) ||
        null;

      return { ...o, user: u };
    });

    // attach customerInfo once
    const docsWithCustomer = await attachCustomerInfoToOrders({
      rid,
      orders: docsWithUser,
    });

    return groupOrdersByRootCode(docsWithCustomer);
  },

  /**
   * Orders by user — cursor connection
   */
  async ordersByUser(_, { userId, limit = 20, cursor }) {
    if (!mongoose.isValidObjectId(userId)) throw new Error("Invalid userId");

    const uid = toId(userId);

    const baseFilter = {
      userId: uid,
    };

    // restaurantId không cố định ở đây -> customerInfo mapping cần dựa trên từng order.restaurantId
    // => tái dùng buildCursorConnection nhưng phải xử lý customerInfo theo nhiều restaurantId
    const safeLimit = Math.max(1, Math.min(200, limit));

    const q = Order.find(baseFilter).sort({ _id: 1 });
    if (cursor) q.where("_id").gt(cursor);
    q.limit(safeLimit + 1);

    const rows = await q.lean({ virtuals: true });

    const hasNextPage = rows.length > safeLimit;
    const slice = hasNextPage ? rows.slice(0, safeLimit) : rows;

    const lastCursor = slice.length
      ? String(slice[slice.length - 1]._id)
      : null;

    // customer mapping across restaurants
    const restaurantIds = [
      ...new Set(
        slice
          .map((o) => (o.restaurantId ? String(o.restaurantId) : null))
          .filter(Boolean)
      ),
    ].map(toId);

    // fetch customers per restaurant with OR tableCode/tableId
    const tableCodes = [
      ...new Set(slice.map((o) => o.tableCode).filter(Boolean)),
    ];
    const tableIds = [
      ...new Set(slice.map((o) => o.tableId).filter(Boolean)),
    ];

    let customerDocs = [];
    if (restaurantIds.length && (tableCodes.length || tableIds.length)) {
      customerDocs = await TableCustomer.find({
        restaurantId: { $in: restaurantIds },
        $or: [
          ...(tableCodes.length ? [{ tableCode: { $in: tableCodes } }] : []),
          ...(tableIds.length ? [{ tableId: { $in: tableIds } }] : []),
        ],
      })
        .select({
          restaurantId: 1,
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
    }

    const byKey = new Map(); // `${rid}|${tableCode}` or `${rid}|${tableId}`
    for (const c of customerDocs) {
      const rid = String(c.restaurantId);
      if (c.tableCode) byKey.set(`${rid}|TC:${String(c.tableCode)}`, c);
      if (c.tableId) byKey.set(`${rid}|TI:${String(c.tableId)}`, c);
    }

    const edges = slice.map((o) => {
      const rid = String(o.restaurantId || "");
      const tc =
        (o.tableId && byKey.get(`${rid}|TI:${String(o.tableId)}`)) ||
        (o.tableCode && byKey.get(`${rid}|TC:${String(o.tableCode)}`)) ||
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
        cursor: String(o._id),
        node: {
          id: String(o._id),
          ...o,
          customerInfo,
        },
      };
    });

    return {
      edges,
      pageInfo: {
        endCursor: lastCursor,
        hasNextPage,
      },
    };
  },

  async managerDashboard(_, { restaurantId, range = "week" }) {
    if (!mongoose.isValidObjectId(restaurantId)) {
      throw new Error("Invalid restaurantId");
    }
    const rid = toId(restaurantId);

    const now = new Date();
    const days = String(range).toLowerCase() === "month" ? 30 : 7;
    const start = new Date(now);
    start.setDate(start.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);
    const prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - days);

    const [ordersInRange, ordersPrevRange, allOrders, tableCount, menuCount, customerCount, promoCount, staffCount, stockItems] =
      await Promise.all([
        Order.find({ restaurantId: rid, createdAt: { $gte: start, $lte: now } }).lean(),
        Order.find({ restaurantId: rid, createdAt: { $gte: prevStart, $lt: start } }).lean(),
        Order.find({ restaurantId: rid }).sort({ createdAt: -1 }).limit(20).lean(),
        Table.countDocuments({ restaurantId: rid }),
        MenuItem.countDocuments({ restaurantId: rid }),
        Customer.countDocuments({ refRestaurants: { $in: [rid] } }),
        Promotion.countDocuments({
          restaurantId: rid,
          isActive: true,
          $or: [{ endAt: null }, { endAt: { $gte: now } }],
        }),
        Staff.countDocuments({
          primaryRestaurant: rid,
          employmentStatus: { $in: ["working", "on_leave"] },
        }),
        StockItem.find({ restaurantId: rid }).limit(200).lean(),
      ]);

    const statusCounts = {
      pending: 0,
      preparing: 0,
      completed: 0,
      cancelled: 0,
    };
    let revenue = 0;
    for (const o of ordersInRange) {
      const st = String(o.currentStatus || "");
      if (["pending", "confirmed", "customer_attached"].includes(st)) statusCounts.pending += 1;
      if (["preparing", "ready", "served"].includes(st)) statusCounts.preparing += 1;
      if (st === "completed") statusCounts.completed += 1;
      if (st === "cancelled") statusCounts.cancelled += 1;
      if (st === "completed" && ["paid", "partially_refunded", "refunded"].includes(String(o?.payment?.status || ""))) {
        revenue += Number(o?.totals?.grandTotal || 0);
      }
    }

    const bucketCount = String(range).toLowerCase() === "month" ? 4 : 7;
    const revenueBuckets = Array.from({ length: bucketCount }, (_, i) => ({
      key: String(range).toLowerCase() === "month" ? `W${i + 1}` : `${i + 1}`,
      current: 0,
      previous: 0,
    }));
    const assignBucket = (dateValue, isPrevious) => {
      const d = new Date(dateValue);
      if (!Number.isFinite(d.getTime())) return -1;
      if (String(range).toLowerCase() === "month") {
        const refStart = isPrevious ? prevStart : start;
        const diff = Math.floor((d.getTime() - refStart.getTime()) / (1000 * 60 * 60 * 24));
        return Math.max(0, Math.min(3, Math.floor(diff / 7)));
      }
      return d.getDay() === 0 ? 6 : d.getDay() - 1;
    };
    const orderBuckets = revenueBuckets.map((x) => ({ ...x, current: 0, previous: 0 }));
    for (const o of ordersInRange) {
      const bi = assignBucket(o.createdAt, false);
      if (bi < 0) continue;
      revenueBuckets[bi].current += Number(o?.totals?.grandTotal || 0);
      orderBuckets[bi].current += 1;
    }
    for (const o of ordersPrevRange) {
      const bi = assignBucket(o.createdAt, true);
      if (bi < 0) continue;
      revenueBuckets[bi].previous += Number(o?.totals?.grandTotal || 0);
      orderBuckets[bi].previous += 1;
    }

    const dishMap = new Map();
    for (const o of ordersInRange) {
      for (const item of o.items || []) {
        const name = item?.name?.trim();
        if (!name) continue;
        const qty = Number(item?.quantity || 1);
        const rev = Number(item?.lineSubtotal || 0);
        const prev = dishMap.get(name) || { quantity: 0, revenue: 0 };
        dishMap.set(name, { quantity: prev.quantity + qty, revenue: prev.revenue + rev });
      }
    }
    const topDishes = [...dishMap.entries()]
      .map(([dishName, v]) => ({ dishName, quantity: v.quantity, revenue: v.revenue }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    const userIds = [...new Set(allOrders.map((o) => (o.userId ? String(o.userId) : null)).filter(Boolean))];
    const users = userIds.length
      ? await User.find({ _id: { $in: userIds } }).select({ _id: 1, fullName: 1 }).lean()
      : [];
    const userMap = new Map(users.map((u) => [String(u._id), u.fullName || null]));

    const recentOrders = allOrders.slice(0, 8).map((o) => ({
      id: String(o._id),
      orderCode: o.orderCode || null,
      customerName: (o.userId && userMap.get(String(o.userId))) || "Khách vãng lai",
      orderType: o.orderType || null,
      tableCode: o.tableCode || null,
      status: o.currentStatus || null,
      total: Number(o?.totals?.grandTotal || 0),
      createdAt: o.createdAt || null,
      itemNames: (o.items || []).map((x) => x.name).filter(Boolean),
    }));

    const supplyIds = [...new Set(stockItems.map((x) => (x.supplyId ? String(x.supplyId) : null)).filter(Boolean))];
    const supplies = supplyIds.length
      ? await Supply.find({ _id: { $in: supplyIds } }).select({ _id: 1, name: 1 }).lean()
      : [];
    const supplyMap = new Map(supplies.map((s) => [String(s._id), s.name || "Supply"]));

    const lowStockItems = stockItems
      .filter((s) => Number(s.onHand || 0) - Number(s.reserved || 0) <= 10)
      .slice(0, 8)
      .map((s) => ({
        id: String(s._id),
        name: (s.supplyId && supplyMap.get(String(s.supplyId))) || "Nguyên liệu",
        onHand: Number(s.onHand || 0),
        reserved: Number(s.reserved || 0),
      }));

    return {
      restaurantId: String(rid),
      revenue,
      orders: ordersInRange.length,
      customers: customerCount,
      tables: tableCount,
      menuItems: menuCount,
      activePromotions: promoCount,
      workingStaff: staffCount,
      statusCounts,
      revenueTrend: revenueBuckets,
      orderTrend: orderBuckets,
      topDishes,
      recentOrders,
      lowStockItems,
    };
  },
};

export default { OrderQuery };
