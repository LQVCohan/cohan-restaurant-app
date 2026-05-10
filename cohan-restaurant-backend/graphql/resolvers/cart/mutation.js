import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Cart, Warehouse } from "../../../models/index.js";
import { logObjectEvent } from "../../../src/services/eventLog.service.js";
import {
  reserveForOrderTx,
  cancelReservationForOrderTx,
} from "../../../src/services/inventory.service.js";

const HOLD_TTL_MS = 5 * 60 * 1000;
const ABUSE_BLOCK_THRESHOLD = 8;
const ABUSE_WARN_THRESHOLD = 3;

function unauthenticated() {
  return new GraphQLError("Unauthorized", { extensions: { code: "UNAUTHENTICATED" } });
}

function forbidden() {
  return new GraphQLError("Forbidden", { extensions: { code: "FORBIDDEN" } });
}

function requireAuthUser(ctx) {
  const uid = ctx?.user?.id;
  if (!uid || !mongoose.isValidObjectId(uid)) throw unauthenticated();
  return uid;
}

function resolveSelfUserId(inputUserId, ctx) {
  const authUserId = requireAuthUser(ctx);
  if (inputUserId && String(inputUserId) !== String(authUserId)) throw forbidden();
  return authUserId;
}

function assertCartOwner(cart, ctx) {
  const uid = requireAuthUser(ctx);
  if (!cart || String(cart.userId) !== String(uid)) throw forbidden();
  return uid;
}

function computeTotals(items = []) {
  let totalQuantity = 0;
  let totalAmount = 0;
  for (const i of items) {
    const qty = i.quantity || 0;
    const price = i.price || 0;
    totalQuantity += qty;
    totalAmount += qty * price;
  }
  return { totalQuantity, totalAmount };
}

function holdOrderCode(cartId, itemId) {
  return `CART:${cartId}:${itemId}`;
}

function emitInventoryEvent(ctx, payload = {}) {
  if (!ctx?.io || !payload?.restaurantId) return;
  ctx.io.to(`restaurant_${payload.restaurantId}`).emit("inventoryEvents", payload);
}

async function resolveWarehouseIdOrDefault(restaurantId) {
  const wh = await Warehouse.findOne({ restaurantId, isActive: true })
    .sort({ createdAt: 1, _id: 1 })
    .lean();
  if (!wh?._id) throw new GraphQLError("No warehouse found for this restaurant");
  return wh._id;
}

function getUserId(inputUserId, ctx) {
  return resolveSelfUserId(inputUserId, ctx);
}

function assertNotBlocked(cart) {
  const blockedUntil = cart?.abuse?.blockedUntil ? new Date(cart.abuse.blockedUntil) : null;
  if (blockedUntil && blockedUntil > new Date()) {
    throw new GraphQLError(`Bạn đang bị tạm chặn đặt món đến ${blockedUntil.toISOString()}`);
  }
}

function getCartServingKey(value) {
  const key = String(value || "").trim();
  return key || "portion";
}

