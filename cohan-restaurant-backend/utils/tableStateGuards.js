import Order from "../models/order.model.js";
import Reservation from "../models/reservation.model.js";
import {
  INACTIVE_ORDER_STATUSES,
  activeTableSessionLookupFilter,
  withOrderBatchOrLegacyFilter,
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
const PAID_STATUSES = new Set(["paid", "refunded", "partially_refunded"]);

const hasUnservedItems = (items = []) =>
  (items || []).some((item) => !SERVED_ITEM_STATUSES.has(String(item?.status || "").toLowerCase()));

const isPaymentRequested = (order = {}) =>
  String(order?.orderPaymentStatus || "").toLowerCase() === "payment_requested" ||
  String(order?.payment?.status || "").toLowerCase() === "payment_requested";

const hasUnpaidAmount = (order = {}) => {
  const paymentStatus = String(order?.orderPaymentStatus || order?.payment?.status || "").toLowerCase();
  const grandTotal = Number(order?.totals?.grandTotal || 0);
  return !PAID_STATUSES.has(paymentStatus) && grandTotal > 0;
};

const activeOrderStatus = (order = {}) =>
  !INACTIVE_ORDER_STATUSES.includes(String(order?.currentStatus || "").toLowerCase());

export async function getTableAvailabilityBlockReason({ restaurantId, tableId, tableCode }) {
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
    if (hasUnservedItems(activeSession.items)) {
      return {
        code: "TABLE_HAS_UNSERVED_ITEMS",
        message: "Không thể trả bàn về trống vì còn món chưa phục vụ.",
      };
    }
    if (isPaymentRequested(activeSession)) {
      return {
        code: "TABLE_PAYMENT_PENDING",
        message: "Không thể trả bàn về trống vì bàn đang chờ thanh toán.",
      };
    }
    if (hasUnpaidAmount(activeSession)) {
      return {
        code: "TABLE_HAS_UNPAID_ORDERS",
        message: "Không thể trả bàn về trống vì còn hóa đơn chưa thanh toán.",
      };
    }

    const childOrders = await Order.find(
      withOrderBatchOrLegacyFilter({
        restaurantId,
        parentOrderId: activeSession._id,
        currentStatus: { $nin: INACTIVE_ORDER_STATUSES },
      }),
    )
      .select({ _id: 1, orderPaymentStatus: 1, payment: 1, totals: 1, items: 1, currentStatus: 1 })
      .lean();

    for (const child of childOrders) {
      if (hasUnservedItems(child.items)) {
        return {
          code: "TABLE_HAS_UNSERVED_ITEMS",
          message: "Không thể trả bàn về trống vì còn món chưa phục vụ.",
        };
      }
      if (isPaymentRequested(child)) {
        return {
          code: "TABLE_PAYMENT_PENDING",
          message: "Không thể trả bàn về trống vì bàn đang chờ thanh toán.",
        };
      }
      if (hasUnpaidAmount(child)) {
        return {
          code: "TABLE_HAS_UNPAID_ORDERS",
          message: "Không thể trả bàn về trống vì còn hóa đơn chưa thanh toán.",
        };
      }
      if (activeOrderStatus(child)) {
        return {
          code: "TABLE_HAS_ACTIVE_ORDERS",
          message: "Không thể trả bàn về trống vì còn order hoạt động.",
        };
      }
    }
  }

  const activeLegacyOrBatchOrder = await Order.findOne(
    withOrderBatchOrLegacyFilter({
      restaurantId,
      tableId,
      currentStatus: { $nin: INACTIVE_ORDER_STATUSES },
    }),
  )
    .select({ _id: 1, orderPaymentStatus: 1, payment: 1, totals: 1, items: 1, currentStatus: 1 })
    .lean();

  if (activeLegacyOrBatchOrder?._id) {
    if (hasUnservedItems(activeLegacyOrBatchOrder.items)) {
      return {
        code: "TABLE_HAS_UNSERVED_ITEMS",
        message: "Không thể trả bàn về trống vì còn món chưa phục vụ.",
      };
    }
    if (isPaymentRequested(activeLegacyOrBatchOrder)) {
      return {
        code: "TABLE_PAYMENT_PENDING",
        message: "Không thể trả bàn về trống vì bàn đang chờ thanh toán.",
      };
    }
    if (hasUnpaidAmount(activeLegacyOrBatchOrder)) {
      return {
        code: "TABLE_HAS_UNPAID_ORDERS",
        message: "Không thể trả bàn về trống vì còn hóa đơn chưa thanh toán.",
      };
    }
    return {
      code: "TABLE_HAS_ACTIVE_ORDERS",
      message: "Không thể trả bàn về trống vì còn order hoạt động.",
    };
  }

  return null;
}
