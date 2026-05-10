import mongoose, { startSession } from "mongoose";
import dayjs from "dayjs";
import process from "node:process";
import { generateInvoiceNumber } from "../../../utils/generateInvoiceNumber.ts";
import {
  Order,
  Invoice,
  PaymentTransaction,
  Cashflow,
  EventLog,
  Table,
  Restaurant,
  PaymentSession,
} from "../../../models/index.js";
import { createReservationPayment } from "../../../src/services/payment/paymentSession.service.js";
import { requireRestaurantAccess } from "../../guards.js";
import { emitOrderEvent } from "../order/helper/emitOrderEvent.js";
import {
  activeTableSessionLookupFilter,
  childOrdersForSessionFilter,
  deriveParentSessionIdsFromOrders,
  orderBatchOrLegacyFilter,
  ORDER_KIND,
  SESSION_STATUS,
  ORDER_PAYMENT_STATUS,
} from "../../../utils/orderLifecycle.js";

const INACTIVE_ORDER_STATUSES = ["completed", "cancelled", "failed"];
const EXCLUDED_ITEM_STATUSES = new Set(["cancelled", "returned"]);

function hasPendingItemWork(order) {
  return (order?.items || []).some((item) => ["pending", "confirmed", "preparing", "ready"].includes(String(item?.status || "").toLowerCase()));
}

