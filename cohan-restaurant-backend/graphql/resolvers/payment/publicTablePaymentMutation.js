import mongoose, { startSession } from "mongoose";

import { EventLog, Order, Table } from "../../../models/index.js";
import { emitRestaurantEvent } from "../order/helper/emitOrderEvent.js";
import {
  ACTIVE_TABLE_SESSION_SORT,
  INACTIVE_ORDER_STATUSES,
  ORDER_KIND,
  ORDER_PAYMENT_STATUS,
  SESSION_STATUS,
  activeTableSessionLookupFilter,
  childOrdersForSessionFilter,
} from "../../../utils/orderLifecycle.js";
import {
  TABLE_ACCESS_TOKEN_ERROR,
  buildPublicRequestTablePaymentResult,
  normalizePublicTableCode,
  verifyTableAccessToken,
} from "../../../utils/publicTableSession.js";

const ACTIVE_CUSTOMER_REQUEST_STATUSES = new Set(["PENDING", "ACKNOWLEDGED"]);
const DEFAULT_TABLE_STAFF_CALL_MESSAGE = "Khách cần hỗ trợ tại bàn.";
const DEFAULT_TABLE_PAYMENT_REQUEST_MESSAGE = "Khách yêu cầu thanh toán";
const CUSTOMER_REQUEST_MESSAGE_MAX_LENGTH = 200;

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

function normalizeCustomerRequestMessage(value, fallback) {
  const normalized = String(value || "").trim().replace(/\s+/g, " ");
  return (normalized || fallback).slice(0, CUSTOMER_REQUEST_MESSAGE_MAX_LENGTH);
}

function buildCustomerRequest(type, message, createdAt = new Date()) {
  return {
    requestId: new mongoose.Types.ObjectId().toString(),
    type,
    status: "PENDING",
    message,
    createdAt,
    source: "CUSTOMER_TRACKING",
  };
}

function findActiveCustomerRequest(order, type) {
  return (order?.customerRequests || []).find(
    (request) =>
      request?.type === type &&
      ACTIVE_CUSTOMER_REQUEST_STATUSES.has(String(request?.status || "").toUpperCase()),
  );
}


async function emitTableCustomerRequestEvent(ctx, { eventType, restaurantId, tableId, tableCode, request }) {
  try {
    await emitRestaurantEvent(ctx, restaurantId, eventType, {
      restaurantId: String(restaurantId),
      tableId: String(tableId),
      tableCode: tableCode || null,
      requestType: request?.type || null,
      requestStatus: request?.status || null,
      requestId: request?.requestId || null,
      createdAt: request?.createdAt ? new Date(request.createdAt).toISOString() : null,
    });
  } catch (error) {
    console.warn("[SOCKET.IO] Failed to emit table customer request event", error?.message || error);
  }
}

function serializeCustomerRequestResult(request, message) {
  return {
    ok: true,
    message,
    requestId: request?.requestId || null,
    status: request?.status || null,
    requestedAt: request?.createdAt ? new Date(request.createdAt).toISOString() : null,
  };
}

async function loadPublicTableSessionAccess({ restaurantId, tableId, tableCode, token }) {
  const rid = toId(restaurantId);
  const tid = toId(tableId);
  const normalizedInputTableCode = normalizePublicTableCode(tableCode);

  if (!rid) throw new Error("Invalid restaurantId");
  if (!tid) throw new Error("Invalid tableId");

  const verifiedToken = verifyTableAccessToken(token);
  assertTableAccessTokenMatches({
    verifiedToken,
    restaurantId: rid,
    tableId: tid,
    tableCode: normalizedInputTableCode ?? undefined,
  });

  const table = await Table.findOne({ _id: tid, restaurantId: rid })
    .select({ _id: 1, code: 1, tableAccessToken: 1 })
    .lean();

  if (!table) {
    throw new Error("Table not found");
  }
  assertStoredTableAccessToken(table, token);

  const safeCode = normalizePublicTableCode(table.code);

  if (normalizedInputTableCode && normalizedInputTableCode !== safeCode) {
    throw new Error(TABLE_ACCESS_TOKEN_ERROR);
  }

  assertTableAccessTokenMatches({
    verifiedToken,
    restaurantId: rid,
    tableId: tid,
    tableCode: safeCode,
  });

  const activeSession = await Order.findOne(
    activeTableSessionLookupFilter({
      restaurantId: rid,
      tableId: tid,
      tableCode: safeCode,
    }),
  )
    .sort(ACTIVE_TABLE_SESSION_SORT)
    .lean({ virtuals: true });

  return { rid, tid, safeCode, activeSession };
}

