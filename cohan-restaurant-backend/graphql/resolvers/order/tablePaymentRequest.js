import mongoose from "mongoose";
import { Order } from "../../../models/index.js";
import { requireRestaurantAccess } from "../../guards.js";
import {
  INACTIVE_ORDER_STATUSES,
  ORDER_KIND,
  ORDER_PAYMENT_STATUS,
  activeTableSessionLookupFilter,
  childOrdersForSessionFilter,
  isOrderReadyForPayment,
} from "../../../utils/orderLifecycle.js";

const ACTIVE_SESSION_SORT = { openedAt: -1, createdAt: -1, _id: -1 };
const ACTIVE_CHILD_SORT = { createdAt: 1, _id: 1 };
const LEGACY_PAYMENT_PENDING_STATUS = "pending";

function toObjectId(value, fieldName) {
  if (!value || !mongoose.isValidObjectId(value)) {
    throw new Error(`Invalid ${fieldName}`);
  }
  return new mongoose.Types.ObjectId(value);
}

function normalizeOptionalString(value) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function buildFriendlyError(message) {
  return new Error(message);
}

function isInactiveOrder(order) {
  const currentStatus = String(order?.currentStatus || "").toLowerCase();
  return INACTIVE_ORDER_STATUSES.includes(currentStatus);
}

function isPaidOrder(order) {
  const paymentStatus = String(order?.payment?.status || "").toLowerCase();
  return paymentStatus === ORDER_PAYMENT_STATUS.PAID;
}

function canMutatePaymentRequest(order) {
  return !!order && !isInactiveOrder(order) && !isPaidOrder(order);
}

function resolveRequestedBy(ctx, requestedByInput) {
  const candidate =
    requestedByInput || ctx?.user?.id || ctx?.user?._id || null;

  return mongoose.isValidObjectId(candidate)
    ? new mongoose.Types.ObjectId(candidate)
    : null;
}

function markPaymentRequested(order, { requestedAt, requestedBy }) {
  if (!canMutatePaymentRequest(order)) return false;

  order.payment = order.payment || {};
  order.payment.status = ORDER_PAYMENT_STATUS.PAYMENT_REQUESTED;
  if (!order.payment.requestedAt) {
    order.payment.requestedAt = requestedAt;
  }
  if (requestedBy && !order.payment.requestedBy) {
    order.payment.requestedBy = requestedBy;
  }

  if (order.orderKind === ORDER_KIND.TABLE_SESSION) {
    order.orderPaymentStatus = ORDER_PAYMENT_STATUS.PAYMENT_REQUESTED;
  }

  return true;
}

function canClearPaymentRequest(order) {
  if (!canMutatePaymentRequest(order)) return false;

  const paymentStatus = String(order?.payment?.status || "").toLowerCase();
  return paymentStatus === ORDER_PAYMENT_STATUS.PAYMENT_REQUESTED;
}

function clearPaymentRequested(order) {
  if (!canClearPaymentRequest(order)) return false;

  order.payment = order.payment || {};
  order.payment.status = LEGACY_PAYMENT_PENDING_STATUS;

  if (order.orderKind === ORDER_KIND.TABLE_SESSION) {
    order.orderPaymentStatus = ORDER_PAYMENT_STATUS.UNPAID;
  }

  return true;
}

async function loadActiveTableSession({ restaurantId, tableId, tableCode }) {
  return Order.findOne(
    activeTableSessionLookupFilter({
      restaurantId,
      tableId,
      tableCode,
    }),
  ).sort(ACTIVE_SESSION_SORT);
}

async function loadActiveChildOrders({ restaurantId, parentOrderId }) {
  return Order.find({
    ...childOrdersForSessionFilter({ restaurantId, parentOrderId }),
    currentStatus: { $nin: INACTIVE_ORDER_STATUSES },
    "payment.status": { $ne: ORDER_PAYMENT_STATUS.PAID },
  }).sort(ACTIVE_CHILD_SORT);
}

function serializeRequestedAt(session, fallback) {
  const value = session?.payment?.requestedAt || fallback;
  return value ? new Date(value).toISOString() : null;
}

async function loadScopedSessionAndOrders(ctx, input) {
  const restaurantId = toObjectId(input?.restaurantId, "restaurantId");
  const tableId = toObjectId(input?.tableId, "tableId");
  const tableCode = normalizeOptionalString(input?.tableCode)?.toUpperCase() || null;

  await requireRestaurantAccess(ctx, restaurantId);

  const session = await loadActiveTableSession({
    restaurantId,
    tableId,
    tableCode,
  });

  if (!session) {
    throw buildFriendlyError("Không tìm thấy phiên bàn đang hoạt động.");
  }

  const orders = await loadActiveChildOrders({
    restaurantId,
    parentOrderId: session._id,
  });

  return { restaurantId, tableId, tableCode, session, orders };
}

export const tablePaymentRequestMutations = {
  async requestTablePayment(_parent, { input }, ctx) {
    const { session, orders } = await loadScopedSessionAndOrders(ctx, input);

    if (!orders.length) {
      throw buildFriendlyError("Bàn chưa có món nào để yêu cầu thanh toán.");
    }

    const pendingOrderCodes = orders
      .filter((order) => !isOrderReadyForPayment(order))
      .map((order) => order.orderCode || String(order._id));

    const warning = pendingOrderCodes.length > 0;
    const readyForPayment = !warning;
    const requestedAt = session?.payment?.requestedAt || new Date();
    const requestedBy = resolveRequestedBy(ctx, input?.requestedBy);

    markPaymentRequested(session, { requestedAt, requestedBy });

    for (const order of orders) {
      markPaymentRequested(order, { requestedAt, requestedBy });
    }

    await Promise.all([
      session.save(),
      ...orders.filter(canMutatePaymentRequest).map((order) => order.save()),
    ]);

    return {
      ok: true,
      warning,
      readyForPayment,
      message: warning
        ? "Đã ghi nhận yêu cầu thanh toán nhưng vẫn còn món chưa sẵn sàng thanh toán."
        : "Đã ghi nhận yêu cầu thanh toán tại bàn.",
      pendingOrderCodes,
      session,
      orders,
      requestedAt: serializeRequestedAt(session, requestedAt),
    };
  },

  async clearTablePaymentRequest(_parent, { input }, ctx) {
    const { session, orders } = await loadScopedSessionAndOrders(ctx, input);

    const sessionChanged = clearPaymentRequested(session);
    const changedOrders = orders.filter((order) => clearPaymentRequested(order));

    if (!sessionChanged && !changedOrders.length) {
      return {
        ok: true,
        message: "Không có yêu cầu thanh toán cần xóa.",
        session,
        orders,
      };
    }

    await Promise.all([
      ...(sessionChanged ? [session.save()] : []),
      ...changedOrders.map((order) => order.save()),
    ]);

    return {
      ok: true,
      message: "Đã xóa yêu cầu thanh toán tại bàn.",
      session,
      orders,
    };
  },
};

export default tablePaymentRequestMutations;
