// graphql/resolvers/order/helper/emitOrderEvent.js
export async function emitOrderEvent(ctx, restaurantId, type, order) {
  if (!ctx?.io) {
    console.warn("[SOCKET.IO] io not available in context");
    return;
  }

  const event = {
    type,
    order: order.toJSON ? order.toJSON() : order,
  };

  // 🔹 Broadcast đến room của nhà hàng
  const room = `restaurant_${restaurantId}`;
  ctx.io.to(room).emit("orderEvents", event);

  console.log(`[SOCKET.IO] ${type} -> ${room}`);
}
