import mongoose from "mongoose";
import { Order, Table } from "../../../models/index.js";
import {
  ORDER_KIND,
  ORDER_PAYMENT_STATUS,
  SESSION_STATUS,
  orderBatchOrLegacyFilter,
} from "../../../utils/orderLifecycle.js";
import StrictOrderPaymentMutationLegacy from "./strictOrderPaymentMutationLegacy.js";

const CLOSED_CHILD_STATUSES = new Set(["completed", "cancelled", "failed"]);

const toId = (value) =>
  value && mongoose.isValidObjectId(value)
    ? new mongoose.Types.ObjectId(value)
    : null;

const isSettledOrder = (order) => {
  const paymentStatus = String(order?.payment?.status || "").toLowerCase();
  const status = String(order?.currentStatus || "").toLowerCase();
  return paymentStatus === "paid" || CLOSED_CHILD_STATUSES.has(status);
};

async function closeSettledParentSessions({
  restaurantId,
  orderIds = [],
  paidAt = new Date(),
}) {
  const rid = toId(restaurantId);
  const selectedIds = (Array.isArray(orderIds) ? orderIds : [])
    .map(toId)
    .filter(Boolean);
  if (!rid || !selectedIds.length) return;

  const paidOrders = await Order.find({
    _id: { $in: selectedIds },
    restaurantId: rid,
  })
    .select({
      _id: 1,
      tableId: 1,
      parentOrderId: 1,
      rootOrderId: 1,
    })
    .lean();

  const parentIds = [
    ...new Set(
      paidOrders
        .map((order) => order?.parentOrderId || order?.rootOrderId)
        .filter(Boolean)
        .map(String),
    ),
  ]
    .map(toId)
    .filter(Boolean);

  for (const parentId of parentIds) {
    const children = await Order.find({
      $and: [
        {
          restaurantId: rid,
          $or: [
            { parentOrderId: parentId },
            { rootOrderId: parentId },
          ],
        },
        orderBatchOrLegacyFilter(),
      ],
    })
      .select({
        _id: 1,
        currentStatus: 1,
        payment: 1,
      })
      .lean();

    if (!children.length || !children.every(isSettledOrder)) continue;

    const parent = await Order.findOneAndUpdate(
      {
        _id: parentId,
        restaurantId: rid,
        orderKind: ORDER_KIND.TABLE_SESSION,
      },
      {
        $set: {
          sessionStatus: SESSION_STATUS.CLOSED,
          orderPaymentStatus: ORDER_PAYMENT_STATUS.PAID,
          activeSessionKey: null,
          closedAt: paidAt,
          currentStatus: "completed",
          "payment.status": "paid",
          "payment.paidAt": paidAt,
        },
      },
      { new: true },
    )
      .select({ tableId: 1 })
      .lean();

    if (parent?.tableId) {
      await Table.updateOne(
        { _id: parent.tableId, restaurantId: rid },
        { $set: { status: "available" } },
      );
    }
  }

  const legacyTableIds = [
    ...new Set(
      paidOrders
        .filter((order) => !order?.parentOrderId && !order?.rootOrderId)
        .map((order) => order?.tableId)
        .filter(Boolean)
        .map(String),
    ),
  ]
    .map(toId)
    .filter(Boolean);

  for (const tableId of legacyTableIds) {
    const remaining = await Order.exists({
      restaurantId: rid,
      tableId,
      ...orderBatchOrLegacyFilter(),
      currentStatus: {
        $nin: ["completed", "cancelled", "failed"],
      },
      "payment.status": { $ne: "paid" },
    });

    if (!remaining) {
      await Table.updateOne(
        { _id: tableId, restaurantId: rid },
        { $set: { status: "available" } },
      );
    }
  }
}

async function payOrdersByOrderIds(parent, args, ctx, info) {
  const result =
    await StrictOrderPaymentMutationLegacy.payOrdersByOrderIds(
      parent,
      args,
      ctx,
      info,
    );

  if (result?.invoice || result?.transaction) {
    await closeSettledParentSessions({
      restaurantId: args?.input?.restaurantId,
      orderIds: args?.input?.orderIds,
      paidAt: args?.input?.paidAt
        ? new Date(args.input.paidAt)
        : new Date(),
    }).catch(() => {
      // Payment is already committed. Session/table reconciliation is
      // best-effort and will be retried by later payment/table flows.
    });
  }

  return result;
}

export default {
  ...StrictOrderPaymentMutationLegacy,
  payOrdersByOrderIds,
};
