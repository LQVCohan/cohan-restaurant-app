import mongoose from "mongoose";
import { Order, Table, User } from "../../../models/index.js";
import TableCustomer from "../../../models/tableCustomer.model.js";
import { toId } from "../order/helper/orderUtils.js";
import { resolveTableSafe } from "../order/helper/tableUtils.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";
import {
  activeTableSessionLookupFilter,
  childOrdersForSessionFilter,
  orderBatchOrLegacyFilter,
  withOrderBatchOrLegacyFilter,
} from "../../../utils/orderLifecycle.js";

const INACTIVE_STATUSES = ["draft", "cancelled", "completed", "failed"];

async function requireQueryRestaurantAccess(ctx, restaurantId) {
  if (!restaurantId || !mongoose.isValidObjectId(restaurantId)) {
    throw new Error("Invalid restaurantId");
  }
  const rid = toId(restaurantId);
  await requireRestaurantPermission(ctx, rid, PERMISSIONS.ORDER_READ);
  return rid;
}

function getRootCode(order) {
  return order.parentOrderCode || order.orderCode || "unknown";
}

async function attachCustomerInfoToOrders({ rid, orders }) {
  const slice = orders || [];
  if (!slice.length) return [];

  const tableCodes = [...new Set(slice.map((order) => order.tableCode).filter(Boolean))];
  const tableIds = [...new Set(slice.map((order) => order.tableId).filter(Boolean))];

  if (!tableCodes.length && !tableIds.length) return slice;

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
  for (const customer of customerDocs) {
    if (customer.tableCode) byTableCode.set(String(customer.tableCode), customer);
    if (customer.tableId) byTableId.set(String(customer.tableId), customer);
  }

  return slice.map((order) => {
    const customer =
      (order.tableId && byTableId.get(String(order.tableId))) ||
      (order.tableCode && byTableCode.get(String(order.tableCode))) ||
      null;

    return {
      ...order,
      customerInfo: customer
        ? {
            name: customer.customerName || null,
            phone: customer.customerPhone || null,
            email: customer.customerEmail || null,
            note: customer.note || null,
            partySize: customer.partySize || null,
            timeTo: customer.timeTo || null,
          }
        : null,
    };
  });
}

async function buildCursorConnection({ baseFilter, limit = 20, cursor, rid }) {
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 20));
  const query = Order.find(baseFilter).sort({ _id: 1 });
  if (cursor) query.where("_id").gt(cursor);
  query.limit(safeLimit + 1);

  const rows = await query.lean({ virtuals: true });
  const hasNextPage = rows.length > safeLimit;
  const slice = hasNextPage ? rows.slice(0, safeLimit) : rows;
  const withCustomer = await attachCustomerInfoToOrders({ rid, orders: slice });

  return {
    edges: withCustomer.map((order) => ({
      cursor: String(order._id),
      node: {
        id: String(order._id),
        ...order,
      },
    })),
    pageInfo: {
      endCursor: slice.length ? String(slice[slice.length - 1]._id) : null,
      hasNextPage,
    },
  };
}

function groupOrdersByRootCode(orders = []) {
  const map = new Map();
  for (const order of orders) {
    const key = String(getRootCode(order) || order._id);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(order);
  }

  return Array.from(map.entries()).map(([orderCode, group]) => {
    const sorted = group.sort((a, b) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      if (ta !== tb) return ta - tb;
      return String(a._id).localeCompare(String(b._id));
    });

    return {
      orderCode,
      tableCode: sorted[0]?.tableCode || null,
      tableId: sorted[0]?.tableId || null,
      restaurantId: sorted[0]?.restaurantId,
      latestStatus: sorted[sorted.length - 1]?.currentStatus || null,
      count: sorted.length,
      orders: sorted,
    };
  });
}

