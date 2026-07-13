import mongoose from "mongoose";
import { KitchenOrderWorkItem, Order, Table, User } from "../../../models/index.js";
import TableCustomer from "../../../models/tableCustomer.model.js";
import { toId } from "../order/helper/orderUtils.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import {
  requireAnyRestaurantPermission,
  requireRestaurantPermission,
} from "../../../src/services/auth/authorization.service.js";
import {
  scopeOrdersForPreparationStation,
  withPreparationStationOrderFilter,
} from "./accessGuard.js";
import {
  ACTIVE_SESSION_STATUSES,
  ORDER_KIND,
  ORDER_PAYMENT_STATUS,
  orderBatchOrLegacyFilter,
  withOrderBatchOrLegacyFilter,
} from "../../../utils/orderLifecycle.js";

const INACTIVE_STATUSES = ["draft", "cancelled", "completed", "failed"];

function parseRestaurantId(restaurantId) {
  if (!restaurantId || !mongoose.isValidObjectId(restaurantId)) {
    throw new Error("Invalid restaurantId");
  }
  return toId(restaurantId);
}

async function requireQueryRestaurantAccess(ctx, restaurantId) {
  const rid = parseRestaurantId(restaurantId);
  await requireRestaurantPermission(ctx, rid, PERMISSIONS.ORDER_READ);
  return rid;
}

async function requireTableOrderReadAccess(ctx, restaurantId) {
  const rid = parseRestaurantId(restaurantId);
  await requireAnyRestaurantPermission(ctx, rid, [
    PERMISSIONS.ORDER_READ,
    PERMISSIONS.RESERVATION_READ,
  ]);
  return rid;
}

function getRootCode(order) {
  return order.parentOrderCode || order.orderCode || "unknown";
}

function sameId(left, right) {
  return Boolean(left && right && String(left) === String(right));
}

