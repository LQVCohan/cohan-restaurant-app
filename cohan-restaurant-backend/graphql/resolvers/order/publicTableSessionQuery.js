import mongoose from "mongoose";

import { Order, Table } from "../../../models/index.js";
import {
  ACTIVE_TABLE_SESSION_SORT,
  INACTIVE_ORDER_STATUSES,
  activeTableSessionLookupFilter,
  childOrdersForSessionFilter,
} from "../../../utils/orderLifecycle.js";
import {
  TABLE_ACCESS_TOKEN_ERROR,
  buildPublicActiveTableSessionOrdersResult,
  normalizePublicTableCode,
  verifyTableAccessToken,
} from "../../../utils/publicTableSession.js";

const ACTIVE_PUBLIC_ORDER_FILTER = {
  currentStatus: { $nin: INACTIVE_ORDER_STATUSES },
  "payment.status": { $ne: "paid" },
};

function toId(id) {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

function assertTableAccessTokenMatches({ verifiedToken, restaurantId, tableId, tableCode }) {
  if (
    !verifiedToken ||
    verifiedToken.restaurantId !== String(restaurantId) ||
    verifiedToken.tableId !== String(tableId)
  ) {
    throw new Error(TABLE_ACCESS_TOKEN_ERROR);
  }

  if (
    tableCode !== undefined &&
    verifiedToken.tableCode &&
    verifiedToken.tableCode !== normalizePublicTableCode(tableCode)
  ) {
    throw new Error(TABLE_ACCESS_TOKEN_ERROR);
  }
}

function assertStoredTableAccessToken(table, token) {
  if (!table?.tableAccessToken || table.tableAccessToken !== String(token || "").trim()) {
    throw new Error(TABLE_ACCESS_TOKEN_ERROR);
  }
}

export async function publicActiveTableSessionOrders(
  _parent,
  { restaurantId, tableId, token },
) {
  const rid = toId(restaurantId);
  const tid = toId(tableId);

  if (!rid) throw new Error("Invalid restaurantId");
  if (!tid) throw new Error("Invalid tableId");

  const verifiedToken = verifyTableAccessToken(token);
  assertTableAccessTokenMatches({
    verifiedToken,
    restaurantId: rid,
    tableId: tid,
  });

  const table = await Table.findOne({ _id: tid, restaurantId: rid })
    .select({ _id: 1, code: 1, status: 1, tableAccessToken: 1 })
    .lean();

  if (!table) {
    throw new Error("Table not found");
  }
  assertStoredTableAccessToken(table, token);

  const safeCode = normalizePublicTableCode(table.code);
  assertTableAccessTokenMatches({
    verifiedToken,
    restaurantId: rid,
    tableId: tid,
    tableCode: safeCode,
  });

  const session = await Order.findOne(
    activeTableSessionLookupFilter({
      restaurantId: rid,
      tableId: tid,
      tableCode: safeCode,
    }),
  )
    .sort(ACTIVE_TABLE_SESSION_SORT)
    .lean({ virtuals: true });

  if (!session?._id) {
    return buildPublicActiveTableSessionOrdersResult({
      tableId: table._id,
      tableCode: safeCode,
      tableStatus: table.status,
      session: null,
      orders: [],
    });
  }

  const orders = await Order.find({
    $and: [
      childOrdersForSessionFilter({
        restaurantId: rid,
        parentOrderId: session._id,
      }),
      ACTIVE_PUBLIC_ORDER_FILTER,
    ],
  })
    .sort({ createdAt: 1, _id: 1 })
    .lean({ virtuals: true });

  return buildPublicActiveTableSessionOrdersResult({
    tableId: table._id,
    tableCode: safeCode,
    tableStatus: table.status,
    session,
    orders,
  });
}

export default {
  publicActiveTableSessionOrders,
};
