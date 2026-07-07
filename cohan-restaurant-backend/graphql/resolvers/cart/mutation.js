import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Cart, Warehouse, MenuItem, Menu, Combo } from "../../../models/index.js";
import { applyCartDerivedFields } from "../../../models/cartDerivedFields.js";
import { getPublicRestaurantOrThrow, assertRestaurantCanOrder } from "../shared/restaurantCapabilityGuards.js";
import { logObjectEvent } from "../../../src/services/eventLog.service.js";
import {
  reserveForOrderTx,
  cancelReservationForOrderTx,
} from "../../../src/services/inventory.service.js";
import {
  notifyAvailabilityWatchersForMenuItem,
  publishMenuItemOutOfStock,
} from "../../../src/services/menuAvailabilityWatch.service.js";

const HOLD_TTL_MS = 5 * 60 * 1000;
const ABUSE_BLOCK_THRESHOLD = 8;
const ABUSE_WARN_THRESHOLD = 3;
const ABUSE_BLOCK_MS = 60 * 60 * 1000;

function unauthenticated() {
  return new GraphQLError("Unauthorized", { extensions: { code: "UNAUTHENTICATED" } });
}

function forbidden() {
  return new GraphQLError("Forbidden", { extensions: { code: "FORBIDDEN" } });
}

function outOfStockError(message) {
  return new GraphQLError(message, { extensions: { code: "OUT_OF_STOCK" } });
}

function cartConflictError() {
  return new GraphQLError(
    "Giỏ hàng vừa được cập nhật từ một yêu cầu khác. Vui lòng thử lại.",
    { extensions: { code: "CART_CONFLICT_RETRY" } },
  );
}

function cartStateUnknownError() {
  return new GraphQLError(
    "Chưa xác định được kết quả cập nhật giỏ hàng. Vui lòng tải lại giỏ trước khi thao tác tiếp.",
    { extensions: { code: "CART_STATE_UNKNOWN" } },
  );
}

function isInsufficientStockReservationError(error) {
  const message = String(error?.message || "");
  return (
    error?.code === "INSUFFICIENT_STOCK" ||
    message === "Insufficient" ||
    message.startsWith("Insufficient available stock to reserve ingredient ")
  );
}

function isRetryableCartConflict(error) {
  const labels = Array.isArray(error?.errorLabels) ? error.errorLabels : [];
  return (
    Number(error?.code) === 11000 ||
    Number(error?.code) === 112 ||
    error?.codeName === "WriteConflict" ||
    labels.includes("TransientTransactionError")
  );
}

