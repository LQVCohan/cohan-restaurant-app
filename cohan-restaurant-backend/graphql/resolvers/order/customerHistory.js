import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Order, Warehouse } from "../../../models/index.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";
import { cancelReservationForOrderTx } from "../../../src/services/inventory.service.js";
import {
  emitCustomerTrackingUpdateIfChanged,
  updatePublicStatusHistory,
} from "../../../src/services/orderTracking.service.js";
import { emitOrderEvent } from "./helper/emitOrderEvent.js";
import { markTableStatus } from "./helper/tableUtils.js";

const CUSTOMER_CANCEL_ALLOWED_STATUSES = new Set([
  "draft",
  "pending",
  "confirmed",
  "customer_attached",
]);
const RESERVABLE_STATUSES = ["draft", "pending", "confirmed", "customer_attached"];
const PAID_STATUSES = new Set(["paid", "partially_refunded", "refunded"]);

function toObjectId(value, field = "ID") {
  if (!value || !mongoose.isValidObjectId(value)) {
    throw new GraphQLError(`Invalid ${field}`, {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  return new mongoose.Types.ObjectId(value);
}

function authUserId(ctx) {
  return ctx?.auth?.user?.id || ctx?.user?.id || ctx?.user?._id || null;
}

function assertAuthenticatedCustomer(ctx) {
  const userId = authUserId(ctx);
  if (!userId || !mongoose.isValidObjectId(userId)) {
    throw new GraphQLError("Vui lòng đăng nhập để xem lịch sử đơn hàng.", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  }
  return String(userId);
}

function normalizeOrderNode(order) {
  if (!order) return null;
  return {
    id: String(order._id || order.id),
    ...order,
  };
}

function isOrderOwner(ctx, order) {
  const userId = authUserId(ctx);
  return Boolean(userId && order?.userId && String(order.userId) === String(userId));
}

function isPaidOrder(order) {
  const paymentStatus = String(order?.payment?.status || "").toLowerCase();
  const orderPaymentStatus = String(order?.orderPaymentStatus || "").toLowerCase();
  return PAID_STATUSES.has(paymentStatus) || PAID_STATUSES.has(orderPaymentStatus);
}

function buildInventoryLineFromItem(item = {}) {
  if (["cancelled", "returned"].includes(String(item?.status || "").toLowerCase())) {
    return null;
  }
  const menuItemId = item.dishId || item.menuItemId || item.itemId;
  const servingKey = String(item.servingKey || item?.servingVariant?.key || "").trim();
  if (!menuItemId || !servingKey) return null;

  const mode = item?.servingVariant?.mode || null;
  if (mode === "BY_WEIGHT") {
    const grams = Number(item.weightGrams || 0);
    if (!Number.isFinite(grams) || grams <= 0) return null;
    return {
      menuItemId,
      quantity: 1,
      weightGrams: Math.round(grams),
      servingKey,
      servingMode: "BY_WEIGHT",
      preparationMethodName: item?.servingVariant?.name || null,
    };
  }

  const quantity = Number(item.quantity || 0);
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  return {
    menuItemId,
    quantity,
    weightGrams: item.weightGrams ? Number(item.weightGrams) : null,
    servingKey,
    servingMode: mode,
    preparationMethodName: item?.servingVariant?.name || null,
  };
}

function buildInventoryLinesFromOrder(order) {
  return (order?.items || []).map(buildInventoryLineFromItem).filter(Boolean);
}

async function resolveWarehouseId({ restaurantId, warehouseId, session }) {
  if (warehouseId && mongoose.isValidObjectId(warehouseId)) {
    const existing = await Warehouse.findOne({
      _id: new mongoose.Types.ObjectId(warehouseId),
      restaurantId,
    })
      .select({ _id: 1 })
      .session(session);
    if (existing) return existing._id;
  }

  const fallback = await Warehouse.findOne({
    restaurantId,
    isActive: { $ne: false },
  })
    .sort({ createdAt: 1, _id: 1 })
    .select({ _id: 1 })
    .session(session);

  return fallback?._id || null;
}

async function cancelInventoryReservationIfNeeded({ order, warehouseId, session }) {
  if (!RESERVABLE_STATUSES.includes(String(order?.currentStatus || ""))) return;
  const lines = buildInventoryLinesFromOrder(order);
  if (!lines.length) return;

  const resolvedWarehouseId = await resolveWarehouseId({
    restaurantId: order.restaurantId,
    warehouseId,
    session,
  });
  if (!resolvedWarehouseId) {
    throw new GraphQLError("Không tìm thấy kho để hoàn tác giữ tồn kho của đơn.", {
      extensions: { code: "WAREHOUSE_NOT_FOUND" },
    });
  }

  await cancelReservationForOrderTx({
    restaurantId: order.restaurantId,
    warehouseId: resolvedWarehouseId,
    orderCode: order.orderCode,
    lines,
    session,
  });
}

export const CustomerOrderHistoryQuery = {
  async myOrders(_, { limit = 20, cursor } = {}, ctx) {
    const userId = assertAuthenticatedCustomer(ctx);
    return CustomerOrderHistoryQuery.ordersByUser(_, { userId, limit, cursor }, ctx);
  },

  async ordersByUser(_, { userId, limit = 20, cursor } = {}, ctx) {
    const currentUserId = assertAuthenticatedCustomer(ctx);
    const requestedUserId = userId ? String(userId) : currentUserId;
    if (requestedUserId !== currentUserId) {
      throw new GraphQLError("Không thể xem lịch sử đơn hàng của tài khoản khác.", {
        extensions: { code: "FORBIDDEN" },
      });
    }

    const safeLimit = Math.max(1, Math.min(Number(limit || 20), 100));
    const filter = { userId: toObjectId(currentUserId, "userId") };
    if (cursor && mongoose.isValidObjectId(cursor)) {
      filter._id = { $lt: new mongoose.Types.ObjectId(cursor) };
    }

    const rows = await Order.find(filter)
      .sort({ _id: -1 })
      .limit(safeLimit + 1)
      .lean({ virtuals: true });

    const hasNextPage = rows.length > safeLimit;
    const slice = hasNextPage ? rows.slice(0, safeLimit) : rows;
    const endCursor = slice.length ? String(slice[slice.length - 1]._id) : null;

    return {
      edges: slice.map((order) => ({
        cursor: String(order._id),
        node: normalizeOrderNode(order),
      })),
      pageInfo: { endCursor, hasNextPage },
    };
  },
};

export const CustomerOrderHistoryMutation = {
  async cancelOrder(_, { restaurantId, orderId, reason, warehouseId }, ctx) {
    const rid = toObjectId(restaurantId, "restaurantId");
    const oid = toObjectId(orderId, "orderId");
    const actorId = authUserId(ctx);

    let order = await Order.findOne({ _id: oid, restaurantId: rid });
    if (!order) throw new GraphQLError("Order not found", { extensions: { code: "NOT_FOUND" } });

    const owner = isOrderOwner(ctx, order);
    if (!owner) {
      await requireRestaurantPermission(ctx, rid, PERMISSIONS.ORDER_CANCEL);
    } else {
      const status = String(order.currentStatus || "").toLowerCase();
      if (!CUSTOMER_CANCEL_ALLOWED_STATUSES.has(status)) {
        throw new GraphQLError("Đơn đã được bếp xử lý nên khách không thể tự hủy.", {
          extensions: { code: "ORDER_STATUS_NOT_CANCELABLE" },
        });
      }
      if (isPaidOrder(order)) {
        throw new GraphQLError("Đơn đã thanh toán nên không thể tự hủy trên ứng dụng.", {
          extensions: { code: "ORDER_ALREADY_PAID" },
        });
      }
    }

    const session = await mongoose.startSession();
    let previousPublicStatus = null;
    let previousStatus = null;
    try {
      await session.withTransaction(async () => {
        order = await Order.findOne({ _id: oid, restaurantId: rid }).session(session);
        if (!order) throw new GraphQLError("Order not found", { extensions: { code: "NOT_FOUND" } });
        previousStatus = order.currentStatus;
        previousPublicStatus = order.publicStatus;

        if (String(order.currentStatus || "") === "cancelled") return;

        await cancelInventoryReservationIfNeeded({ order, warehouseId, session });
        order.currentStatus = "cancelled";
        order.kitchenStatus = "cancelled";
        if (order.sessionStatus && order.orderType !== "dine_in") {
          order.sessionStatus = "cancelled";
        }
        order.customerVisibleNote = owner
          ? "Đơn đã được khách hủy trên ứng dụng."
          : "Đơn đã được nhân viên hủy.";
        order.statusTimeline = order.statusTimeline || [];
        order.statusTimeline.push({
          status: "cancelled",
          at: new Date(),
          note: reason || (owner ? "Khách hủy đơn trên ứng dụng" : "Cancelled"),
          byUserId: actorId && mongoose.isValidObjectId(actorId) ? new mongoose.Types.ObjectId(actorId) : undefined,
        });
        updatePublicStatusHistory(order, owner ? "CUSTOMER" : "STAFF");
        await order.save({ session });
      });
    } finally {
      await session.endSession();
    }

    emitCustomerTrackingUpdateIfChanged({
      ctx,
      orderDoc: order,
      previousPublicStatus,
      force: true,
    });
    await emitOrderEvent(ctx, restaurantId, "ORDER_CANCELLED", {
      order,
      meta: { statusFrom: previousStatus, statusTo: "cancelled", actor: owner ? "customer" : "staff" },
    });

    if (order?.tableCode) {
      await markTableStatus(restaurantId, order.tableCode, "available").catch(() => {});
    }

    return { success: true, order: order.toJSON() };
  },
};
