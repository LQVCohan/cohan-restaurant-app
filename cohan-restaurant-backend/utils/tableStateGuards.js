import Order from "../models/order.model.js";
import Reservation from "../models/reservation.model.js";
import {
  INACTIVE_ORDER_STATUSES,
  activeTableSessionLookupFilter,
  withOrderBatchOrLegacyFilter,
  childOrdersForSessionFilter,
  isPaymentClosed,
} from "./orderLifecycle.js";

export const ACTIVE_RESERVATION_STATUSES = [
  "pending_payment",
  "confirmed",
  "seated",
  "pending_change",
];

export async function hasActiveOrdersForTable({ restaurantId, tableId, tableCode }) {
  const activeSession = await Order.findOne(
    activeTableSessionLookupFilter({ restaurantId, tableId, tableCode })
  )
    .select({ _id: 1 })
    .lean();

  if (activeSession?._id) return true;

  const activeLegacyOrBatchOrder = await Order.findOne(
    withOrderBatchOrLegacyFilter({
      restaurantId,
      tableId,
      currentStatus: { $nin: INACTIVE_ORDER_STATUSES },
    })
  )
    .select({ _id: 1 })
    .lean();

  return Boolean(activeLegacyOrBatchOrder?._id);
}

export async function hasActiveReservationsForTable({ restaurantId, tableId }) {
  const activeReservation = await Reservation.findOne({
    restaurantId,
    tableId,
    status: { $in: ACTIVE_RESERVATION_STATUSES },
  })
    .select({ _id: 1 })
    .lean();

  return Boolean(activeReservation?._id);
}

const SERVED_ITEM_STATUSES = new Set(["served", "cancelled", "returned"]);
const hasUnservedItems = (items = []) =>
  (items || []).some((item) => !SERVED_ITEM_STATUSES.has(String(item?.status || "").toLowerCase()));

const isPaymentRequested = (order = {}) =>
  String(order?.orderPaymentStatus || "").toLowerCase() === "payment_requested" ||
  String(order?.payment?.status || "").toLowerCase() === "payment_requested";

const hasUnpaidAmount = (order = {}) => {
  if (isPaymentClosed(order)) return false;
  const grandTotal = Number(order?.totals?.grandTotal || 0);
  return grandTotal > 0;
};

const activeOrderStatus = (order = {}) =>
  !INACTIVE_ORDER_STATUSES.includes(String(order?.currentStatus || "").toLowerCase());

export async function getTableAvailabilityBlockReason({ restaurantId, tableId, tableCode }) {
  const relatedOrders = [];
  const activeSession = await Order.findOne(
    activeTableSessionLookupFilter({ restaurantId, tableId, tableCode }),
  )
    .select({
      _id: 1,
      orderPaymentStatus: 1,
      payment: 1,
      totals: 1,
      items: 1,
      currentStatus: 1,
    })
    .lean();

  if (activeSession?._id) {
    relatedOrders.push(activeSession);
    const childOrders = await Order.find(
      {
        ...childOrdersForSessionFilter({
          restaurantId,
          parentOrderId: activeSession._id,
        }),
        currentStatus: { $nin: INACTIVE_ORDER_STATUSES },
      },
    )
      .select({ _id: 1, orderPaymentStatus: 1, payment: 1, totals: 1, items: 1, currentStatus: 1 })
      .lean();
    relatedOrders.push(...childOrders);
  }

  const activeLegacyOrBatchOrders = await Order.find(
    withOrderBatchOrLegacyFilter({
      restaurantId,
      tableId,
      currentStatus: { $nin: INACTIVE_ORDER_STATUSES },
    }),
  )
    .select({ _id: 1, orderPaymentStatus: 1, payment: 1, totals: 1, items: 1, currentStatus: 1 })
    .lean();

  if (activeLegacyOrBatchOrders.length > 0) {
    relatedOrders.push(...activeLegacyOrBatchOrders);
  }

  const hasAnyUnservedItems = relatedOrders.some((order) => hasUnservedItems(order.items));
  if (hasAnyUnservedItems) {
    return {
      code: "TABLE_HAS_UNSERVED_ITEMS",
      message: "Không thể trả bàn về trống vì còn món chưa phục vụ.",
    };
  }

  const hasAnyPaymentRequested = relatedOrders.some((order) => isPaymentRequested(order));
  if (hasAnyPaymentRequested) {
    return {
      code: "TABLE_PAYMENT_PENDING",
      message: "Không thể trả bàn về trống vì bàn đang chờ thanh toán.",
    };
  }

  const hasAnyUnpaidAmount = relatedOrders.some((order) => hasUnpaidAmount(order));
  if (hasAnyUnpaidAmount) {
    return {
      code: "TABLE_HAS_UNPAID_ORDERS",
      message: "Không thể trả bàn về trống vì còn hóa đơn chưa thanh toán.",
    };
  }

  const hasAnyActiveOrder = relatedOrders.some((order) => activeOrderStatus(order));
  if (hasAnyActiveOrder) {
    return {
      code: "TABLE_HAS_ACTIVE_ORDERS",
      message: "Không thể trả bàn về trống vì còn order hoạt động.",
    };
  }

  return null;
}