function rethrowCartTransactionError(error) {
  if (error?.extensions?.code) throw error;
  const labels = Array.isArray(error?.errorLabels) ? error.errorLabels : [];
  if (labels.includes("UnknownTransactionCommitResult")) {
    throw cartStateUnknownError();
  }
  if (isRetryableCartConflict(error)) {
    throw cartConflictError();
  }
  throw error;
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

function stringifyCartHoldIdSegment(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  if (typeof value?.toHexString === "function") return value.toHexString();
  if (typeof value?.toString === "function" && value.toString !== Object.prototype.toString) {
    return value.toString();
  }
  if (value?._id != null) return stringifyCartHoldIdSegment(value._id);
  return String(value);
}

function createCartItemId() {
  const buildObjectId = mongoose?.Types?.ObjectId;
  let generatedId;

  try {
    generatedId = buildObjectId();
  } catch {
    generatedId = new buildObjectId();
  }

  return stringifyCartHoldIdSegment(generatedId);
}

function holdOrderCode(cartId, itemId) {
  return `CART:${String(cartId)}:${stringifyCartHoldIdSegment(itemId)}`;
}

function emitInventoryEvent(ctx, payload = {}) {
  if (!ctx?.io || !payload?.restaurantId) return;
  ctx.io.to(`restaurant_${payload.restaurantId}`).emit("inventoryEvents", payload);
}

async function publishOutOfStock(ctx, { restaurantId, menuItemId, servingKey, source }) {
  try {
    await publishMenuItemOutOfStock({
      io: ctx?.io,
      restaurantId,
      menuItemId,
      servingKey,
      source,
      reason: "reserve_failed",
    });
  } catch (err) {
    console.warn("[Cart] Failed to publish out-of-stock event", err?.message || err);
  }
}

async function notifyWatchersFromReleaseEvent(ctx, event) {
  if (!event?.restaurantId || !event?.menuItemId) return;
  try {
    await notifyAvailabilityWatchersForMenuItem({
      io: ctx?.io,
      restaurantId: event.restaurantId,
      menuItemId: event.menuItemId,
      servingKey: event.servingVariantKey,
      source: event.reason || "cart_release",
    });
  } catch (err) {
    console.warn("[Cart] Failed to notify availability watchers", err?.message || err);
  }
}

async function resolveWarehouseIdOrDefault(restaurantId, session) {
  let q = Warehouse.findOne({ restaurantId, isActive: true }).sort({ createdAt: 1, _id: 1 });
  if (session) q = q.session(session);
  const wh = await q.lean();
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

function normalizeCartItemNote(value) {
  return String(value || "").trim();
}

function isComboCartItem(item) {
  return String(item?.itemType || "MENU_ITEM") === "COMBO";
}

function isSameComboIdentity(item, { restaurantId, comboId }) {
  return isComboCartItem(item) && String(item?.comboId || "") === String(comboId) && String(item?.restaurantId || "") === String(restaurantId);
}

function isSameCartIdentity(item, { restaurantId, menuItemId, servingKey, note }) {
  return (
    String(item?.menuItemId) === String(menuItemId) &&
    getCartServingKey(item?.servingKey || item?.servingVariantKey) === servingKey &&
    String(item?.restaurantId) === String(restaurantId) &&
    normalizeCartItemNote(item?.note) === normalizeCartItemNote(note)
  );
}

function getCartServingKey(value) {
  const key = String(value || "").trim();
  return key || "portion";
}

function normalizeReleaseReason(value) {
  const reason = String(value || "exit").trim().toLowerCase();
  return reason || "exit";
}

function isActiveHoldItem(item) {
  return !item?.holdStatus || item.holdStatus === "active";
}

function isExpiredHoldItem(item, now) {
  if (!item?.holdExpiresAt) return false;
  const holdExpiresAt = new Date(item.holdExpiresAt);
  if (Number.isNaN(holdExpiresAt.getTime())) return false;
  return holdExpiresAt <= now;
}

function getItemsToReleaseForReason(cart, reason, now) {
  const activeItems = [...(cart?.items || [])].filter((item) => isActiveHoldItem(item) && !isComboCartItem(item));

  if (reason === "timeout") {
    return activeItems.filter((item) => isExpiredHoldItem(item, now));
  }

  return activeItems;
}

function removeReleasedItems(cart, releasedItems = []) {
  const releasedIds = new Set(releasedItems.map((item) => String(item._id)));
  cart.items = [...(cart.items || [])].filter(
    (item) => !releasedIds.has(String(item._id))
  );
}

function applyHoldAbusePenalty(cart, reason, now) {
  if (reason !== "exit" && reason !== "timeout") return;

  cart.abuse = cart.abuse || {};

  if (reason === "exit") {
    cart.abuse.exitReleaseCount = Number(cart.abuse.exitReleaseCount || 0) + 1;
  }

  if (reason === "timeout") {
    cart.abuse.timeoutReleaseCount = Number(cart.abuse.timeoutReleaseCount || 0) + 1;
  }

  cart.abuse.lastViolationAt = now;

  const totalReleaseCount =
    Number(cart.abuse.exitReleaseCount || 0) +
    Number(cart.abuse.timeoutReleaseCount || 0);

  if (totalReleaseCount >= ABUSE_BLOCK_THRESHOLD) {
    cart.abuse.blockedUntil = new Date(now.getTime() + ABUSE_BLOCK_MS);
  } else if (totalReleaseCount >= ABUSE_WARN_THRESHOLD) {
    cart.abuse.warningCount = Number(cart.abuse.warningCount || 0) + 1;
  }
}

function buildCartReleaseLine(item) {
  return {
    menuItemId: item.menuItemId,
    quantity: item.quantity,
    servingKey: getCartServingKey(item.servingKey || item.servingVariantKey),
  };
}

function buildInventoryReleasePayload(item, reason) {
  if (isComboCartItem(item) || !item?.menuItemId) return null;
  const servingKey = getCartServingKey(item.servingKey || item.servingVariantKey);
  return {
    type: "INVENTORY_RELEASED",
    restaurantId: String(item.restaurantId),
    menuItemId: String(item.menuItemId),
    servingVariantKey: servingKey,
    quantityDelta: Number(item.quantity || 0),
    reason,
  };
}

function buildInventoryReleaseEvents(items = [], reason, cartId) {
  return (items || [])
    .map((item) => {
      const payload = buildInventoryReleasePayload(item, reason);
      if (!payload) return null;
      return {
        ...payload,
        cartId: String(cartId),
        cartItemId: String(item._id),
      };
    })
    .filter(Boolean);
}

async function releaseCartItemsTx({ cart, items, session }) {
  for (const item of items || []) {
    if (isComboCartItem(item)) continue;
    const warehouseId = await resolveWarehouseIdOrDefault(item.restaurantId, session);
    await cancelReservationForOrderTx({
      restaurantId: item.restaurantId,
      warehouseId,
      orderCode: holdOrderCode(cart._id, item._id),
      lines: [buildCartReleaseLine(item)],
      session,
    });
  }
}

function rethrowManualReleaseError(err, message) {
  const code = err?.extensions?.code;
  if (code === "UNAUTHENTICATED" || code === "FORBIDDEN") throw err;
  throw new GraphQLError(message);
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
      note,
      servingVariantKey,
    } = input;

    const uid = getUserId(userId, ctx);
    if (!mongoose.isValidObjectId(uid)) throw new GraphQLError("Invalid userId");
    if (!mongoose.isValidObjectId(restaurantId)) throw new GraphQLError("Invalid restaurantId");
    if (!mongoose.isValidObjectId(menuItemId)) throw new GraphQLError("Invalid menuItemId");

    const qty = Number(quantity || 1);
    if (!(qty > 0)) throw new GraphQLError("quantity must be > 0");

    const { availability } = await getPublicRestaurantOrThrow(restaurantId);
    assertRestaurantCanOrder(availability);
    const warehouseId = await resolveWarehouseIdOrDefault(restaurantId);
    const servingKey = getCartServingKey(servingVariantKey);
    const menuItem = await MenuItem.findById(menuItemId).lean();
    if (!menuItem) throw new GraphQLError("Món ăn không tồn tại.", { extensions: { code: "BAD_USER_INPUT" } });
    const availableVariants = Array.isArray(menuItem.servingVariants) ? menuItem.servingVariants : [];
    const matchedVariant = availableVariants.find((variant) => String(variant?.key || "") === String(servingKey));
    if (availableVariants.length && !matchedVariant) {
      throw new GraphQLError("Biến thể phục vụ không hợp lệ.", { extensions: { code: "BAD_USER_INPUT" } });
    }
    const serverSnapshotPrice = Number(matchedVariant?.price ?? menuItem.basePrice ?? 0);
    const serverSnapshotName = menuItem.name || "";
    const serverSnapshotThumb = menuItem.thumbImage || null;
    if (String(menuItem.restaurantId) !== String(restaurantId)) throw new GraphQLError("Món ăn không thuộc nhà hàng đã chọn.", { extensions: { code: "BAD_USER_INPUT" } });
    if (String(menuItem.status || "") !== "available") throw new GraphQLError("Món ăn hiện không khả dụng.", { extensions: { code: "BAD_USER_INPUT" } });
    if (String(menuItem.inventoryStatus || "") === "OUT_OF_STOCK") throw outOfStockError("Món đã hết hàng.");
    if (menuItem.menuId && mongoose.isValidObjectId(menuItem.menuId)) {
      const menu = await Menu.findOne({ _id: menuItem.menuId, restaurantId, isActive: true }).lean();
      if (!menu) throw new GraphQLError("Món ăn không thuộc menu đang hoạt động.", { extensions: { code: "BAD_USER_INPUT" } });
    }

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

        const existing = cart.items.find((it) =>
          isSameCartIdentity(it, { restaurantId, menuItemId, servingKey, note })
        );
        const reservedItemId =
          existing?._id != null ? stringifyCartHoldIdSegment(existing._id) : createCartItemId();

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
        } catch (error) {
          if (!isInsufficientStockReservationError(error)) throw error;
          await publishOutOfStock(ctx, {
            restaurantId,
            menuItemId,
            servingKey,
            source: "cart_add",
          });
          throw outOfStockError("Món đã hết hàng hoặc không đủ tồn kho để giữ chỗ.");
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
            itemType: "MENU_ITEM",
            menuItemId,
            name: serverSnapshotName,
            price: serverSnapshotPrice,
            quantity: qty,
            restaurantId,
            thumbImage: serverSnapshotThumb,
            note,
            servingKey,
            holdExpiresAt,
            holdStatus: "active",
          });
        }

        const totals = computeTotals(cart.items);
        cart.totalQuantity = totals.totalQuantity;
        applyCartDerivedFields(cart, { now });

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
          meta: { menuItemId, quantity: qty, price: serverSnapshotPrice, servingVariantKey: servingKey },
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
    } catch (error) {
      rethrowCartTransactionError(error);
    } finally {
      await session.endSession();
    }

    emitInventoryEvent(ctx, eventPayload);
    return after;
  },

  async addComboToCart(_, { comboId, quantity = 1 }, ctx) {
    const uid = requireAuthUser(ctx);
    if (!mongoose.isValidObjectId(comboId)) throw new GraphQLError("Invalid comboId");
    const qty = Math.max(1, Math.floor(Number(quantity || 1)));
    const combo = await Combo.findOne({ _id: comboId, isActive: { $ne: false } })
      .populate("restaurantId")
      .populate("items.menuItemId");
    if (!combo) throw new GraphQLError("Combo không tồn tại.");
    if (!combo.restaurantId) throw new GraphQLError("Combo chưa có nhà hàng.");
    if (!Array.isArray(combo.items) || !combo.items.length) throw new GraphQLError("Combo chưa có món.");
    const restaurantId = combo.restaurantId?._id || combo.restaurantId;
    const { availability } = await getPublicRestaurantOrThrow(restaurantId);
    assertRestaurantCanOrder(availability);
    const snapshotItems = combo.items.map((row) => {
      const item = row?.menuItemId;
      if (!item?._id) throw new GraphQLError("Combo có món không hợp lệ.");
      if (String(item.restaurantId) !== String(restaurantId)) throw new GraphQLError("Món trong combo không thuộc cùng nhà hàng.");
      if (String(item.status || "available") !== "available") throw new GraphQLError(`Món ${item.name || ""} trong combo hiện không khả dụng.`);
      return { menuItemId: String(item._id), name: item.name || "Món", qty: Math.max(1, Number(row.qty || 1)), price: Number(item.basePrice || 0), imageUrl: item.thumbImage || null };
    });
    const originalPrice = snapshotItems.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 1), 0);
    const unitPrice = Number(combo.price || 0);
    if (!(unitPrice > 0)) throw new GraphQLError("Combo chưa có giá hợp lệ.");
    const snapshot = { comboId: String(combo._id), name: combo.name, restaurantId: String(restaurantId), restaurantName: combo.restaurantId?.name || null, items: snapshotItems, originalPrice, comboPrice: unitPrice, imageUrl: combo.imageUrl || snapshotItems.find((item) => item.imageUrl)?.imageUrl || null };
    let after = null;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        let cart = await Cart.findOne({ userId: uid, status: "active" }).session(session);
        if (!cart) cart = await Cart.create([{ userId: uid, items: [], status: "active" }], { session }).then((x) => x[0]);
        assertNotBlocked(cart);
        const existing = cart.items.find((it) => isSameComboIdentity(it, { restaurantId, comboId }));
        if (existing) {
          existing.quantity = Number(existing.quantity || 1) + qty;
          existing.comboSnapshot = snapshot;
          existing.price = unitPrice;
          existing.name = combo.name;
          existing.thumbImage = snapshot.imageUrl;
        } else {
          cart.items.push({ itemType: "COMBO", comboId, menuItemId: snapshotItems[0]?.menuItemId, restaurantId, name: combo.name, price: unitPrice, quantity: qty, thumbImage: snapshot.imageUrl, comboSnapshot: snapshot, holdStatus: "active" });
        }
        applyCartDerivedFields(cart, { now: new Date() });
        await cart.save({ session });
        after = cart.toObject({ virtuals: true });
      });
    } catch (error) {
      rethrowCartTransactionError(error);
    } finally {
      await session.endSession();
    }
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
        const now = new Date();
        const holdExpiresAt = new Date(now.getTime() + HOLD_TTL_MS);
        const servingKey = getCartServingKey(it.servingKey || it.servingVariantKey);
        const isComboItem = isComboCartItem(it);

        if (!isComboItem && delta > 0) {
          const restaurantId = it.restaurantId;
          const { availability } = await getPublicRestaurantOrThrow(restaurantId);
          assertRestaurantCanOrder(availability);
          const warehouseId = await resolveWarehouseIdOrDefault(restaurantId, session);
          const orderCode = holdOrderCode(cart._id, it._id);
          try {
            await reserveForOrderTx({
              restaurantId,
              warehouseId,
              orderCode,
              lines: [{ menuItemId: it.menuItemId, quantity: delta, servingKey }],
              session,
            });
          } catch (error) {
            if (!isInsufficientStockReservationError(error)) throw error;
            await publishOutOfStock(ctx, {
              restaurantId,
              menuItemId: it.menuItemId,
              servingKey,
              source: "cart_update",
            });
            throw outOfStockError("Món đã hết hàng hoặc không đủ tồn kho để tăng số lượng.");
          }
        } else if (!isComboItem && delta < 0) {
          const restaurantId = it.restaurantId;
          const warehouseId = await resolveWarehouseIdOrDefault(restaurantId, session);
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
        if (!isComboItem) {
          it.holdExpiresAt = holdExpiresAt;
          it.holdStatus = "active";
          it.servingKey = servingKey;
        }

        const totals = computeTotals(cart.items);
        cart.totalQuantity = totals.totalQuantity;
        applyCartDerivedFields(cart, { now });

        await cart.save({ session });
        after = cart.toObject({ virtuals: true });

        if (!isComboItem && delta > 0) {
          eventPayload = {
            type: "INVENTORY_HELD",
            restaurantId: String(it.restaurantId),
            menuItemId: String(it.menuItemId),
            servingVariantKey: servingKey,
            quantityDelta: delta,
            holdExpiresAt: holdExpiresAt.toISOString(),
          };
        } else if (!isComboItem && delta < 0) {
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
    } catch (error) {
      rethrowCartTransactionError(error);
    } finally {
      await session.endSession();
    }

    emitInventoryEvent(ctx, eventPayload);
    await notifyWatchersFromReleaseEvent(ctx, eventPayload);
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

    let eventPayload = null;

    if (!isComboCartItem(it)) {
      const servingKey = getCartServingKey(it.servingKey || it.servingVariantKey);
      const restaurantId = it.restaurantId;
      const menuItemId = it.menuItemId;
      const warehouseId = await resolveWarehouseIdOrDefault(restaurantId);
      await cancelReservationForOrderTx({
        restaurantId,
        warehouseId,
        orderCode: holdOrderCode(cart._id, itemId),
        lines: [{ menuItemId, quantity: it.quantity, servingKey }],
      });

      eventPayload = {
        type: "INVENTORY_RELEASED",
        restaurantId: String(restaurantId),
        menuItemId: String(menuItemId),
        servingVariantKey: servingKey,
        reason: "remove_item",
      };
    }

    it.remove();

    const totals = computeTotals(cart.items);
    cart.totalQuantity = totals.totalQuantity;
    applyCartDerivedFields(cart);

    await cart.save();

    emitInventoryEvent(ctx, eventPayload);
    await notifyWatchersFromReleaseEvent(ctx, eventPayload);

    return cart.toObject({ virtuals: true });
  },

  async clearCart(_, { input }, ctx) {
    const { cartId } = input;

    if (!mongoose.isValidObjectId(cartId)) throw new GraphQLError("Invalid cartId");
    requireAuthUser(ctx);

    const session = await mongoose.startSession();
    let releaseEvents = [];

    try {
      await session.withTransaction(async () => {
        const cart = await Cart.findOne({ _id: cartId, status: "active" }).session(session);
        if (!cart) return;

        assertCartOwner(cart, ctx);

        const itemsToRelease = [...(cart.items || [])];
        await releaseCartItemsTx({ cart, items: itemsToRelease, session });

        cart.items = [];
        cart.totalQuantity = 0;
        applyCartDerivedFields(cart);

        await cart.save({ session });

        releaseEvents = buildInventoryReleaseEvents(itemsToRelease, "clear_cart", cart._id);
      });
    } catch (err) {
      rethrowManualReleaseError(
        err,
        "Không thể xóa giỏ hàng vì không trả được nguyên liệu đã giữ. Vui lòng thử lại."
      );
    } finally {
      await session.endSession();
    }

    for (const event of releaseEvents) {
      emitInventoryEvent(ctx, event);
      await notifyWatchersFromReleaseEvent(ctx, event);
    }
    return true;
  },

  async releaseMyCartHolds(_, { input = {} }, ctx) {
    const uid = getUserId(input.userId, ctx);
    const reason = normalizeReleaseReason(input.reason);

    const session = await mongoose.startSession();
    let releaseEvents = [];

    try {
      await session.withTransaction(async () => {
        const cart = await Cart.findOne({ userId: uid, status: "active" }).session(session);
        if (!cart) return;

        const now = new Date();
        const itemsToRelease = getItemsToReleaseForReason(cart, reason, now);

        if (!itemsToRelease.length) {
          return;
        }

        await releaseCartItemsTx({ cart, items: itemsToRelease, session });

        applyHoldAbusePenalty(cart, reason, now);

        removeReleasedItems(cart, itemsToRelease);

        const totals = computeTotals(cart.items);
        cart.totalQuantity = totals.totalQuantity;
        applyCartDerivedFields(cart, { now });

        await cart.save({ session });

        releaseEvents = buildInventoryReleaseEvents(itemsToRelease, reason, cart._id);
      });
    } catch (err) {
      rethrowManualReleaseError(err, "Không thể trả món đã giữ trong giỏ. Vui lòng thử lại.");
    } finally {
      await session.endSession();
    }

    for (const event of releaseEvents) {
      emitInventoryEvent(ctx, event);
      await notifyWatchersFromReleaseEvent(ctx, event);
    }
    return true;
  },
};
