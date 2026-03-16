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
  return inputUserId || ctx?.user?.id;
}

function assertNotBlocked(cart) {
  const blockedUntil = cart?.abuse?.blockedUntil ? new Date(cart.abuse.blockedUntil) : null;
  if (blockedUntil && blockedUntil > new Date()) {
    throw new GraphQLError(`Bạn đang bị tạm chặn đặt món đến ${blockedUntil.toISOString()}`);
  }
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
            (it.servingVariantKey || "") === (servingVariantKey || "") &&
            String(it.restaurantId) === String(restaurantId)
        );

        const reserveLines = [
          {
            menuItemId,
            quantity: qty,
            servingKey: servingVariantKey || "portion",
          },
        ];

        try {
          await reserveForOrderTx({
            restaurantId,
            warehouseId,
            orderCode: holdOrderCode(cart._id, existing?._id || "new"),
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
        } else {
          cart.items.push({
            menuItemId,
            name,
            price,
            quantity: qty,
            restaurantId,
            thumbImage,
            note,
            servingVariantKey,
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
          meta: { menuItemId, quantity: qty, price, servingVariantKey },
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
          servingVariantKey: servingVariantKey || "portion",
          holdExpiresAt: holdExpiresAt.toISOString(),
        };
      });
    } finally {
      await session.endSession();
    }

    emitInventoryEvent(ctx, eventPayload);
    return after;
  },

  async updateCartItem(_, { input }) {
    const { cartId, itemId, quantity } = input;

    if (!mongoose.isValidObjectId(cartId)) throw new GraphQLError("Invalid cartId");
    if (!mongoose.isValidObjectId(itemId)) throw new GraphQLError("Invalid itemId");

    const cart = await Cart.findById(cartId);
    if (!cart || cart.status !== "active") throw new GraphQLError("Cart not found or not active");

    const it = cart.items.id(itemId);
    if (!it) throw new GraphQLError("Cart item not found");

    it.quantity = quantity <= 0 ? 1 : quantity;
    it.holdExpiresAt = new Date(Date.now() + HOLD_TTL_MS);

    const totals = computeTotals(cart.items);
    cart.totalQuantity = totals.totalQuantity;
    cart.totalAmount = totals.totalAmount;
    cart.lastActivityAt = new Date();

    await cart.save();
    return cart.toObject({ virtuals: true });
  },

  async removeCartItem(_, { input }, ctx) {
    const { cartId, itemId } = input;

    if (!mongoose.isValidObjectId(cartId)) throw new GraphQLError("Invalid cartId");
    if (!mongoose.isValidObjectId(itemId)) throw new GraphQLError("Invalid itemId");

    const cart = await Cart.findById(cartId);
    if (!cart || cart.status !== "active") throw new GraphQLError("Cart not found or not active");

    const it = cart.items.id(itemId);
    if (!it) throw new GraphQLError("Cart item not found");

    const warehouseId = await resolveWarehouseIdOrDefault(it.restaurantId);
    await cancelReservationForOrderTx({
      restaurantId: it.restaurantId,
      warehouseId,
      orderCode: holdOrderCode(cart._id, itemId),
      lines: [{ menuItemId: it.menuItemId, quantity: it.quantity, servingKey: it.servingVariantKey || "portion" }],
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
      servingVariantKey: it.servingVariantKey || "portion",
      reason: "remove_item",
    });

    return cart.toObject({ virtuals: true });
  },

  async clearCart(_, { input }, ctx) {
    const { cartId } = input;

    if (!mongoose.isValidObjectId(cartId)) throw new GraphQLError("Invalid cartId");

    const cart = await Cart.findById(cartId);
    if (!cart || cart.status !== "active") return true;

    for (const it of cart.items || []) {
      try {
        const warehouseId = await resolveWarehouseIdOrDefault(it.restaurantId);
        await cancelReservationForOrderTx({
          restaurantId: it.restaurantId,
          warehouseId,
          orderCode: holdOrderCode(cart._id, it._id),
          lines: [{ menuItemId: it.menuItemId, quantity: it.quantity, servingKey: it.servingVariantKey || "portion" }],
        });
      } catch (_e) {}

      emitInventoryEvent(ctx, {
        type: "INVENTORY_RELEASED",
        restaurantId: String(it.restaurantId),
        menuItemId: String(it.menuItemId),
        servingVariantKey: it.servingVariantKey || "portion",
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
    if (!mongoose.isValidObjectId(uid)) throw new GraphQLError("Invalid userId");

    const cart = await Cart.findOne({ userId: uid, status: "active" });
    if (!cart) return true;

    const reason = String(input.reason || "exit");
    for (const it of cart.items || []) {
      try {
        const warehouseId = await resolveWarehouseIdOrDefault(it.restaurantId);
        await cancelReservationForOrderTx({
          restaurantId: it.restaurantId,
          warehouseId,
          orderCode: holdOrderCode(cart._id, it._id),
          lines: [{ menuItemId: it.menuItemId, quantity: it.quantity, servingKey: it.servingVariantKey || "portion" }],
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
