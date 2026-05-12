import mongoose, { startSession } from "mongoose";

import { EventLog, Order, Table } from "../../../models/index.js";
import {
  ACTIVE_TABLE_SESSION_SORT,
  INACTIVE_ORDER_STATUSES,
  ORDER_KIND,
  ORDER_PAYMENT_STATUS,
  SESSION_STATUS,
  activeTableSessionLookupFilter,
  childOrdersForSessionFilter,
} from "../../../utils/orderLifecycle.js";
import { buildPublicRequestTablePaymentResult } from "../../../utils/publicTableSession.js";

function toId(id) {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

function hasPendingItemWork(order) {
  return (order?.items || []).some((item) =>
    ["pending", "confirmed", "preparing", "ready"].includes(
      String(item?.status || "").toLowerCase(),
    ),
  );
}

function hasPendingAdjustmentRequests(order) {
  return (order?.items || []).some(
    (item) =>
      (item?.voidRequests || []).some((request) => request?.status === "pending") ||
      (item?.returnRequests || []).some((request) => request?.status === "pending"),
  );
}

function isReadyForPayment(order) {
  const status = String(order?.currentStatus || "").toLowerCase();

  return (
    ["served", "completed"].includes(status) &&
    !hasPendingItemWork(order) &&
    !hasPendingAdjustmentRequests(order)
  );
}

function applyRequestPaymentState(order, requestedAt, requestNote) {
  if (!order) return null;

  return {
    ...order,
    orderPaymentStatus: ORDER_PAYMENT_STATUS.PAYMENT_REQUESTED,
    payment: {
      ...(order?.payment || {}),
      status: "payment_requested",
      requestedAt,
      requestedBy: null,
      requestSource: "customer_table",
      requestNote,
    },
  };
}

export async function publicRequestTablePayment(_parent, { input }, ctx) {
  const { restaurantId, tableId, note } = input || {};

  const rid = toId(restaurantId);
  const tid = toId(tableId);
  const requestNote = String(note || "").trim() || null;

  if (!rid) throw new Error("Invalid restaurantId");
  if (!tid) throw new Error("Invalid tableId");

  const table = await Table.findOne({ _id: tid, restaurantId: rid })
    .select({ _id: 1, code: 1 })
    .lean();

  if (!table) {
    throw new Error("Table not found");
  }

  const safeCode = String(table.code || "").trim().toUpperCase() || null;

  const activeSession = await Order.findOne(
    activeTableSessionLookupFilter({
      restaurantId: rid,
      tableId: tid,
      tableCode: safeCode,
    }),
  )
    .sort(ACTIVE_TABLE_SESSION_SORT)
    .lean({ virtuals: true });

  if (!activeSession) {
    return buildPublicRequestTablePaymentResult({
      ok: false,
      warning: true,
      readyForPayment: false,
      message: "Không tìm thấy phiên bàn đang hoạt động.",
      pendingOrderCodes: [],
      requestedAt: null,
      session: null,
      orders: [],
    });
  }

  const childOrders = await Order.find({
    $and: [
      childOrdersForSessionFilter({
        restaurantId: rid,
        parentOrderId: activeSession._id,
      }),
      {
        currentStatus: { $nin: INACTIVE_ORDER_STATUSES },
        "payment.status": { $ne: "paid" },
      },
    ],
  })
    .sort({ createdAt: 1, _id: 1 })
    .lean({ virtuals: true });

  if (!childOrders.length) {
    return buildPublicRequestTablePaymentResult({
      ok: false,
      warning: true,
      readyForPayment: false,
      message: "Bàn chưa có món nào để yêu cầu thanh toán.",
      pendingOrderCodes: [],
      requestedAt: null,
      session: null,
      orders: [],
    });
  }

  const pendingOrderCodes = childOrders
    .filter((order) => !isReadyForPayment(order))
    .map((order) => order.orderCode || String(order._id));

  const readyForPayment = pendingOrderCodes.length === 0;
  const warning = !readyForPayment;
  const requestedAt = new Date();

  const transaction = await startSession();
  transaction.startTransaction();

  try {
    await Order.updateMany(
      { _id: { $in: childOrders.map((order) => order._id) } },
      {
        $set: {
          orderPaymentStatus: ORDER_PAYMENT_STATUS.PAYMENT_REQUESTED,
          "payment.status": "payment_requested",
          "payment.requestedAt": requestedAt,
          "payment.requestSource": "customer_table",
          "payment.requestedBy": null,
          "payment.requestNote": requestNote,
        },
      },
      { session: transaction },
    );

    await Order.updateMany(
      {
        _id: activeSession._id,
        restaurantId: rid,
        orderKind: ORDER_KIND.TABLE_SESSION,
      },
      {
        $set: {
          sessionStatus: SESSION_STATUS.READY_TO_PAY,
          orderPaymentStatus: ORDER_PAYMENT_STATUS.PAYMENT_REQUESTED,
          "payment.status": "payment_requested",
          "payment.requestedAt": requestedAt,
          "payment.requestSource": "customer_table",
          "payment.requestedBy": null,
          "payment.requestNote": requestNote,
        },
      },
      { session: transaction },
    );

    await EventLog.log(
      {
        restaurantId: rid,
        verb: "order.request_payment",
        actorUserId: ctx?.user?.id || null,
        object: { kind: "TableSession", id: activeSession._id },
        source: "customer_table",
        status: "success",
        meta: {
          requestOrderIds: childOrders.map((order) => String(order._id)),
          parentSessionIds: [String(activeSession._id)],
          tableId: String(tid),
          tableCode: safeCode,
          requestSource: "customer_table",
          requestedBy: null,
          requestNote,
          pendingOrderCodes,
          readyForPayment,
        },
      },
      { session: transaction },
    );

    await transaction.commitTransaction();
    transaction.endSession();

    return buildPublicRequestTablePaymentResult({
      ok: true,
      warning,
      readyForPayment,
      message: warning
        ? "Bàn còn món chưa sẵn sàng thanh toán."
        : "Đã ghi nhận yêu cầu thanh toán.",
      pendingOrderCodes,
      requestedAt,
      session: {
        ...applyRequestPaymentState(activeSession, requestedAt, requestNote),
        sessionStatus: SESSION_STATUS.READY_TO_PAY,
      },
      orders: childOrders.map((order) =>
        applyRequestPaymentState(order, requestedAt, requestNote),
      ),
    });
  } catch (error) {
    await transaction.abortTransaction().catch(() => {});
    transaction.endSession();
    throw error;
  }
}

export default {
  publicRequestTablePayment,
};