export const CartMutation = {
  async addCartItem(_, { input }, ctx) {
    const {
      userId,
      restaurantId,
      menuItemId,
      name,
      price,
      quantity = 1,
      thumbImage,
      note,
      servingVariantKey,
    } = input;

    const uid = getUserId(userId, ctx);
    if (!mongoose.isValidObjectId(uid)) throw new GraphQLError("Invalid userId");
    if (!mongoose.isValidObjectId(restaurantId)) throw new GraphQLError("Invalid restaurantId");
    if (!mongoose.isValidObjectId(menuItemId)) throw new GraphQLError("Invalid menuItemId");

    const qty = Number(quantity || 1);
    if (!(qty > 0)) throw new GraphQLError("quantity must be > 0");

    const warehouseId = await resolveWarehouseIdOrDefault(restaurantId);
    const servingKey = getCartServingKey(servingVariantKey);

    const session = await mongoose.startSession();
    let after = null;
    let eventPayload = null;

    try {
      await session.withTransaction(async () => {
        let cart = await Cart.findOne({ userId: uid, status: "active" }).session(session);
        if (!cart) {
          cart = await Cart.create([{ userId: uid, items: [], status: "active" }], { session }).then((x) => x[0]);
        }

        assertNotBlocked(cart);

        const before = cart.toObject({ virtuals: true });

        const existing = cart.items.find(
          (it) =>
            String(it.menuItemId) === String(menuItemId) &&
            getCartServingKey(it.servingKey || it.servingVariantKey) === servingKey &&
            String(it.restaurantId) === String(restaurantId)
        );
        const reservedItemId = existing?._id || new mongoose.Types.ObjectId();

        const reserveLines = [
          {
            menuItemId,
            quantity: qty,
            servingKey,
          },
        ];

        try {
          await reserveForOrderTx({
            restaurantId,
            warehouseId,
            orderCode: holdOrderCode(cart._id, reservedItemId),
            lines: reserveLines,
            session,
          });
        } catch (e) {
          throw new GraphQLError("Món đã hết hàng hoặc không đủ tồn kho để giữ chỗ.");
        }

        const now = new Date();
        const holdExpiresAt = new Date(now.getTime() + HOLD_TTL_MS);

        if (existing) {
          existing.quantity += qty;
          existing.holdExpiresAt = holdExpiresAt;
          existing.holdStatus = "active";
          existing.servingKey = servingKey;
        } else {
          cart.items.push({
            _id: reservedItemId,
            menuItemId,
            name,
            price,
            quantity: qty,
            restaurantId,
            thumbImage,
            note,
            servingKey,
            holdExpiresAt,
            holdStatus: "active",
          });
        }

        const totals = computeTotals(cart.items);
        cart.totalQuantity = totals.totalQuantity;
        cart.totalAmount = totals.totalAmount;
        cart.lastActivityAt = new Date();

        await cart.save({ session });
        after = cart.toObject({ virtuals: true });

        await logObjectEvent({
          ctx,
          verb: "cart.add_item",
          objectKind: "Cart",
          entity: cart,
          userId: uid,
          source: "web",
          status: "success",
          meta: { menuItemId, quantity: qty, price, servingVariantKey: servingKey },
          diff: {
            before: {
              totalQuantity: before.totalQuantity,
              totalAmount: before.totalAmount,
              itemsCount: before.items?.length || 0,
            },
            after: {
              totalQuantity: after.totalQuantity,
              totalAmount: after.totalAmount,
              itemsCount: after.items?.length || 0,
            },
          },
        });

        eventPayload = {
          type: "INVENTORY_HELD",
          restaurantId: String(restaurantId),
          menuItemId: String(menuItemId),
          servingVariantKey: servingKey,
          holdExpiresAt: holdExpiresAt.toISOString(),
        };
      });
    } finally {
      await session.endSession();
    }

    emitInventoryEvent(ctx, eventPayload);
    return after;
  },

  async updateCartItem(_, { input }, ctx) {
    const { cartId, itemId, quantity } = input;
    requireAuthUser(ctx);

    if (!mongoose.isValidObjectId(cartId)) throw new GraphQLError("Invalid cartId");
    if (!mongoose.isValidObjectId(itemId)) throw new GraphQLError("Invalid itemId");
    const parsedQty = Number(quantity || 1);
    if (!Number.isFinite(parsedQty)) throw new GraphQLError("Invalid quantity");

    const session = await mongoose.startSession();
    let after = null;
    let eventPayload = null;

    try {
      await session.withTransaction(async () => {
        const cart = await Cart.findById(cartId).session(session);
        if (!cart || cart.status !== "active") throw new GraphQLError("Cart not found or not active");
        assertCartOwner(cart, ctx);

        const it = cart.items.id(itemId);
        if (!it) throw new GraphQLError("Cart item not found");

        const oldQty = Number(it.quantity || 0);
        const newQty = Math.max(1, parsedQty);
        const delta = newQty - oldQty;
        const holdExpiresAt = new Date(Date.now() + HOLD_TTL_MS);
        const servingKey = getCartServingKey(it.servingKey || it.servingVariantKey);

        if (delta > 0) {
          const restaurantId = it.restaurantId;
          const warehouseId = await resolveWarehouseIdOrDefault(restaurantId);
          const orderCode = holdOrderCode(cart._id, it._id);
          try {
            await reserveForOrderTx({
              restaurantId,
              warehouseId,
              orderCode,
              lines: [{ menuItemId: it.menuItemId, quantity: delta, servingKey }],
              session,
            });
          } catch (e) {
            throw new GraphQLError("Món đã hết hàng hoặc không đủ tồn kho để tăng số lượng.");
          }
        } else if (delta < 0) {
          const restaurantId = it.restaurantId;
          const warehouseId = await resolveWarehouseIdOrDefault(restaurantId);
          const orderCode = holdOrderCode(cart._id, it._id);
          await cancelReservationForOrderTx({
            restaurantId,
            warehouseId,
            orderCode,
            lines: [{ menuItemId: it.menuItemId, quantity: Math.abs(delta), servingKey }],
            session,
          });
        }

        it.quantity = newQty;
        it.holdExpiresAt = holdExpiresAt;
        it.holdStatus = "active";
        it.servingKey = servingKey;

        const totals = computeTotals(cart.items);
        cart.totalQuantity = totals.totalQuantity;
        cart.totalAmount = totals.totalAmount;
        cart.lastActivityAt = new Date();

        await cart.save({ session });
        after = cart.toObject({ virtuals: true });

        if (delta > 0) {
          eventPayload = {
            type: "INVENTORY_HELD",
            restaurantId: String(it.restaurantId),
            menuItemId: String(it.menuItemId),
            servingVariantKey: servingKey,
            quantityDelta: delta,
            holdExpiresAt: holdExpiresAt.toISOString(),
          };
        } else if (delta < 0) {
          eventPayload = {
            type: "INVENTORY_RELEASED",
            restaurantId: String(it.restaurantId),
            menuItemId: String(it.menuItemId),
            servingVariantKey: servingKey,
            quantityDelta: delta,
            reason: "update_quantity",
          };
        }
      });
    } finally {
      await session.endSession();
    }

    emitInventoryEvent(ctx, eventPayload);
    return after;
  },

  async removeCartItem(_, { input }, ctx) {
    const { cartId, itemId } = input;

    if (!mongoose.isValidObjectId(cartId)) throw new GraphQLError("Invalid cartId");
    if (!mongoose.isValidObjectId(itemId)) throw new GraphQLError("Invalid itemId");

    const cart = await Cart.findById(cartId);
    if (!cart || cart.status !== "active") throw new GraphQLError("Cart not found or not active");
    assertCartOwner(cart, ctx);

    const it = cart.items.id(itemId);
    if (!it) throw new GraphQLError("Cart item not found");

    const servingKey = getCartServingKey(it.servingKey || it.servingVariantKey);
    const warehouseId = await resolveWarehouseIdOrDefault(it.restaurantId);
    await cancelReservationForOrderTx({
      restaurantId: it.restaurantId,
      warehouseId,
      orderCode: holdOrderCode(cart._id, itemId),
      lines: [{ menuItemId: it.menuItemId, quantity: it.quantity, servingKey }],
    });

    it.remove();

    const totals = computeTotals(cart.items);
    cart.totalQuantity = totals.totalQuantity;
    cart.totalAmount = totals.totalAmount;
    cart.lastActivityAt = new Date();

    await cart.save();

    emitInventoryEvent(ctx, {
      type: "INVENTORY_RELEASED",
      restaurantId: String(it.restaurantId),
      menuItemId: String(it.menuItemId),
      servingVariantKey: servingKey,
      reason: "remove_item",
    });

    return cart.toObject({ virtuals: true });
  },

  async clearCart(_, { input }, ctx) {
    const { cartId } = input;

    if (!mongoose.isValidObjectId(cartId)) throw new GraphQLError("Invalid cartId");

    requireAuthUser(ctx);

    const cart = await Cart.findById(cartId);
    if (!cart || cart.status !== "active") return true;
    assertCartOwner(cart, ctx);

    for (const it of cart.items || []) {
      const servingKey = getCartServingKey(it.servingKey || it.servingVariantKey);
      try {
        const warehouseId = await resolveWarehouseIdOrDefault(it.restaurantId);
        await cancelReservationForOrderTx({
          restaurantId: it.restaurantId,
          warehouseId,
          orderCode: holdOrderCode(cart._id, it._id),
          lines: [{ menuItemId: it.menuItemId, quantity: it.quantity, servingKey }],
        });
      } catch (_e) {}

      emitInventoryEvent(ctx, {
        type: "INVENTORY_RELEASED",
        restaurantId: String(it.restaurantId),
        menuItemId: String(it.menuItemId),
        servingVariantKey: servingKey,
        reason: "clear_cart",
      });
    }

    cart.items = [];
    cart.totalQuantity = 0;
    cart.totalAmount = 0;
    cart.lastActivityAt = new Date();

    await cart.save();
    return true;
  },

  async releaseMyCartHolds(_, { input = {} }, ctx) {
    const uid = getUserId(input.userId, ctx);

    const cart = await Cart.findOne({ userId: uid, status: "active" });
    if (!cart) return true;

    const reason = String(input.reason || "exit");
    for (const it of cart.items || []) {
      const servingKey = getCartServingKey(it.servingKey || it.servingVariantKey);
      try {
        const warehouseId = await resolveWarehouseIdOrDefault(it.restaurantId);
        await cancelReservationForOrderTx({
          restaurantId: it.restaurantId,
          warehouseId,
          orderCode: holdOrderCode(cart._id, it._id),
          lines: [{ menuItemId: it.menuItemId, quantity: it.quantity, servingKey }],
        });
      } catch (_e) {}
    }

    if (reason === "exit") cart.abuse.exitReleaseCount = Number(cart?.abuse?.exitReleaseCount || 0) + 1;
    cart.abuse.lastViolationAt = new Date();
    if ((cart.abuse.exitReleaseCount || 0) + (cart.abuse.timeoutReleaseCount || 0) >= ABUSE_BLOCK_THRESHOLD) {
      cart.abuse.blockedUntil = new Date(Date.now() + 60 * 60 * 1000);
    } else if ((cart.abuse.exitReleaseCount || 0) + (cart.abuse.timeoutReleaseCount || 0) >= ABUSE_WARN_THRESHOLD) {
      cart.abuse.warningCount = Number(cart?.abuse?.warningCount || 0) + 1;
    }

    cart.items = [];
    cart.totalQuantity = 0;
    cart.totalAmount = 0;
    await cart.save();

    return true;
  },
};
