import mongoose, { startSession } from "mongoose";
import dayjs from "dayjs";
import { generateInvoiceNumber } from "../../../utils/generateInvoiceNumber.ts";
import {
  Order,
  Invoice,
  PaymentTransaction,
  Cashflow,
  EventLog,
  Table,
} from "../../../models/index.js";

const INACTIVE_ORDER_STATUSES = ["completed", "cancelled", "failed"];
const EXCLUDED_ITEM_STATUSES = new Set(["cancelled", "returned"]);

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

  if (!rid) throw new Error("Invalid restaurantId");
  if (!tid) throw new Error("Invalid tableId");

  const normMethod = String(method || "").toLowerCase();
  if (!["cash", "card", "transfer", "bank_transfer", "e_wallet"].includes(normMethod)) {
    throw new Error("Unsupported payment method");
  }

  const table = await Table.findById(tid).lean();
  if (!table || String(table.restaurantId) !== String(rid)) {
    throw new Error("Table not found");
  }

  const orders = await Order.find({
    restaurantId: rid,
    tableId: tid,
    currentStatus: { $nin: INACTIVE_ORDER_STATUSES },
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

  const served = [];
  const unserved = [];
  for (const o of orders) {
    if (String(o.currentStatus || "").toLowerCase() === "served") served.push(o);
    else unserved.push(o);
  }

  const payOrders = includeUnserved ? [...served, ...unserved] : served;
  const pendingCodes = unserved.map((o) => o.orderCode || String(o._id));

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

    // update orders status/payments
    await Order.updateMany(
      { _id: { $in: orderIds } },
      {
        $set: {
          "payment.method": normMethod,
          "payment.status": "paid",
          "payment.paidAmount": amountToPay,
          "payment.paidAt": now,
          currentStatus: "completed",
        },
      },
      { session }
    );

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

export default { payOrdersByTableId };