function hasPendingAdjustmentRequests(order) {
  return (order?.items || []).some((item) =>
    (item?.voidRequests || []).some((req) => req?.status === "pending") ||
    (item?.returnRequests || []).some((req) => req?.status === "pending"),
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

function toId(id) {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

function buildLineKey(item, unitPrice, modifiersPrice) {
  return JSON.stringify({
    dishId: item.dishId || "",
    name: item.name || "",
    unit: item.unit || "",
    price: unitPrice,
    modifiersPrice,
    servingKey: item.servingKey || "",
    method: item.method || "",
    proofImages: (item.proofImages || []).join("|"),
    modifiers: (item.modifiers || []).map((m) => ({
      optionId: m.optionId || "",
      optionName: m.optionName || "",
      groupId: m.groupId || "",
      price: m.price || 0,
    })),
  });
}

function normalizeLine(item) {
  const qty = Number(item.quantity || 0);
  if (!(qty > 0)) return null;

  const unitPrice = Number(
    item.unitPrice ?? item.price ?? item.baseUnitPrice ?? 0
  );
  const modifiersPrice = Number(
    item.modifiersPricePerUnit ?? item.modifiersPrice ?? 0
  );

  const key = buildLineKey(item, unitPrice, modifiersPrice);
  const lineTotal = (unitPrice + modifiersPrice) * qty;

  return {
    key,
    line: {
      dishId: String(item.dishId ?? ""),
      menuId: String(item.menuId ?? ""),
      categoryId: String(item.categoryId ?? ""),
      name: item.name,
      unit: item.unit,
      price: unitPrice,
      modifiersPrice: modifiersPrice,
      quantity: qty,
      totals: lineTotal,
      modifiers: (item.modifiers ?? []).map((m) => ({
        optionId: m.optionId,
        optionName: m.optionName,
        groupId: m.groupId,
        price: m.price,
      })),
    },
    subtotal: lineTotal,
  };
}

function mergeLines(lines) {
  const map = new Map();
  lines.forEach((l) => {
    if (!l) return;
    const existing = map.get(l.key);
    if (!existing) {
      map.set(l.key, { ...l.line });
    } else {
      existing.quantity += l.line.quantity;
      existing.totals += l.line.totals;
    }
  });
  return Array.from(map.values());
}

function accumulateTotals(order, subtotalIncluded, linesSubtotal) {
  const t = order.totals || {};
  const baseSubtotal =
    order.items?.reduce(
      (sum, it) =>
        EXCLUDED_ITEM_STATUSES.has(it.status) ? sum : sum + (it.lineSubtotal || 0),
      0
    ) || 0;

  const ratio = baseSubtotal > 0 ? linesSubtotal / baseSubtotal : 1;

  const discount = (t.discount || 0) * ratio;
  const tax = (t.tax || 0) * ratio;
  const service = (t.service || 0) * ratio;
  const shippingFee = (t.shippingFee || 0) * ratio;

  return {
    subtotal: subtotalIncluded,
    discount,
    tax,
    service,
    shippingFee,
    grandTotal: subtotalIncluded - discount + tax + service + shippingFee,
  };
}

function deriveParentSessionObjectIds(orders = []) {
  return deriveParentSessionIdsFromOrders(orders)
    .map((id) => toId(id))
    .filter(Boolean);
}

function applyRequestPaymentState(order, fields) {
  return {
    ...order,
    orderPaymentStatus: ORDER_PAYMENT_STATUS.PAYMENT_REQUESTED,
    payment: {
      ...(order?.payment || {}),
      status: "payment_requested",
      requestedAt: fields.requestedAt,
      requestSource: fields.requestSource,
      requestedBy: fields.requestedBy,
      requestNote: fields.requestNote,
    },
  };
}

export const requestTablePayment = async (_parent, { input }, ctx) => {
  const {
    restaurantId,
    tableId,
    tableCode,
    source,
    requestedBy,
    note,
  } = input || {};

  const rid = toId(restaurantId);
  const tid = toId(tableId);
  const normalizedTableCode = String(tableCode || "").trim() || null;
  const actorId = toId(ctx?.user?.id || ctx?.user?._id);
  const requestSource = String(source || "").trim() || "unknown";
  const requestedByValue = toId(requestedBy) || actorId || null;
  const requestNote = String(note || "").trim() || null;

  if (!rid) throw new Error("Invalid restaurantId");
  if (!tid) throw new Error("Invalid tableId");

  await requireRestaurantAccess(ctx, rid);

  const activeSession = await Order.findOne(
    activeTableSessionLookupFilter({
      restaurantId: rid,
      tableId: tid,
      tableCode: normalizedTableCode,
    }),
  )
    .sort({ openedAt: -1, createdAt: -1, _id: -1 })
    .lean();

  if (!activeSession) {
    return {
      ok: false,
      warning: true,
      readyForPayment: false,
      message: "Không tìm thấy phiên bàn đang hoạt động.",
      pendingOrderCodes: [],
      session: null,
      orders: [],
      requestedAt: null,
    };
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
    .lean();

  if (!childOrders.length) {
    return {
      ok: false,
      warning: true,
      readyForPayment: false,
      message: "Bàn chưa có món nào để yêu cầu thanh toán.",
      pendingOrderCodes: [],
      session: activeSession,
      orders: [],
      requestedAt: null,
    };
  }

  const pendingOrderCodes = childOrders
    .filter((order) => !isReadyForPayment(order))
    .map((order) => order.orderCode || String(order._id));

  const readyForPayment = pendingOrderCodes.length === 0;
  const warning = !readyForPayment;
  const requestedAt = new Date();

  const session = await startSession();
  session.startTransaction();

  try {
    const childOrderIds = childOrders.map((order) => order._id);

    await Order.updateMany(
      {
        _id: { $in: childOrderIds },
      },
      {
        $set: {
          orderPaymentStatus: ORDER_PAYMENT_STATUS.PAYMENT_REQUESTED,
          "payment.status": "payment_requested",
          "payment.requestedAt": requestedAt,
          "payment.requestSource": requestSource,
          "payment.requestedBy": requestedByValue,
          "payment.requestNote": requestNote,
        },
      },
      { session },
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
          "payment.requestSource": requestSource,
          "payment.requestedBy": requestedByValue,
          "payment.requestNote": requestNote,
        },
      },
      { session },
    );

    await EventLog.log(
      {
        restaurantId: rid,
        verb: "order.request_payment",
        actorUserId: ctx?.user?.id,
        object: { kind: "TableSession", id: activeSession._id },
        source: "pos",
        status: "success",
        meta: {
          requestOrderIds: childOrderIds.map(String),
          parentSessionIds: [String(activeSession._id)],
          tableId: String(tid),
          tableCode: normalizedTableCode,
          requestSource,
          requestedBy: requestedByValue ? String(requestedByValue) : null,
          requestNote,
          pendingOrderCodes,
          readyForPayment,
        },
      },
      { session },
    );

    await session.commitTransaction();
    session.endSession();

    const responseFields = {
      requestedAt,
      requestSource,
      requestedBy: requestedByValue,
      requestNote,
    };

    return {
      ok: true,
      warning,
      readyForPayment,
      message: warning
        ? "Bàn còn món chưa sẵn sàng thanh toán."
        : "Đã ghi nhận yêu cầu thanh toán.",
      pendingOrderCodes,
      session: {
        ...applyRequestPaymentState(activeSession, responseFields),
        sessionStatus: SESSION_STATUS.READY_TO_PAY,
      },
      orders: childOrders.map((order) => applyRequestPaymentState(order, responseFields)),
      requestedAt: requestedAt.toISOString(),
    };
  } catch (err) {
    await session.abortTransaction().catch(() => {});
    session.endSession();
    throw err;
  }
};

export const payOrdersByTableId = async (_parent, { input }, ctx) => {
  const {
    restaurantId,
    tableId,
    paidAmount,
    method,
    paidAt,
    note,
    externalRef,
    includeUnserved = false,
  } = input || {};

  const rid = toId(restaurantId);
  const tid = toId(tableId);
  const actorId = toId(ctx?.user?.id || ctx?.user?._id);

  if (!rid) throw new Error("Invalid restaurantId");
  if (!tid) throw new Error("Invalid tableId");
  await requireRestaurantAccess(ctx, rid);

  const normMethod = String(method || "").toLowerCase();
  if (!["cash", "card", "transfer", "bank_transfer", "e_wallet"].includes(normMethod)) {
    throw new Error("Unsupported payment method");
  }

  const table = await Table.findById(tid).lean();
  if (!table || String(table.restaurantId) !== String(rid)) {
    throw new Error("Table not found");
  }
  const tableCode = table?.code || null;

  async function findLegacyTableOrders() {
    return Order.find({
      restaurantId: rid,
      tableId: tid,
      currentStatus: { $nin: INACTIVE_ORDER_STATUSES },
      ...orderBatchOrLegacyFilter(),
    }).lean();
  }

  const activeSession = await Order.findOne(
    activeTableSessionLookupFilter({
      restaurantId: rid,
      tableId: tid,
      tableCode,
    }),
  )
    .sort({ openedAt: -1, createdAt: -1, _id: -1 })
    .lean();

  let orders = [];
  let usedActiveSessionChildren = false;
  let usedLegacyFallback = false;
  if (activeSession) {
    const sessionChildFilter = {
      $and: [
        childOrdersForSessionFilter({
          restaurantId: rid,
          parentOrderId: activeSession._id,
        }),
        { currentStatus: { $nin: INACTIVE_ORDER_STATUSES } },
      ],
    };
    orders = await Order.find(sessionChildFilter).lean();
    if (orders.length) {
      usedActiveSessionChildren = true;
    } else {
      orders = await findLegacyTableOrders();
      usedLegacyFallback = true;
    }
  } else {
    orders = await findLegacyTableOrders();
    usedLegacyFallback = true;
  }

  if (!orders.length) {
    return {
      warning: true,
      pendingOrderCodes: [],
      invoice: null,
      transaction: null,
      cashflow: null,
    };
  }

  const served = [];
  const unserved = [];
  for (const o of orders) {
    const status = String(o.currentStatus || "").toLowerCase();
    const blocked =
      status !== "served" ||
      hasPendingItemWork(o) ||
      hasPendingAdjustmentRequests(o);
    if (blocked) unserved.push(o);
    else served.push(o);
  }

  const pendingCodes = unserved.map((o) => o.orderCode || String(o._id));
  if (pendingCodes.length && !includeUnserved) {
    return {
      warning: true,
      pendingOrderCodes: pendingCodes,
      invoice: null,
      transaction: null,
      cashflow: null,
    };
  }

  const payOrders = includeUnserved ? [...served, ...unserved] : served;

  if (!payOrders.length) {
    return {
      warning: true,
      pendingOrderCodes: pendingCodes,
      invoice: null,
      transaction: null,
      cashflow: null,
    };
  }

  const allLines = [];
  let aggregatedTotals = { subtotal: 0, discount: 0, tax: 0, service: 0, shippingFee: 0, grandTotal: 0 };
  const orderIds = payOrders.map((o) => o._id);

  for (const order of payOrders) {
    const filteredItems = (order.items || []).filter(
      (it) => !EXCLUDED_ITEM_STATUSES.has(String(it.status || "").toLowerCase())
    );

    const normalizedLines = filteredItems.map(normalizeLine).filter(Boolean);
    const linesSubtotal = normalizedLines.reduce((s, l) => s + l.subtotal, 0);
    const totals = accumulateTotals(order, linesSubtotal, linesSubtotal);

    aggregatedTotals.subtotal += totals.subtotal;
    aggregatedTotals.discount += totals.discount;
    aggregatedTotals.tax += totals.tax;
    aggregatedTotals.service += totals.service;
    aggregatedTotals.shippingFee += totals.shippingFee;
    aggregatedTotals.grandTotal += totals.grandTotal;

    allLines.push(...normalizedLines);
  }

  const mergedLines = mergeLines(allLines);
  if (!mergedLines.length || !(aggregatedTotals.grandTotal > 0)) {
    return {
      warning: true,
      pendingOrderCodes: pendingCodes,
      invoice: null,
      transaction: null,
      cashflow: null,
    };
  }

  const now = paidAt ? dayjs(paidAt).toDate() : new Date();
  const amountToPay = paidAmount != null ? Number(paidAmount) : aggregatedTotals.grandTotal;

  const session = await startSession();
  session.startTransaction();

  try {
    const trx = await PaymentTransaction.create(
      [
        {
          restaurantId: rid,
          orderIds,
          paidAmount: amountToPay,
          method: normMethod,
          status: "SUCCESS",
          paidAt: now,
          note,
          externalRef,
          createdBy: ctx?.user?.id,
        },
      ],
      { session }
    ).then((r) => r[0]);

    const number = await generateInvoiceNumber(Invoice, session);
    const invoice = await Invoice.create(
      [
        {
          restaurantId: rid,
          orderIds,
          userId: ctx?.user?.id,
          tableCode: table.code,
          number,
          issuedAt: now,
          lines: mergedLines,
          totals: {
            subtotal: aggregatedTotals.subtotal,
            discount: aggregatedTotals.discount,
            tax: aggregatedTotals.tax,
            service: aggregatedTotals.service,
            grandTotal: aggregatedTotals.grandTotal,
          },
          paid: amountToPay,
          status:
            amountToPay + 1e-6 >= aggregatedTotals.grandTotal
              ? "PAID"
              : amountToPay > 0
              ? "PARTIAL"
              : "UNPAID",
          currency: "VND",
          refTransactionId: trx._id,
        },
      ],
      { session }
    ).then((r) => r[0]);

    const cashflow = await Cashflow.create(
      [
        {
          restaurantId: rid,
          type: "INFLOW",
          amount: amountToPay,
          currency: "VND",
          ref: {
            kind: "Invoice",
            id: invoice._id,
            orderIds,
          },
          note:
            pendingCodes.length && !includeUnserved
              ? `Thanh toán (đã loại ${pendingCodes.length} order chưa phục vụ)`
              : "Thanh toán theo bàn",
          occurredAt: now,
        },
      ],
      { session }
    ).then((r) => r[0]);

    await Order.updateMany(
      { _id: { $in: orderIds } },
      {
        $set: {
          "payment.method": normMethod,
          "payment.status": "paid",
          "payment.paidAmount": amountToPay,
          "payment.paidAt": now,
          "payment.paidBy": actorId,
          currentStatus: "completed",
        },
        $push: {
          statusTimeline: {
            status: "completed",
            at: now,
            byUserId: actorId || null,
            note: "Đã thanh toán và hoàn tất đơn.",
          },
        },
      },
      { session }
    );

    const shouldCloseParentSession =
      pendingCodes.length === 0 || includeUnserved === true;

    if (shouldCloseParentSession) {
      const parentSessionIds = usedActiveSessionChildren && activeSession
        ? [toId(activeSession._id)].filter(Boolean)
        : deriveParentSessionObjectIds(payOrders);

      if (parentSessionIds.length) {
        await Order.updateMany(
          {
            _id: { $in: parentSessionIds },
            restaurantId: rid,
            orderKind: ORDER_KIND.TABLE_SESSION,
          },
          {
            $set: {
              sessionStatus: SESSION_STATUS.CLOSED,
              orderPaymentStatus: ORDER_PAYMENT_STATUS.PAID,
              activeSessionKey: null,
              closedAt: now,
              "payment.method": normMethod,
              "payment.status": "paid",
              "payment.paidAmount": amountToPay,
              "payment.paidAt": now,
              "payment.paidBy": actorId,
              currentStatus: "completed",
            },
            $push: {
              statusTimeline: {
                status: "completed",
                at: now,
                byUserId: actorId || null,
                note: "Đã thanh toán và đóng phiên bàn.",
              },
            },
          },
          { session }
        );
      }
    }

    await EventLog.log(
      {
        restaurantId: rid,
        verb: "order.pay",
        actorUserId: ctx?.user?.id,
        object: { kind: "Table", id: tid },
        target: { kind: "Invoice", id: invoice._id },
        source: "pos",
        status: "success",
        meta: {
          orders: orderIds.map(String),
          pendingOrderCodes: pendingCodes,
          includeUnserved,
          paidAmount: amountToPay,
          method: normMethod,
          usedActiveSessionChildren,
          usedLegacyFallback,
        },
      },
      { session }
    );

    await Table.updateOne(
      { _id: tid },
      { $set: { status: "available" } },
      { session }
    ).catch(() => {});

    await session.commitTransaction();
    session.endSession();

    const paidOrders = await Order.find({ _id: { $in: orderIds } });
    for (const paidOrder of paidOrders) {
      await emitOrderEvent(ctx, String(paidOrder.restaurantId), "ORDER_UPDATED", paidOrder);
    }

    return {
      warning: pendingCodes.length > 0 && !includeUnserved,
      pendingOrderCodes: pendingCodes,
      invoice,
      transaction: trx,
      cashflow,
    };
  } catch (err) {
    await session.abortTransaction().catch(() => {});
    session.endSession();
    throw err;
  }
};

export const payOrdersByOrderIds = async (_parent, { input }, ctx) => {
  const {
    restaurantId,
    orderIds = [],
    paidAmount,
    method,
    paidAt,
    note,
    externalRef,
  } = input || {};

  const rid = toId(restaurantId);
  if (!rid) throw new Error("Invalid restaurantId");
  await requireRestaurantAccess(ctx, rid);
  const actorId = toId(ctx?.user?.id || ctx?.user?._id);

  const rawOrderIds = Array.isArray(orderIds) ? orderIds : [];
  if (
    !rawOrderIds.length ||
    rawOrderIds.some((id) => typeof id !== "string" || !id.trim())
  ) {
    throw new Error("Invalid orderIds");
  }

  const normalizedOrderIds = rawOrderIds.map((id) => toId(id.trim()));
  if (normalizedOrderIds.some((id) => !id)) {
    throw new Error("Invalid orderIds");
  }

  const uniqueOrderIds = [
    ...new Map(normalizedOrderIds.map((id) => [String(id), id])).values(),
  ];

  const normMethod = String(method || "").toLowerCase();
  if (!["cash", "card", "transfer", "bank_transfer", "e_wallet"].includes(normMethod)) {
    throw new Error("Unsupported payment method");
  }

  const orders = await Order.find({
    _id: { $in: uniqueOrderIds },
    restaurantId: rid,
    currentStatus: { $nin: INACTIVE_ORDER_STATUSES },
    ...orderBatchOrLegacyFilter(),
  }).lean();

  if (!orders.length) {
    return {
      warning: true,
      pendingOrderCodes: [],
      invoice: null,
      transaction: null,
      cashflow: null,
    };
  }

  for (const order of orders) {
    if (hasPendingItemWork(order)) {
      throw new Error("Không thể thanh toán khi còn món chưa phục vụ xong.");
    }
    if (hasPendingAdjustmentRequests(order)) {
      throw new Error("Không thể thanh toán khi còn yêu cầu hủy/trả món đang chờ duyệt.");
    }
  }

  const pendingCodes = [];
  const allLines = [];
  let aggregatedTotals = { subtotal: 0, discount: 0, tax: 0, service: 0, shippingFee: 0, grandTotal: 0 };
  const activeOrderIds = orders.map((o) => o._id);

  for (const order of orders) {
    const filteredItems = (order.items || []).filter(
      (it) => !EXCLUDED_ITEM_STATUSES.has(String(it.status || "").toLowerCase())
    );

    const normalizedLines = filteredItems.map(normalizeLine).filter(Boolean);
    const linesSubtotal = normalizedLines.reduce((s, l) => s + l.subtotal, 0);
    const totals = accumulateTotals(order, linesSubtotal, linesSubtotal);

    aggregatedTotals.subtotal += totals.subtotal;
    aggregatedTotals.discount += totals.discount;
    aggregatedTotals.tax += totals.tax;
    aggregatedTotals.service += totals.service;
    aggregatedTotals.shippingFee += totals.shippingFee;
    aggregatedTotals.grandTotal += totals.grandTotal;

    allLines.push(...normalizedLines);
  }

  const mergedLines = mergeLines(allLines);
  if (!mergedLines.length || !(aggregatedTotals.grandTotal > 0)) {
    return {
      warning: true,
      pendingOrderCodes: pendingCodes,
      invoice: null,
      transaction: null,
      cashflow: null,
    };
  }

  const now = paidAt ? dayjs(paidAt).toDate() : new Date();
  const amountToPay =
    paidAmount != null ? Number(paidAmount) : aggregatedTotals.grandTotal;
  const firstOrder = orders[0] || null;

  const session = await startSession();
  session.startTransaction();

  try {
    const trx = await PaymentTransaction.create(
      [
        {
          restaurantId: rid,
          orderIds: activeOrderIds,
          paidAmount: amountToPay,
          method: normMethod,
          status: "SUCCESS",
          paidAt: now,
          note,
          externalRef,
          createdBy: actorId || ctx?.user?.id,
        },
      ],
      { session }
    ).then((r) => r[0]);

    const number = await generateInvoiceNumber(Invoice, session);
    const invoice = await Invoice.create(
      [
        {
          restaurantId: rid,
          orderIds: activeOrderIds,
          userId: ctx?.user?.id,
          tableCode: firstOrder?.tableCode || null,
          number,
          issuedAt: now,
          lines: mergedLines,
          totals: {
            subtotal: aggregatedTotals.subtotal,
            discount: aggregatedTotals.discount,
            tax: aggregatedTotals.tax,
            service: aggregatedTotals.service,
            grandTotal: aggregatedTotals.grandTotal,
          },
          paid: amountToPay,
          status:
            amountToPay + 1e-6 >= aggregatedTotals.grandTotal
              ? "PAID"
              : amountToPay > 0
                ? "PARTIAL"
                : "UNPAID",
          currency: "VND",
          refTransactionId: trx._id,
        },
      ],
      { session }
    ).then((r) => r[0]);

    const cashflow = await Cashflow.create(
      [
        {
          restaurantId: rid,
          type: "INFLOW",
          amount: amountToPay,
          currency: "VND",
          ref: {
            kind: "Invoice",
            id: invoice._id,
            orderIds: activeOrderIds,
          },
          note: "Thanh toán theo đơn",
          occurredAt: now,
        },
      ],
      { session }
    ).then((r) => r[0]);

    await Order.updateMany(
      { _id: { $in: activeOrderIds } },
      {
        $set: {
          "payment.method": normMethod,
          "payment.status": "paid",
          "payment.paidAmount": amountToPay,
          "payment.paidAt": now,
          "payment.paidBy": actorId,
          currentStatus: "completed",
        },
        $push: {
          statusTimeline: {
            status: "completed",
            at: now,
            byUserId: actorId || null,
            note: "Đã thanh toán và hoàn tất đơn.",
          },
        },
      },
      { session }
    );

    await EventLog.log(
      {
        restaurantId: rid,
        verb: "order.pay",
        actorUserId: ctx?.user?.id,
        object: { kind: "Order", id: firstOrder?._id || activeOrderIds[0] },
        target: { kind: "Invoice", id: invoice._id },
        source: "pos",
        status: "success",
        meta: {
          orders: activeOrderIds.map(String),
          paidAmount: amountToPay,
          method: normMethod,
        },
      },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    const paidOrders = await Order.find({ _id: { $in: activeOrderIds } });
    for (const paidOrder of paidOrders) {
      await emitOrderEvent(ctx, String(paidOrder.restaurantId), "ORDER_UPDATED", paidOrder);
    }

    return {
      warning: false,
      pendingOrderCodes: pendingCodes,
      invoice,
      transaction: trx,
      cashflow,
    };
  } catch (err) {
    await session.abortTransaction().catch(() => {});
    session.endSession();
    throw err;
  }
};

export const createReservationPaymentMutation = async (_parent, { input }, ctx) => {
  const userId = ctx?.user?.id;
  if (!userId) throw new Error("Unauthorized");

  const baseApiUrl = process.env.PUBLIC_BASE_URL || process.env.APP_PUBLIC_URL || "http://localhost:4000";

  const payment = await createReservationPayment({
    reservationId: input?.reservationId,
    provider: input?.provider,
    userId,
    baseApiUrl,
    clientIp: "127.0.0.1",
  });

  return payment;
};

export const syncPaymentStatus = async (_parent, { paymentId }) => {
  if (!mongoose.isValidObjectId(paymentId)) throw new Error("Invalid paymentId");
  const payment = await PaymentSession.findById(paymentId).lean();
  if (!payment) throw new Error("Payment session not found");

  if (payment.provider === "vnpay" && payment.providerResponseRaw?.vnp_TxnRef) {
    return payment;
  }
  if (payment.provider === "momo" && payment.providerResponseRaw?.orderId) {
    return payment;
  }

  return payment;
};

export const updateRestaurantPaymentSettings = async (_parent, { input }, ctx) => {
  if (!ctx?.user?.id) throw new Error("Unauthorized");
  const role = String(ctx?.user?.roleName || ctx?.user?.role || "").toLowerCase();
  if (!["manager", "admin"].some((x) => role.includes(x))) {
    throw new Error("Forbidden");
  }

  const rid = toId(input?.restaurantId);
  if (!rid) throw new Error("Invalid restaurantId");
  await requireRestaurantAccess(ctx, rid);

  const providers = Array.isArray(input?.providers) ? input.providers : [];
  const normalizedProviders = providers
    .map((p, idx) => ({
      provider: String(p?.provider || "").toLowerCase(),
      label: String(p?.label || "").trim() || (String(p?.provider || "").toLowerCase() === "momo" ? "MoMo" : "VNPAY"),
      active: p?.active !== false,
      priority: Number.isFinite(Number(p?.priority)) ? Number(p.priority) : idx + 1,
      mode: String(p?.mode || "sandbox").toLowerCase() === "production" ? "production" : "sandbox",
    }))
    .filter((p) => ["momo", "vnpay"].includes(p.provider));

  const defaultProvider = ["momo", "vnpay"].includes(String(input?.defaultProvider || "").toLowerCase())
    ? String(input.defaultProvider).toLowerCase()
    : (normalizedProviders[0]?.provider || "momo");

  const restaurant = await Restaurant.findByIdAndUpdate(
    rid,
    {
      $set: {
        paymentSettings: {
          defaultProvider,
          providers: normalizedProviders,
        },
      },
    },
    { new: true }
  );

  if (!restaurant) throw new Error("Restaurant not found");

  await EventLog.log({
    restaurantId: restaurant._id,
    actorUserId: ctx?.user?.id,
    verb: "payment.create",
    object: { kind: "Restaurant", id: restaurant._id },
    source: "web",
    status: "success",
    meta: { action: "update_payment_settings", defaultProvider, providers: normalizedProviders },
  }).catch(() => {});

  return restaurant;
};

export default {
  requestTablePayment,
  payOrdersByTableId,
  payOrdersByOrderIds,
  createReservationPayment: createReservationPaymentMutation,
  syncPaymentStatus,
  updateRestaurantPaymentSettings,
};