function buildWorkItemKey(orderId, orderItemId) {
  if (!orderId || !orderItemId) return null;
  return `${String(orderId)}:${String(orderItemId)}`;
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
      .map((workItem) => [
        buildWorkItemKey(workItem.orderId, workItem.orderItemId),
        workItem,
      ])
      .filter(([key]) => Boolean(key)),
  );

  return slice.map((order) => ({
    ...order,
    items: (order.items || []).map((item) => {
      const snapshotStation = item?.station || item?.prepStation || null;
      const workItem = byOrderItem.get(
        buildWorkItemKey(order._id, item?._id),
      );
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

async function resolveTableScope({ rid, tableId, tableCode }) {
  let table = null;
  if (tableId && mongoose.isValidObjectId(tableId)) {
    table = await Table.findOne({ _id: tableId, restaurantId: rid })
      .select({
        _id: 1,
        code: 1,
        mergedFromTableIds: 1,
        mergeAnchorTableId: 1,
      })
      .lean();
  } else if (tableCode) {
    table = await Table.findOne({
      restaurantId: rid,
      code: String(tableCode).trim().toUpperCase(),
      mergedIntoTableId: null,
    })
      .select({
        _id: 1,
        code: 1,
        mergedFromTableIds: 1,
        mergeAnchorTableId: 1,
      })
      .lean();
  }
  if (!table) return null;

  const sourceIds = Array.isArray(table.mergedFromTableIds)
    ? table.mergedFromTableIds.filter(Boolean)
    : [];
  return {
    table,
    tableIds: [table._id, ...sourceIds],
    isMerged: sourceIds.length > 0,
  };
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

async function attachUsers(orders = []) {
  const userIds = [
    ...new Set(
      orders
        .map((order) => (order.userId ? String(order.userId) : null))
        .filter(Boolean),
    ),
  ];
  if (!userIds.length) return orders;

  const users = await User.find({ _id: { $in: userIds } })
    .select({ _id: 1, fullName: 1, email: 1, phone: 1 })
    .lean();
  const userMap = new Map(
    users.map((user) => [
      String(user._id),
      {
        id: String(user._id),
        fullName: user.fullName || null,
        email: user.email || null,
        phone: user.phone || null,
      },
    ]),
  );

  return orders.map((order) => ({
    ...order,
    user:
      (order.user && order.user.id && order.user) ||
      (order.userId && userMap.get(String(order.userId))) ||
      null,
  }));
}

async function buildCursorConnection({ baseFilter, limit = 20, cursor, rid, user }) {
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 20));
  const scopedFilter = withPreparationStationOrderFilter(baseFilter, user);
  const query = Order.find(scopedFilter).sort({ _id: 1 });
  if (cursor) query.where("_id").gt(cursor);
  query.limit(safeLimit + 1);

  const rows = await query.lean({ virtuals: true });
  const hasNextPage = rows.length > safeLimit;
  const slice = hasNextPage ? rows.slice(0, safeLimit) : rows;
  const withKitchenWorkItems = await attachKitchenWorkItemInfoToOrders({
    rid,
    orders: slice,
  });
  const withCustomer = await attachCustomerInfoToOrders({
    rid,
    orders: withKitchenWorkItems,
  });
  const scopedOrders = scopeOrdersForPreparationStation(withCustomer, user);

  return {
    edges: scopedOrders.map((order) => ({
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

async function loadActiveOrderBatches({ rid, tableIds, user }) {
  const filter = withPreparationStationOrderFilter(
    {
      restaurantId: rid,
      tableId: { $in: tableIds },
      ...orderBatchOrLegacyFilter(),
      currentStatus: { $nin: INACTIVE_STATUSES },
    },
    user,
  );
  const orders = await Order.find(filter)
    .sort({ createdAt: 1, _id: 1 })
    .lean({ virtuals: true });
  const enrichedOrders = await attachKitchenWorkItemInfoToOrders({ rid, orders });
  return scopeOrdersForPreparationStation(enrichedOrders, user);
}

export const OrderCoreRecoveryQuery = {
  async ordersByRestaurantNow(_, { restaurantId, limit = 20, cursor }, ctx) {
    const rid = await requireQueryRestaurantAccess(ctx, restaurantId);
    const baseFilter = withOrderBatchOrLegacyFilter({
      restaurantId: rid,
      currentStatus: { $nin: INACTIVE_STATUSES },
    });
    return buildCursorConnection({ baseFilter, limit, cursor, rid, user: ctx?.user });
  },

  async ordersByRestaurant(_, { restaurantId, limit = 20, cursor }, ctx) {
    const rid = await requireQueryRestaurantAccess(ctx, restaurantId);
    const baseFilter = withOrderBatchOrLegacyFilter({ restaurantId: rid });
    return buildCursorConnection({ baseFilter, limit, cursor, rid, user: ctx?.user });
  },

  async ordersByTableCode(_, { restaurantId, tableCode, limit = 50, offset = 0 }, ctx) {
    const rid = await requireTableOrderReadAccess(ctx, restaurantId);
    const scope = await resolveTableScope({ rid, tableCode });
    const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
    const safeOffset = Math.max(0, Number(offset) || 0);
    if (!scope) return { items: [], totalCount: 0 };

    const query = withPreparationStationOrderFilter(
      withOrderBatchOrLegacyFilter({
        restaurantId: rid,
        tableId: { $in: scope.tableIds },
      }),
      ctx?.user,
    );
    const [itemsRaw, totalCount] = await Promise.all([
      Order.find(query)
        .sort({ createdAt: -1, _id: -1 })
        .skip(safeOffset)
        .limit(safeLimit)
        .lean({ virtuals: true }),
      Order.countDocuments(query),
    ]);
    const withKitchenWorkItems = await attachKitchenWorkItemInfoToOrders({
      rid,
      orders: itemsRaw,
    });
    const withCustomer = await attachCustomerInfoToOrders({
      rid,
      orders: withKitchenWorkItems,
    });
    const items = scopeOrdersForPreparationStation(withCustomer, ctx?.user);
    return { items, totalCount };
  },

  async ordersGroupedByTable(_, { restaurantId, tableId, tableCode }, ctx) {
    const rid = await requireTableOrderReadAccess(ctx, restaurantId);
    const scope = await resolveTableScope({ rid, tableId, tableCode });
    if (!scope) return [];

    const docs = await loadActiveOrderBatches({ rid, tableIds: scope.tableIds, user: ctx?.user });
    if (!docs.length) return [];

    const docsWithUser = await attachUsers(docs);
    const docsWithCustomer = await attachCustomerInfoToOrders({ rid, orders: docsWithUser });
    return groupOrdersByRootCode(docsWithCustomer);
  },

  async activeTableSessionOrders(_, { restaurantId, tableId }, ctx) {
    const rid = await requireQueryRestaurantAccess(ctx, restaurantId);
    if (!tableId || !mongoose.isValidObjectId(tableId)) {
      throw new Error("Invalid tableId");
    }

    const scope = await resolveTableScope({ rid, tableId });
    if (!scope) return { session: null, orders: [], tableId, tableCode: null };

    const sessions = await Order.find({
      restaurantId: rid,
      tableId: { $in: scope.tableIds },
      orderKind: ORDER_KIND.TABLE_SESSION,
      sessionStatus: { $in: ACTIVE_SESSION_STATUSES },
      orderPaymentStatus: { $ne: ORDER_PAYMENT_STATUS.PAID },
    })
      .sort({ openedAt: 1, createdAt: 1, _id: 1 })
      .lean({ virtuals: true });

    const orders = await loadActiveOrderBatches({ rid, tableIds: scope.tableIds, user: ctx?.user });
    const docsWithCustomer = await attachCustomerInfoToOrders({ rid, orders });

    return {
      // Giữ field singular để tương thích client cũ; danh sách `orders` chứa mọi phiên nguồn.
      session: sessions[sessions.length - 1] || null,
      orders: docsWithCustomer.filter(
        (order) => order?.orderKind !== ORDER_KIND.TABLE_SESSION,
      ),
      tableId: String(scope.table._id),
      tableCode: String(scope.table.code || "").toUpperCase() || null,
    };
  },
};