export const OrderCoreRecoveryQuery = {
  async ordersByRestaurantNow(_, { restaurantId, limit = 20, cursor }, ctx) {
    const rid = await requireQueryRestaurantAccess(ctx, restaurantId);
    const baseFilter = withOrderBatchOrLegacyFilter({
      restaurantId: rid,
      currentStatus: { $nin: INACTIVE_STATUSES },
    });
    return buildCursorConnection({ baseFilter, limit, cursor, rid });
  },

  async ordersByRestaurant(_, { restaurantId, limit = 20, cursor }, ctx) {
    const rid = await requireQueryRestaurantAccess(ctx, restaurantId);
    const baseFilter = withOrderBatchOrLegacyFilter({ restaurantId: rid });
    return buildCursorConnection({ baseFilter, limit, cursor, rid });
  },

  async ordersByTableCode(_, { restaurantId, tableCode, limit = 50, offset = 0 }, ctx) {
    const rid = await requireQueryRestaurantAccess(ctx, restaurantId);
    const safeTableCode = String(tableCode || "").trim().toUpperCase();
    const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
    const safeOffset = Math.max(0, Number(offset) || 0);
    const query = withOrderBatchOrLegacyFilter({ restaurantId: rid, tableCode: safeTableCode });

    const [itemsRaw, totalCount] = await Promise.all([
      Order.find(query).sort({ createdAt: -1, _id: -1 }).skip(safeOffset).limit(safeLimit).lean({ virtuals: true }),
      Order.countDocuments(query),
    ]);
    const items = await attachCustomerInfoToOrders({ rid, orders: itemsRaw });
    return { items, totalCount };
  },

  async ordersGroupedByTable(_, { restaurantId, tableId, tableCode }, ctx) {
    const rid = await requireQueryRestaurantAccess(ctx, restaurantId);
    let table = null;
    if (tableId && mongoose.isValidObjectId(tableId)) {
      table = await Table.findOne({ _id: tableId, restaurantId: rid }).select({ _id: 1, code: 1 }).lean();
    } else if (tableCode) {
      table = await resolveTableSafe(restaurantId, String(tableCode).trim().toUpperCase());
    }
    if (!table) return [];

    const safeCode = String(table.code || tableCode || "").toUpperCase();
    const docs = await Order.find({
      restaurantId: rid,
      tableId: table._id,
      tableCode: safeCode,
      ...orderBatchOrLegacyFilter(),
      currentStatus: { $nin: INACTIVE_STATUSES },
    })
      .sort({ createdAt: 1, _id: 1 })
      .lean({ virtuals: true });

    if (!docs.length) return [];

    const userIds = [...new Set(docs.map((order) => order.userId ? String(order.userId) : null).filter(Boolean))];
    let userMap = new Map();
    if (userIds.length) {
      const users = await User.find({ _id: { $in: userIds } }).select({ _id: 1, fullName: 1, email: 1, phone: 1 }).lean();
      userMap = new Map(users.map((user) => [String(user._id), {
        id: String(user._id),
        fullName: user.fullName || null,
        email: user.email || null,
        phone: user.phone || null,
      }]));
    }

    const docsWithUser = docs.map((order) => ({
      ...order,
      user: (order.user && order.user.id && order.user) || (order.userId && userMap.get(String(order.userId))) || null,
    }));
    const docsWithCustomer = await attachCustomerInfoToOrders({ rid, orders: docsWithUser });
    return groupOrdersByRootCode(docsWithCustomer);
  },

  async activeTableSessionOrders(_, { restaurantId, tableId }, ctx) {
    const rid = await requireQueryRestaurantAccess(ctx, restaurantId);
    if (!tableId || !mongoose.isValidObjectId(tableId)) throw new Error("Invalid tableId");

    const table = await Table.findOne({ _id: tableId, restaurantId: rid }).select({ _id: 1, code: 1 }).lean();
    if (!table) return { session: null, orders: [], tableId, tableCode: null };
    const safeCode = String(table.code || "").toUpperCase();

    const session = await Order.findOne(
      activeTableSessionLookupFilter({ restaurantId: rid, tableId: table._id, tableCode: safeCode }),
    ).sort({ openedAt: -1, createdAt: -1, _id: -1 }).lean({ virtuals: true });

    const findLegacyTableOrders = async () =>
      Order.find({
        restaurantId: rid,
        tableId: table._id,
        tableCode: safeCode,
        ...orderBatchOrLegacyFilter(),
        currentStatus: { $nin: INACTIVE_STATUSES },
      }).sort({ createdAt: 1, _id: 1 }).lean({ virtuals: true });

    let orders = [];
    if (session?._id) {
      orders = await Order.find({
        ...childOrdersForSessionFilter({ restaurantId: rid, parentOrderId: session._id }),
        currentStatus: { $nin: INACTIVE_STATUSES },
      }).sort({ createdAt: 1, _id: 1 }).lean({ virtuals: true });
      if (!orders.length) orders = await findLegacyTableOrders();
    } else {
      orders = await findLegacyTableOrders();
    }

    const docsWithCustomer = await attachCustomerInfoToOrders({ rid, orders });
    return {
      session: session || null,
      orders: docsWithCustomer.filter((order) => order?.orderKind !== "table_session"),
      tableId: String(table._id),
      tableCode: safeCode || null,
    };
  },
};
