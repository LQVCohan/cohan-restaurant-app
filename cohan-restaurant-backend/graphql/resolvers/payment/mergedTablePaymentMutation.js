import mongoose from "mongoose";
import { Invoice, Order, Table } from "../../../models/index.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";
import { logEvent } from "../../../src/services/eventLog.service.js";
import {
  ACTIVE_SESSION_STATUSES,
  ORDER_KIND,
  ORDER_PAYMENT_STATUS,
  SESSION_STATUS,
  orderBatchOrLegacyFilter,
} from "../../../utils/orderLifecycle.js";
import PaymentMutation from "./mutation.js";
import StrictOrderPaymentMutation from "./strictOrderPaymentMutation.js";

const INACTIVE_ORDER_STATUSES = ["completed", "cancelled", "failed"];
const PENDING_ITEM_STATUSES = new Set([
  "pending",
  "confirmed",
  "preparing",
  "ready",
]);

const toId = (value) =>
  value && mongoose.isValidObjectId(value)
    ? new mongoose.Types.ObjectId(value)
    : null;

const hasPendingItemWork = (order) =>
  (order?.items || []).some((item) =>
    PENDING_ITEM_STATUSES.has(String(item?.status || "").toLowerCase()),
  );

const hasPendingAdjustmentRequests = (order) =>
  (order?.items || []).some(
    (item) =>
      (item?.voidRequests || []).some((request) => request?.status === "pending") ||
      (item?.returnRequests || []).some((request) => request?.status === "pending"),
  );

const isReadyForPayment = (order) =>
  String(order?.currentStatus || "").toLowerCase() === "served" &&
  !hasPendingItemWork(order) &&
  !hasPendingAdjustmentRequests(order);

async function resolveCompositeScope(input = {}) {
  const restaurantId = toId(input.restaurantId);
  const tableId = toId(input.tableId);
  if (!restaurantId || !tableId) return null;

  const table = await Table.findOne({ _id: tableId, restaurantId })
    .select({
      _id: 1,
      code: 1,
      restaurantId: 1,
      joinGroupId: 1,
      mergedFromTableIds: 1,
    })
    .lean();
  if (!table) throw new Error("Table not found");

  const sourceIds = Array.isArray(table.mergedFromTableIds)
    ? table.mergedFromTableIds.filter(Boolean)
    : [];
  return {
    restaurantId,
    table,
    sourceIds,
    tableIds: [table._id, ...sourceIds],
    isMerged: sourceIds.length > 0,
  };
}

async function loadActiveBatches(scope) {
  return Order.find({
    restaurantId: scope.restaurantId,
    tableId: { $in: scope.tableIds },
    ...orderBatchOrLegacyFilter(),
    currentStatus: { $nin: INACTIVE_ORDER_STATUSES },
  })
    .sort({ createdAt: 1, _id: 1 })
    .lean();
}

async function loadActiveSessions(scope) {
  return Order.find({
    restaurantId: scope.restaurantId,
    tableId: { $in: scope.tableIds },
    orderKind: ORDER_KIND.TABLE_SESSION,
    sessionStatus: { $in: ACTIVE_SESSION_STATUSES },
    orderPaymentStatus: { $ne: ORDER_PAYMENT_STATUS.PAID },
  })
    .sort({ openedAt: 1, createdAt: 1, _id: 1 })
    .lean();
}

const paymentRequestPatch = ({ requestedAt, source, requestedBy, note }) => ({
  orderPaymentStatus: ORDER_PAYMENT_STATUS.PAYMENT_REQUESTED,
  "payment.status": "payment_requested",
  "payment.requestedAt": requestedAt,
  "payment.requestSource": source,
  "payment.requestedBy": requestedBy,
  "payment.requestNote": note,
});

async function requestTablePayment(parent, args, ctx, info) {
  const scope = await resolveCompositeScope(args?.input || {});
  if (!scope?.isMerged) {
    return PaymentMutation.requestTablePayment(parent, args, ctx, info);
  }

  await requireRestaurantPermission(
    ctx,
    scope.restaurantId,
    PERMISSIONS.PAYMENT_WRITE,
  );
  const [orders, sessions] = await Promise.all([
    loadActiveBatches(scope),
    loadActiveSessions(scope),
  ]);
  if (!orders.length) {
    return {
      ok: false,
      warning: true,
      readyForPayment: false,
      message: "Bàn ghép chưa có món nào để yêu cầu thanh toán.",
      pendingOrderCodes: [],
      session: sessions[sessions.length - 1] || null,
      orders: [],
      requestedAt: null,
    };
  }

  const pendingOrderCodes = orders
    .filter((order) => !isReadyForPayment(order))
    .map((order) => order.orderCode || String(order._id));
  const requestedAt = new Date();
  const actorId = toId(ctx?.user?.id || ctx?.user?._id);
  const source = String(args?.input?.source || "").trim() || "pos";
  const note = String(args?.input?.note || "").trim() || null;
  const patch = paymentRequestPatch({
    requestedAt,
    source,
    requestedBy: toId(args?.input?.requestedBy) || actorId,
    note,
  });

  const tx = await mongoose.startSession();
  try {
    await tx.withTransaction(async () => {
      await Order.updateMany(
        { _id: { $in: orders.map((order) => order._id) } },
        { $set: patch },
        { session: tx },
      );
      if (sessions.length) {
        await Order.updateMany(
          { _id: { $in: sessions.map((session) => session._id) } },
          {
            $set: {
              ...patch,
              sessionStatus: SESSION_STATUS.READY_TO_PAY,
            },
          },
          { session: tx },
        );
      }
    });
  } finally {
    await tx.endSession();
  }

  await logEvent({
    restaurantId: scope.restaurantId,
    tableId: scope.table._id,
    actorUserId: ctx?.user?.id,
    verb: "order.request_payment",
    object: { kind: "MergedTable", id: scope.table._id, code: scope.table.code },
    meta: {
      orderIds: orders.map((order) => String(order._id)),
      sourceTableIds: scope.sourceIds.map(String),
      pendingOrderCodes,
    },
    ip: ctx?.req?.ip,
    userAgent: ctx?.req?.headers?.["user-agent"],
  });

  return {
    ok: true,
    warning: pendingOrderCodes.length > 0,
    readyForPayment: pendingOrderCodes.length === 0,
    message: pendingOrderCodes.length
      ? "Bàn ghép còn món chưa sẵn sàng thanh toán."
      : "Đã ghi nhận yêu cầu thanh toán cho toàn bộ bàn ghép.",
    pendingOrderCodes,
    session: sessions[sessions.length - 1] || null,
    orders: orders.map((order) => ({ ...order, ...patch })),
    requestedAt: requestedAt.toISOString(),
  };
}

