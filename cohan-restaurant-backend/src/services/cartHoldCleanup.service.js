import mongoose from "mongoose";
import { Cart, Warehouse } from "../../models/index.js";
import { cancelReservationForOrderTx } from "./inventory.service.js";

const ABUSE_BLOCK_THRESHOLD = 8;
const ABUSE_BLOCK_MS = 60 * 60 * 1000;

function holdOrderCode(cartId, itemId) {
  return `CART:${cartId}:${itemId}`;
}

async function resolveWarehouseIdOrDefault(restaurantId, session) {
  let q = Warehouse.findOne({ restaurantId, isActive: true })
    .sort({ createdAt: 1, _id: 1 });
  if (session) q = q.session(session);
  const wh = await q.lean();
  return wh?._id || null;
}

function getServingKey(item) {
  return item?.servingVariantKey || item?.servingKey || "portion";
}

function isExpiredActiveHold(item, now) {
  if (!item?.holdExpiresAt) return false;
  if (item.holdStatus !== "active") return false;
  return new Date(item.holdExpiresAt) <= now;
}

function computeTotals(items = []) {
  return {
    totalQuantity: items.reduce((s, i) => s + Number(i.quantity || 0), 0),
    totalAmount: items.reduce(
      (s, i) => s + Number(i.quantity || 0) * Number(i.price || 0),
      0
    ),
  };
}

function buildReleaseEvent(cart, item) {
  return {
    type: "INVENTORY_RELEASED",
    restaurantId: String(item.restaurantId),
    menuItemId: String(item.menuItemId),
    servingVariantKey: getServingKey(item),
    quantityDelta: Number(item.quantity || 0),
    reason: "timeout",
    cartId: String(cart._id),
    cartItemId: String(item._id),
  };
}

function emitInventoryReleased(io, event) {
  if (!io || !event?.restaurantId) return;
  io.to(`restaurant_${event.restaurantId}`).emit("inventoryEvents", event);
}

function logCleanupError(logger, payload) {
  if (logger?.error) {
    logger.error(payload, "[CartHold Cleanup] Failed to release expired cart hold");
    return;
  }
  // eslint-disable-next-line no-console
  console.error("[CartHold Cleanup] Failed to release expired cart hold", payload);
}

export async function cleanupExpiredCartHolds(io, logger = console) {
  const now = new Date();
  const summary = {
    cartsScanned: 0,
    cartsTouched: 0,
    released: 0,
    releasedQuantity: 0,
    failed: 0,
    errors: [],
  };

  const carts = await Cart.find({
    status: "active",
    items: {
      $elemMatch: {
        holdStatus: "active",
        holdExpiresAt: { $lte: now },
      },
    },
  }).select({ _id: 1 });

  summary.cartsScanned = carts.length;

  for (const candidate of carts) {
    const session = await mongoose.startSession();
    let releaseEvents = [];
    let cartReleasedCount = 0;
    let cartReleasedQuantity = 0;

    try {
      await session.withTransaction(async () => {
        const cart = await Cart.findOne({ _id: candidate._id, status: "active" }).session(session);
        if (!cart) return;

        const expiredActiveItems = (cart.items || []).filter((it) =>
          isExpiredActiveHold(it, now)
        );
        if (!expiredActiveItems.length) return;

        for (const it of expiredActiveItems) {
          const warehouseId = await resolveWarehouseIdOrDefault(it.restaurantId, session);
          if (warehouseId) {
            await cancelReservationForOrderTx({
              restaurantId: it.restaurantId,
              warehouseId,
              orderCode: holdOrderCode(cart._id, it._id),
              lines: [
                {
                  menuItemId: it.menuItemId,
                  quantity: it.quantity,
                  servingKey: getServingKey(it),
                },
              ],
              session,
            });
          }
        }

        const expiredIds = new Set(expiredActiveItems.map((it) => String(it._id)));
        cart.items = (cart.items || []).filter((it) => !expiredIds.has(String(it._id)));

        const totals = computeTotals(cart.items);
        cart.totalQuantity = totals.totalQuantity;
        cart.totalAmount = totals.totalAmount;

        cart.abuse = cart.abuse || {};
        cart.abuse.timeoutReleaseCount = Number(cart.abuse.timeoutReleaseCount || 0) + 1;
        cart.abuse.lastViolationAt = new Date();
        if (
          Number(cart.abuse.timeoutReleaseCount || 0) +
            Number(cart.abuse.exitReleaseCount || 0) >=
          ABUSE_BLOCK_THRESHOLD
        ) {
          cart.abuse.blockedUntil = new Date(Date.now() + ABUSE_BLOCK_MS);
        }

        await cart.save({ session });

        releaseEvents = expiredActiveItems.map((it) => buildReleaseEvent(cart, it));
        cartReleasedCount = expiredActiveItems.length;
        cartReleasedQuantity = expiredActiveItems.reduce(
          (sum, it) => sum + Number(it.quantity || 0),
          0
        );
      });

      if (cartReleasedCount > 0) {
        summary.cartsTouched += 1;
        summary.released += cartReleasedCount;
        summary.releasedQuantity += cartReleasedQuantity;
        for (const event of releaseEvents) emitInventoryReleased(io, event);
      }
    } catch (err) {
      summary.failed += 1;
      const errorInfo = {
        cartId: String(candidate._id),
        message: err?.message || String(err),
      };
      if (summary.errors.length < 10) summary.errors.push(errorInfo);
      logCleanupError(logger, { err, ...errorInfo });
    } finally {
      await session.endSession();
    }
  }

  return summary;
}
