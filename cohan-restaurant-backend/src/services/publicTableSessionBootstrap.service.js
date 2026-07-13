import mongoose from "mongoose";
import { GraphQLError } from "graphql";

import { Order, Table } from "../../models/index.js";
import generateOrderCode from "../../utils/generateOrderCode.js";
import {
  ACTIVE_TABLE_SESSION_SORT,
  activeTableSessionLookupFilter,
  ensureActiveTableSessionForDineInOrder,
} from "../../utils/orderLifecycle.js";
import {
  TABLE_ACCESS_TOKEN_ERROR,
  normalizePublicTableCode,
  verifyTableAccessToken,
} from "../../utils/publicTableSession.js";

// A verified table QR may create a lightweight pre-service session. The table
// itself remains available/reserved until POS accepts the first submitted batch.
const SESSION_BOOTSTRAP_TABLE_STATUSES = new Set([
  "available",
  "reserved",
  "occupied",
]);

const toId = (value) =>
  value && mongoose.isValidObjectId(String(value))
    ? new mongoose.Types.ObjectId(String(value))
    : null;

async function createUniqueSessionCode({ restaurantId, tableCode, session }) {
  for (let index = 0; index < 10; index += 1) {
    const code = generateOrderCode("TABLE", new Date(), tableCode);
    const query = Order.exists({ restaurantId, orderCode: code });
    if (session) query.session(session);
    if (!(await query)) return code;
  }
  return generateOrderCode("TABLE", new Date(), tableCode);
}

async function loadScopedTable({ restaurantId, tableId, token, session }) {
  const rid = toId(restaurantId);
  const tid = toId(tableId);
  if (!rid) throw new Error("Invalid restaurantId");
  if (!tid) throw new Error("Invalid tableId");

  const verified = verifyTableAccessToken(token);
  if (
    verified.restaurantId !== String(rid) ||
    verified.tableId !== String(tid)
  ) {
    throw new Error(TABLE_ACCESS_TOKEN_ERROR);
  }

  let query = Table.findOne({ _id: tid, restaurantId: rid }).select({
    _id: 1,
    code: 1,
    status: 1,
    tableAccessToken: 1,
  });
  if (session) query = query.session(session);
  const table = await query.lean();

  if (!table) throw new Error("Table not found");
  if (
    !table.tableAccessToken ||
    table.tableAccessToken !== String(token || "").trim()
  ) {
    throw new Error(TABLE_ACCESS_TOKEN_ERROR);
  }

  const tableCode = normalizePublicTableCode(table.code);
  if (verified.tableCode && verified.tableCode !== tableCode) {
    throw new Error(TABLE_ACCESS_TOKEN_ERROR);
  }

  return { rid, tid, table, tableCode };
}

async function loadActiveSession({ rid, tid, tableCode, session }) {
  let query = Order.findOne(
    activeTableSessionLookupFilter({
      restaurantId: rid,
      tableId: tid,
      tableCode,
    }),
  ).sort(ACTIVE_TABLE_SESSION_SORT);
  if (session) query = query.session(session);
  return query.lean({ virtuals: true });
}

function assertTableIsOpenForQrService(table) {
  const tableStatus = String(table?.status || "").toLowerCase();
  if (SESSION_BOOTSTRAP_TABLE_STATUSES.has(tableStatus)) return;
  throw new GraphQLError(
    "Bàn hiện chưa sẵn sàng để bắt đầu phiên gọi món.",
    { extensions: { code: "TABLE_SESSION_NOT_OPEN" } },
  );
}

export async function ensurePublicTableSessionForAccess(input = {}) {
  const initial = await loadScopedTable(input);
  assertTableIsOpenForQrService(initial.table);

  const existing = await loadActiveSession(initial);
  if (existing) return existing;

  const transaction = await mongoose.startSession();
  let tableSession = null;
  try {
    await transaction.withTransaction(async () => {
      const current = await loadScopedTable({ ...input, session: transaction });
      assertTableIsOpenForQrService(current.table);

      const result = await ensureActiveTableSessionForDineInOrder({
        OrderModel: Order,
        createOrderCode: (_prefix, _now, tableCode) =>
          createUniqueSessionCode({
            restaurantId: current.rid,
            tableCode,
            session: transaction,
          }),
        restaurantId: current.rid,
        tableId: current.tid,
        tableCode: current.tableCode,
        userId: undefined,
        session: transaction,
      });
      tableSession = result.sessionOrder;
    });
  } finally {
    await transaction.endSession();
  }

  if (!tableSession) {
    throw new GraphQLError("Không thể mở phiên xác nhận cho bàn.", {
      extensions: { code: "TABLE_SESSION_NOT_OPEN" },
    });
  }
  return tableSession;
}

export const __testables = {
  SESSION_BOOTSTRAP_TABLE_STATUSES,
  createUniqueSessionCode,
  assertTableIsOpenForQrService,
};