async function clearTablePaymentRequest(parent, args, ctx, info) {
  const scope = await resolveCompositeScope(args?.input || {});
  if (!scope?.isMerged) {
    return PaymentMutation.clearTablePaymentRequest(parent, args, ctx, info);
  }

  await requireRestaurantPermission(
    ctx,
    scope.restaurantId,
    PERMISSIONS.PAYMENT_WRITE,
  );
  const [orders, sessions] = await Promise.all([
    loadActiveBatches(scope),
    loadActiveSessions(scope),
  ]);
  const unset = {
    "payment.requestedAt": "",
    "payment.requestSource": "",
    "payment.requestedBy": "",
    "payment.requestNote": "",
  };

  await Order.updateMany(
    { _id: { $in: orders.map((order) => order._id) } },
    {
      $set: {
        orderPaymentStatus: ORDER_PAYMENT_STATUS.UNPAID,
        "payment.status": "pending",
      },
      $unset: unset,
    },
  );
  if (sessions.length) {
    await Order.updateMany(
      { _id: { $in: sessions.map((session) => session._id) } },
      {
        $set: {
          sessionStatus: SESSION_STATUS.DINING,
          orderPaymentStatus: ORDER_PAYMENT_STATUS.UNPAID,
          "payment.status": "pending",
        },
        $unset: unset,
      },
    );
  }

  return {
    ok: true,
    message: "Đã hủy yêu cầu thanh toán của toàn bộ bàn ghép.",
    session: sessions[sessions.length - 1] || null,
    orders,
  };
}

async function payOrdersByTableId(parent, args, ctx, info) {
  const scope = await resolveCompositeScope(args?.input || {});
  if (!scope?.isMerged) {
    return StrictOrderPaymentMutation.payOrdersByTableId(parent, args, ctx, info);
  }

  const orders = await loadActiveBatches(scope);
  if (!orders.length) {
    return {
      warning: true,
      pendingOrderCodes: [],
      invoice: null,
      transaction: null,
      cashflow: null,
    };
  }

  const result = await StrictOrderPaymentMutation.payOrdersByOrderIds(
    parent,
    {
      input: {
        ...args.input,
        tableId: undefined,
        orderIds: orders.map((order) => String(order._id)),
      },
    },
    ctx,
    info,
  );

  if (!result?.invoice) return result;

  const parentSessionIds = [
    ...new Set(
      orders
        .map((order) => order.parentOrderId || order.rootOrderId)
        .filter(Boolean)
        .map(String),
    ),
  ].map(toId).filter(Boolean);
  const now = new Date();

  if (parentSessionIds.length) {
    await Order.updateMany(
      {
        _id: { $in: parentSessionIds },
        restaurantId: scope.restaurantId,
        orderKind: ORDER_KIND.TABLE_SESSION,
      },
      {
        $set: {
          sessionStatus: SESSION_STATUS.CLOSED,
          orderPaymentStatus: ORDER_PAYMENT_STATUS.PAID,
          activeSessionKey: null,
          closedAt: now,
          currentStatus: "completed",
          "payment.status": "paid",
          "payment.paidAt": now,
        },
      },
    );
  }

  await Table.updateMany(
    { _id: { $in: scope.tableIds }, restaurantId: scope.restaurantId },
    { $set: { status: "available" } },
  );
  await Invoice.updateOne(
    { _id: result.invoice._id, restaurantId: scope.restaurantId },
    {
      $set: {
        tableCode: scope.table.code,
        "meta.tableMerge": {
          mergedTableId: String(scope.table._id),
          mergedTableCode: scope.table.code,
          sourceTableIds: scope.sourceIds.map(String),
        },
      },
    },
  );
  result.invoice.tableCode = scope.table.code;

  await logEvent({
    restaurantId: scope.restaurantId,
    tableId: scope.table._id,
    actorUserId: ctx?.user?.id,
    verb: "order.pay_merged_table",
    object: { kind: "MergedTable", id: scope.table._id, code: scope.table.code },
    meta: {
      orderIds: orders.map((order) => String(order._id)),
      parentSessionIds: parentSessionIds.map(String),
      sourceTableIds: scope.sourceIds.map(String),
      invoiceId: String(result.invoice._id),
    },
    ip: ctx?.req?.ip,
    userAgent: ctx?.req?.headers?.["user-agent"],
  });

  return result;
}

export default {
  requestTablePayment,
  clearTablePaymentRequest,
  payOrdersByTableId,
};
