import mongoose from "mongoose";
import { Order, Table } from "../../../models/index.js";
import PaymentMutation from "./mutation.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";
import {
  INACTIVE_ORDER_STATUSES,
  activeTableSessionLookupFilter,
  childOrdersForSessionFilter,
  orderBatchOrLegacyFilter,
} from "../../../utils/orderLifecycle.js";

const PENDING_ITEM_STATUSES = new Set(["pending", "confirmed", "preparing", "ready"]);

function toId(id) {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

function hasPendingItemWork(order) {
  return (order?.items || []).some((item) =>
    PENDING_ITEM_STATUSES.has(String(item?.status || "").toLowerCase()),
  );
}

function hasPendingAdjustmentRequests(order) {
  return (order?.items || []).some(
    (item) =>
      (item?.voidRequests || []).some((req) => req?.status === "pending") ||
      (item?.returnRequests || []).some((req) => req?.status === "pending"),
  );
}

function isReadyForPayment(order) {
  const status = String(order?.currentStatus || "").toLowerCase();
  return ["served", "completed"].includes(status)
    && !hasPendingItemWork(order)
    && !hasPendingAdjustmentRequests(order);
}

function pendingCodesForOrders(orders = []) {
  return orders
    .filter((order) => !isReadyForPayment(order))
    .map((order) => order.orderCode || String(order._id));
}

function buildPendingPaymentError(pendingCodes = []) {
  const suffix = pendingCodes.length
    ? ` Các đơn chưa đủ điều kiện: ${pendingCodes.join(", ")}.`
    : "";
  return new Error(`Không thể thanh toán khi còn món chưa phục vụ xong hoặc còn yêu cầu hủy/trả món đang chờ duyệt.${suffix}`);
}

async function findPayableTableOrders({ restaurantId, tableId }) {
  const table = await Table.findById(tableId).lean();
  if (!table || String(table.restaurantId) !== String(restaurantId)) {
    throw new Error("Table not found");
  }

  async function findLegacyTableOrders() {
    return Order.find({
      restaurantId,
      tableId,
      currentStatus: { $nin: INACTIVE_ORDER_STATUSES },
      ...orderBatchOrLegacyFilter(),
    }).lean();
  }

  const activeSession = await Order.findOne(
    activeTableSessionLookupFilter({
      restaurantId,
      tableId,
      tableCode: table?.code || null,
    }),
  )
    .sort({ openedAt: -1, createdAt: -1, _id: -1 })
    .lean();

  if (!activeSession) return findLegacyTableOrders();

  const childOrders = await Order.find({
    $and: [
      childOrdersForSessionFilter({
        restaurantId,
        parentOrderId: activeSession._id,
      }),
      { currentStatus: { $nin: INACTIVE_ORDER_STATUSES } },
    ],
  }).lean();

  return childOrders.length ? childOrders : findLegacyTableOrders();
}

async function assertTableOrdersReadyForPayment(input, ctx) {
  const restaurantId = toId(input?.restaurantId);
  const tableId = toId(input?.tableId);
  if (!restaurantId) throw new Error("Invalid restaurantId");
  if (!tableId) throw new Error("Invalid tableId");

  await requireRestaurantPermission(ctx, restaurantId, PERMISSIONS.PAYMENT_WRITE);

  const orders = await findPayableTableOrders({ restaurantId, tableId });
  const pendingCodes = pendingCodesForOrders(orders);
  if (pendingCodes.length) throw buildPendingPaymentError(pendingCodes);
}

async function assertSelectedOrdersReadyForPayment(input, ctx) {
  const restaurantId = toId(input?.restaurantId);
  if (!restaurantId) throw new Error("Invalid restaurantId");
  await requireRestaurantPermission(ctx, restaurantId, PERMISSIONS.PAYMENT_WRITE);

  const rawOrderIds = Array.isArray(input?.orderIds) ? input.orderIds : [];
  if (!rawOrderIds.length || rawOrderIds.some((id) => typeof id !== "string" || !id.trim())) {
    throw new Error("Invalid orderIds");
  }

  const uniqueOrderIds = [
    ...new Map(
      rawOrderIds.map((id) => {
        const oid = toId(id.trim());
        if (!oid) throw new Error("Invalid orderIds");
        return [String(oid), oid];
      }),
    ).values(),
  ];

  const orders = await Order.find({
    _id: { $in: uniqueOrderIds },
    restaurantId,
    currentStatus: { $nin: INACTIVE_ORDER_STATUSES },
    ...orderBatchOrLegacyFilter(),
  }).lean();

  const pendingCodes = pendingCodesForOrders(orders);
  if (pendingCodes.length) throw buildPendingPaymentError(pendingCodes);
}

async function payOrdersByTableId(parent, args, ctx, info) {
  await assertTableOrdersReadyForPayment(args?.input || {}, ctx);
  return PaymentMutation.payOrdersByTableId(
    parent,
    { input: { ...(args?.input || {}), includeUnserved: false } },
    ctx,
    info,
  );
}

async function payOrdersByOrderIds(parent, args, ctx, info) {
  await assertSelectedOrdersReadyForPayment(args?.input || {}, ctx);
  return PaymentMutation.payOrdersByOrderIds(parent, args, ctx, info);
}

export default {
  payOrdersByTableId,
  payOrdersByOrderIds,
};
