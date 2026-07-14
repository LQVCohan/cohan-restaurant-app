import {
  notifyCustomerServiceRequest,
  notifyReadyOrderItem,
} from "../../../../src/services/notification/notificationWorkflow.service.js";

const CUSTOMER_REQUEST_CREATED_EVENTS = new Set([
  "CUSTOMER_STAFF_CALL_REQUESTED",
  "CUSTOMER_PAYMENT_REQUESTED",
]);

async function dispatchCustomerRequestNotification(
  restaurantId,
  type,
  payload,
  io = null,
) {
  if (!CUSTOMER_REQUEST_CREATED_EVENTS.has(String(type || "").toUpperCase())) return;

  try {
    await notifyCustomerServiceRequest({
      restaurantId,
      eventType: type,
      request: payload?.request,
      tableCode: payload?.tableCode || payload?.request?.tableCode || null,
      orderCode: payload?.request?.orderCode || payload?.order?.orderCode || null,
      message: payload?.message || payload?.request?.message || null,
      io,
    });
  } catch (error) {
    console.warn(
      `[NOTIFICATION] Customer request fan-out failed (${type}):`,
      error?.message || error,
    );
  }
}

async function dispatchReadyItemNotification(
  restaurantId,
  type,
  payload,
  io = null,
) {
  if (String(type || "").toUpperCase() !== "ORDER_ITEM_STATUS_CHANGED") return;
  if (String(payload?.meta?.statusTo || "").toLowerCase() !== "ready") return;

  const order = payload?.order || null;
  const itemId = String(payload?.meta?.itemId || "").trim();
  const item = (order?.items || []).find(
    (candidate) => String(candidate?._id || candidate?.id || "") === itemId,
  ) || {
    _id: itemId,
    name: payload?.meta?.itemName || "Món",
    station: payload?.meta?.station || null,
  };

  try {
    await notifyReadyOrderItem({
      restaurantId,
      order,
      item,
      io,
    });
  } catch (error) {
    console.warn(
      `[NOTIFICATION] Ready-item fan-out failed (${payload?.meta?.itemName || itemId || "unknown"}):`,
      error?.message || error,
    );
  }
}

// ===============================
// Gửi event cho trang quản lý / POS / Kitchen Display
// ===============================
export async function emitRestaurantEvent(ctx, restaurantId, type, payload) {
  const io = ctx?.io || null;
  await dispatchCustomerRequestNotification(restaurantId, type, payload, io);
  await dispatchReadyItemNotification(restaurantId, type, payload, io);

  if (!io) return;

  io.to(`restaurant_${restaurantId}`).emit("orderEvents", {
    type,
    ...payload,
  });

  console.log(`[SOCKET.IO] -> restaurant_${restaurantId} (${type})`);
}

// ===============================
// Gửi event cho khách hàng (theo orderCode)
// ===============================
export async function emitCustomerEvent(ctx, orderCode, type, payload) {
  if (!ctx?.io || !orderCode) return;

  const room = `order_${orderCode}`;
  ctx.io.to(room).emit("orderCustomerEvents", {
    type,
    ...payload,
  });

  console.log(`[SOCKET.IO] -> ${room} (${type})`);
}

// ===============================
// OPTIONAL: gửi event cho tài xế
// ===============================
export async function emitDriverEvent(ctx, driverId, type, payload) {
  if (!ctx?.io || !driverId) return;

  const room = `driver_${driverId}`;
  ctx.io.to(room).emit("driverEvents", {
    type,
    ...payload,
  });

  console.log(`[SOCKET.IO] -> ${room} (${type})`);
}

export async function emitOrderEvent(ctx, restaurantId, type, orderOrPayload) {
  const payload =
    orderOrPayload &&
    typeof orderOrPayload === "object" &&
    Object.prototype.hasOwnProperty.call(orderOrPayload, "order")
      ? orderOrPayload
      : { order: orderOrPayload };

  return emitRestaurantEvent(ctx, restaurantId, type, payload);
}
