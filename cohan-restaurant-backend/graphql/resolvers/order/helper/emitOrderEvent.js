// ===============================
// Gửi event cho trang quản lý / POS / Kitchen Display
// ===============================
export async function emitRestaurantEvent(ctx, restaurantId, type, payload) {
  if (!ctx?.io) return;

  ctx.io.to(`restaurant_${restaurantId}`).emit("orderEvents", {
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