export async function publicRequestTablePayment(_parent, { input }, ctx) {
  const { note } = input || {};
  const requestNote = String(note || "").trim() || null;
  const { rid, tid, safeCode, activeSession } = await loadPublicTableSessionAccess(input || {});

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
  const existingPaymentRequest = findActiveCustomerRequest(activeSession, "PAYMENT_REQUEST");
  const paymentRequest =
    existingPaymentRequest ||
    buildCustomerRequest(
      "PAYMENT_REQUEST",
      normalizeCustomerRequestMessage(requestNote, DEFAULT_TABLE_PAYMENT_REQUEST_MESSAGE),
      requestedAt,
    );

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

    const sessionUpdate = {
      $set: {
        sessionStatus: SESSION_STATUS.READY_TO_PAY,
        orderPaymentStatus: ORDER_PAYMENT_STATUS.PAYMENT_REQUESTED,
        "payment.status": "payment_requested",
        "payment.requestedAt": requestedAt,
        "payment.requestSource": "customer_table",
        "payment.requestedBy": null,
        "payment.requestNote": requestNote,
        customerVisibleNote: "Yêu cầu thanh toán đã được gửi cho nhân viên.",
        lastCustomerPaymentRequestAt: requestedAt,
      },
    };

    if (!existingPaymentRequest) {
      sessionUpdate.$push = { customerRequests: paymentRequest };
    }

    await Order.updateOne(
      {
        _id: activeSession._id,
        restaurantId: rid,
        orderKind: ORDER_KIND.TABLE_SESSION,
      },
      sessionUpdate,
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
          customerRequestId: paymentRequest.requestId,
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

    await emitTableCustomerRequestEvent(ctx, {
      eventType: "TABLE_PAYMENT_REQUESTED",
      restaurantId: rid,
      tableId: tid,
      tableCode: safeCode,
      request: paymentRequest,
    });

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

export async function publicCallStaffForTable(_parent, { input }, ctx) {
  const { note } = input || {};
  const { rid, tid, safeCode, activeSession } = await loadPublicTableSessionAccess(input || {});

  if (!activeSession) {
    return {
      ok: false,
      message: "Không tìm thấy phiên bàn đang hoạt động.",
      requestId: null,
      status: null,
      requestedAt: null,
    };
  }

  const existingStaffCall = findActiveCustomerRequest(activeSession, "STAFF_CALL");
  if (existingStaffCall) {
    return serializeCustomerRequestResult(
      existingStaffCall,
      "Yêu cầu hỗ trợ đã được gửi. Vui lòng chờ nhân viên.",
    );
  }

  const requestedAt = new Date();
  const request = buildCustomerRequest(
    "STAFF_CALL",
    normalizeCustomerRequestMessage(note, DEFAULT_TABLE_STAFF_CALL_MESSAGE),
    requestedAt,
  );

  const updateResult = await Order.updateOne(
    {
      _id: activeSession._id,
      restaurantId: rid,
      orderKind: ORDER_KIND.TABLE_SESSION,
    },
    {
      $set: {
        customerVisibleNote: request.message,
        lastCustomerStaffCallAt: requestedAt,
      },
      $push: { customerRequests: request },
    },
  );

  if (!updateResult?.matchedCount) {
    return {
      ok: false,
      message: "Không tìm thấy phiên bàn đang hoạt động.",
      requestId: null,
      status: null,
      requestedAt: null,
    };
  }

  await EventLog.log({
    restaurantId: rid,
    verb: "order.call_staff",
    actorUserId: ctx?.user?.id || null,
    object: { kind: "TableSession", id: activeSession._id },
    source: "customer_table",
    status: "success",
    meta: {
      customerRequestId: request.requestId,
      tableId: String(tid),
      tableCode: safeCode,
      message: request.message,
    },
  });

  await emitTableCustomerRequestEvent(ctx, {
    eventType: "TABLE_CUSTOMER_REQUEST_CREATED",
    restaurantId: rid,
    tableId: tid,
    tableCode: safeCode,
    request,
  });

  return serializeCustomerRequestResult(
    request,
    "Đã gửi yêu cầu hỗ trợ đến nhân viên.",
  );
}

export default {
  publicRequestTablePayment,
  publicCallStaffForTable,
};