import mongoose from "mongoose";
import { Cart, Warehouse } from "../../models/index.js";
import { cancelReservationForOrderTx } from "./inventory.service.js";
import { notifyAvailabilityWatchersForMenuItem } from "./menuAvailabilityWatch.service.js";
import { notifyAvailableMenuWatchers } from "./menuAvailabilitySweep.service.js";
import { notifyAvailableTableWatchers } from "./tableAvailabilityWatch.service.js";

const ABUSE_WARN_THRESHOLD = 3;
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
  if (!wh?._id) {
    throw new Error(`No active warehouse found for restaurant ${restaurantId}`);
  }
  return wh._id;
}

function getServingKey(item) {
  const key = String(item?.servingKey || item?.servingVariantKey || "").trim();
  return key || "portion";
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

async function notifyWatchersAfterRelease(io, event, logger) {
  if (!event?.restaurantId || !event?.menuItemId) return;
  try {
    await notifyAvailabilityWatchersForMenuItem({
      io,
      restaurantId: event.restaurantId,
      menuItemId: event.menuItemId,
      servingKey: event.servingVariantKey,
      source: "cart_hold_timeout",
    });
  } catch (err) {
    if (logger?.warn) {
      logger.warn({ err, event }, "[CartHold Cleanup] Failed to notify menu availability watchers");
      return;
    }
    console.warn("[CartHold Cleanup] Failed to notify menu availability watchers", err?.message || err);
  }
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
    menuWatchGroupsScanned: 0,
    menuWatchNotified: 0,
    menuWatchSkipped: 0,
    tableWatchNotified: 0,
    tableWatchSkipped: 0,
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

        const expiredIds = new Set(expiredActiveItems.map((it) => String(it._id)));
        cart.items = (cart.items || []).filter((it) => !expiredIds.has(String(it._id)));

        const totals = computeTotals(cart.items);
        cart.totalQuantity = totals.totalQuantity;
        cart.totalAmount = totals.totalAmount;

        cart.abuse = cart.abuse || {};
        cart.abuse.timeoutReleaseCount = Number(cart.abuse.timeoutReleaseCount || 0) + 1;
        cart.abuse.lastViolationAt = now;

        const totalReleaseCount =
          Number(cart.abuse.timeoutReleaseCount || 0) +
          Number(cart.abuse.exitReleaseCount || 0);

        if (totalReleaseCount >= ABUSE_BLOCK_THRESHOLD) {
          cart.abuse.blockedUntil = new Date(now.getTime() + ABUSE_BLOCK_MS);
        } else if (totalReleaseCount >= ABUSE_WARN_THRESHOLD) {
          cart.abuse.warningCount = Number(cart.abuse.warningCount || 0) + 1;
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
        for (const event of releaseEvents) {
          emitInventoryReleased(io, event);
          await notifyWatchersAfterRelease(io, event, logger);
        }
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

  try {
    const menuWatchResult = await notifyAvailableMenuWatchers({ io });
    summary.menuWatchGroupsScanned = Number(menuWatchResult?.groupsScanned || 0);
    summary.menuWatchNotified = Number(menuWatchResult?.notified || 0);
    summary.menuWatchSkipped = Number(menuWatchResult?.skipped || 0);
  } catch (err) {
    if (logger?.warn) {
      logger.warn({ err }, "[CartHold Cleanup] Failed to sweep menu availability watchers");
    } else {
      console.warn("[CartHold Cleanup] Failed to sweep menu availability watchers", err?.message || err);
    }
  }

  try {
    const tableWatchResult = await notifyAvailableTableWatchers({ io });
    summary.tableWatchNotified = Number(tableWatchResult?.notified || 0);
    summary.tableWatchSkipped = Number(tableWatchResult?.skipped || 0);
  } catch (err) {
    if (logger?.warn) {
      logger.warn({ err }, "[CartHold Cleanup] Failed to notify table availability watchers");
    } else {
      console.warn("[CartHold Cleanup] Failed to notify table availability watchers", err?.message || err);
    }
  }

  return summary;
}
