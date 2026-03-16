import { Cart, Warehouse } from "../../models/index.js";
import { cancelReservationForOrderTx } from "./inventory.service.js";

function holdOrderCode(cartId, itemId) {
  return `CART:${cartId}:${itemId}`;
}

async function resolveWarehouseIdOrDefault(restaurantId) {
  const wh = await Warehouse.findOne({ restaurantId, isActive: true })
    .sort({ createdAt: 1, _id: 1 })
    .lean();
  return wh?._id || null;
}

export async function cleanupExpiredCartHolds(io) {
  const now = new Date();
  const carts = await Cart.find({
    status: "active",
    "items.holdExpiresAt": { $lte: now },
  });

  let released = 0;

  for (const cart of carts) {
    const remainingItems = [];

    for (const it of cart.items || []) {
      if (!it?.holdExpiresAt || new Date(it.holdExpiresAt) > now) {
        remainingItems.push(it);
        continue;
      }

      const warehouseId = await resolveWarehouseIdOrDefault(it.restaurantId);
      if (warehouseId) {
        try {
          await cancelReservationForOrderTx({
            restaurantId: it.restaurantId,
            warehouseId,
            orderCode: holdOrderCode(cart._id, it._id),
            lines: [
              {
                menuItemId: it.menuItemId,
                quantity: it.quantity,
                servingKey: it.servingVariantKey || "portion",
              },
            ],
          });
        } catch (_e) {}
      }

      released += 1;
      if (io) {
        io.to(`restaurant_${it.restaurantId}`).emit("inventoryEvents", {
          type: "INVENTORY_RELEASED",
          restaurantId: String(it.restaurantId),
          menuItemId: String(it.menuItemId),
          servingVariantKey: it.servingVariantKey || "portion",
          reason: "timeout",
        });
      }
    }

    cart.items = remainingItems;
    cart.totalQuantity = remainingItems.reduce((s, i) => s + Number(i.quantity || 0), 0);
    cart.totalAmount = remainingItems.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.price || 0), 0);

    if (released > 0) {
      cart.abuse.timeoutReleaseCount = Number(cart?.abuse?.timeoutReleaseCount || 0) + 1;
      cart.abuse.lastViolationAt = new Date();
      if ((cart.abuse.timeoutReleaseCount || 0) + (cart.abuse.exitReleaseCount || 0) >= 8) {
        cart.abuse.blockedUntil = new Date(Date.now() + 60 * 60 * 1000);
      }
    }

    await cart.save();
  }

  return { released };
}
