import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import {
  Cart,
  Menu,
  MenuItem,
  Recipe,
  Warehouse,
} from "../../../models/index.js";
import { applyCartDerivedFields } from "../../../models/cartDerivedFields.js";
import {
  assertRestaurantCanOrder,
  getPublicRestaurantOrThrow,
} from "../shared/restaurantCapabilityGuards.js";
import { resolveMenuTimeSlotAt } from "../../../src/services/restaurantAvailability.service.js";
import { logObjectEvent } from "../../../src/services/eventLog.service.js";
import {
  cancelReservationForOrderTx,
  reserveForOrderTx,
} from "../../../src/services/inventoryWithModifiers.service.js";
import { resolveCustomerModifierSelection } from "../../../src/services/customerModifierSelection.service.js";
import {
  notifyAvailabilityWatchersForMenuItem,
  publishMenuItemOutOfStock,
} from "../../../src/services/menuAvailabilityWatch.service.js";

const HOLD_TTL_MS = 5 * 60 * 1000;
const ABUSE_BLOCK_THRESHOLD = 8;
const ABUSE_WARN_THRESHOLD = 3;
const ABUSE_BLOCK_MS = 60 * 60 * 1000;

const graphQLError = (message, code = "BAD_USER_INPUT") =>
  new GraphQLError(message, { extensions: { code } });

const requireAuthUser = (ctx) => {
  const userId = ctx?.user?.id;
  if (!userId || !mongoose.isValidObjectId(userId)) {
    throw graphQLError("Unauthorized", "UNAUTHENTICATED");
  }
  return userId;
};

const resolveSelfUserId = (inputUserId, ctx) => {
  const authUserId = requireAuthUser(ctx);
  if (inputUserId && String(inputUserId) !== String(authUserId)) {
    throw graphQLError("Forbidden", "FORBIDDEN");
  }
  return authUserId;
};

const assertCartOwner = (cart, ctx) => {
  const userId = requireAuthUser(ctx);
  if (!cart || String(cart.userId) !== String(userId)) {
    throw graphQLError("Forbidden", "FORBIDDEN");
  }
  return userId;
};

const getServingKey = (value) => String(value || "portion").trim() || "portion";
const normalizeNote = (value) => String(value || "").trim();
const normalizeServiceAt = (value) => {
  if (!value) return null;
  const serviceAt = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(serviceAt.getTime())) {
    throw graphQLError("serviceAt không hợp lệ.");
  }
  return serviceAt;
};
const sameServiceAt = (left, right) => {
  const leftTime = left ? new Date(left).getTime() : null;
  const rightTime = right ? new Date(right).getTime() : null;
  return leftTime === rightTime;
};
const isComboItem = (item) => String(item?.itemType || "MENU_ITEM") === "COMBO";
const stringifyId = (value) =>
  value?.toHexString?.() || value?.toString?.() || String(value || "");

const createCartItemId = () => new mongoose.Types.ObjectId();
const holdOrderCode = (cartId, itemId) =>
  `CART:${String(cartId)}:${stringifyId(itemId)}`;

const isInsufficientStockError = (error) => {
  const message = String(error?.message || "");
  return (
    error?.code === "INSUFFICIENT_STOCK" ||
    message === "Insufficient" ||
    message.startsWith("Insufficient available stock to reserve ingredient ")
  );
};

const isRetryableConflict = (error) => {
  const labels = Array.isArray(error?.errorLabels) ? error.errorLabels : [];
  return (
    Number(error?.code) === 11000 ||
    Number(error?.code) === 112 ||
    error?.codeName === "WriteConflict" ||
    labels.includes("TransientTransactionError")
  );
};

const rethrowTransactionError = (error) => {
  if (error?.extensions?.code) throw error;
  const labels = Array.isArray(error?.errorLabels) ? error.errorLabels : [];
  if (labels.includes("UnknownTransactionCommitResult")) {
    throw graphQLError(
      "Chưa xác định được kết quả cập nhật giỏ hàng. Vui lòng tải lại giỏ trước khi thao tác tiếp.",
      "CART_STATE_UNKNOWN",
    );
  }
  if (isRetryableConflict(error)) {
    throw graphQLError(
      "Giỏ hàng vừa được cập nhật từ một yêu cầu khác. Vui lòng thử lại.",
      "CART_CONFLICT_RETRY",
    );
  }
  throw error;
};

const assertNotBlocked = (cart) => {
  const blockedUntil = cart?.abuse?.blockedUntil
    ? new Date(cart.abuse.blockedUntil)
    : null;
  if (blockedUntil && blockedUntil > new Date()) {
    throw graphQLError(
      `Bạn đang bị tạm chặn đặt món đến ${blockedUntil.toISOString()}`,
      "FORBIDDEN",
    );
  }
};

async function resolveWarehouseId(restaurantId, session) {
  let query = Warehouse.findOne({ restaurantId, isActive: true }).sort({
    createdAt: 1,
    _id: 1,
  });
  if (session) query = query.session(session);
  const warehouse = await query.lean();
  if (!warehouse?._id) {
    throw graphQLError("No warehouse found for this restaurant");
  }
  return warehouse._id;
}

const emitInventoryEvent = (ctx, payload) => {
  if (!ctx?.io || !payload?.restaurantId) return;
  ctx.io
    .to(`restaurant_${payload.restaurantId}`)
    .emit("inventoryEvents", payload);
};

async function publishOutOfStock(
  ctx,
  { restaurantId, menuItemId, servingKey, source },
) {
  try {
    await publishMenuItemOutOfStock({
      io: ctx?.io,
      restaurantId,
      menuItemId,
      servingKey,
      source,
      reason: "reserve_failed",
    });
  } catch (error) {
    console.warn(
      "[Cart] Failed to publish out-of-stock event",
      error?.message || error,
    );
  }
}

async function notifyWatchers(ctx, event) {
  if (!event?.restaurantId || !event?.menuItemId) return;
  try {
    await notifyAvailabilityWatchersForMenuItem({
      io: ctx?.io,
      restaurantId: event.restaurantId,
      menuItemId: event.menuItemId,
      servingKey: event.servingVariantKey,
      source: event.reason || "cart_release",
    });
  } catch (error) {
    console.warn(
      "[Cart] Failed to notify availability watchers",
      error?.message || error,
    );
  }
}

const sameCartIdentity = (
  item,
  {
    restaurantId,
    menuItemId,
    servingKey,
    note,
    modifierSelectionKey,
    serviceAt,
  },
) =>
  !isComboItem(item) &&
  String(item?.restaurantId) === String(restaurantId) &&
  String(item?.menuItemId) === String(menuItemId) &&
  getServingKey(item?.servingKey || item?.servingVariantKey) === servingKey &&
  normalizeNote(item?.note) === normalizeNote(note) &&
  String(item?.modifierSelectionKey || "") ===
    String(modifierSelectionKey || "") &&
  sameServiceAt(item?.serviceAt, serviceAt);

const buildInventoryLine = (item, quantity = item?.quantity) => ({
  menuItemId: item.menuItemId,
  quantity,
  servingKey: getServingKey(item.servingKey || item.servingVariantKey),
  modifiers: item.modifiers || [],
});

const buildReleaseEvent = (item, reason, cartId) => {
  if (isComboItem(item) || !item?.menuItemId) return null;
  return {
    type: "INVENTORY_RELEASED",
    restaurantId: String(item.restaurantId),
    menuItemId: String(item.menuItemId),
    servingVariantKey: getServingKey(
      item.servingKey || item.servingVariantKey,
    ),
    quantityDelta: Number(item.quantity || 0),
    reason,
    cartId: String(cartId),
    cartItemId: String(item._id),
  };
};

async function releaseItems({ cart, items, session }) {
  for (const item of items || []) {
    if (isComboItem(item)) continue;
    const warehouseId = await resolveWarehouseId(item.restaurantId, session);
    await cancelReservationForOrderTx({
      restaurantId: item.restaurantId,
      warehouseId,
      orderCode: holdOrderCode(cart._id, item._id),
      lines: [buildInventoryLine(item)],
      session,
    });
  }
}

const applyAbusePenalty = (cart, reason, now) => {
  if (!["exit", "timeout"].includes(reason)) return;
  cart.abuse = cart.abuse || {};
  if (reason === "exit") {
    cart.abuse.exitReleaseCount =
      Number(cart.abuse.exitReleaseCount || 0) + 1;
  } else {
    cart.abuse.timeoutReleaseCount =
      Number(cart.abuse.timeoutReleaseCount || 0) + 1;
  }
  cart.abuse.lastViolationAt = now;

  const total =
    Number(cart.abuse.exitReleaseCount || 0) +
    Number(cart.abuse.timeoutReleaseCount || 0);
  if (total >= ABUSE_BLOCK_THRESHOLD) {
    cart.abuse.blockedUntil = new Date(now.getTime() + ABUSE_BLOCK_MS);
  } else if (total >= ABUSE_WARN_THRESHOLD) {
    cart.abuse.warningCount = Number(cart.abuse.warningCount || 0) + 1;
  }
};

async function loadSellableMenuItem({
  restaurantId,
  menuItemId,
  serviceAt,
  restaurant,
}) {
  const menuItem = await MenuItem.findOne({
    _id: menuItemId,
    restaurantId,
    status: "available",
  }).lean();
  if (!menuItem) {
    throw graphQLError("Món ăn hiện không khả dụng.");
  }
  if (String(menuItem.inventoryStatus || "") === "OUT_OF_STOCK") {
    throw graphQLError("Món đã hết hàng.", "OUT_OF_STOCK");
  }
  if (menuItem.menuId && mongoose.isValidObjectId(menuItem.menuId)) {
    const activeMenu = await Menu.exists({
      _id: menuItem.menuId,
      restaurantId,
      isActive: true,
    });
    if (!activeMenu) {
      throw graphQLError("Món ăn không thuộc menu đang hoạt động.");
    }

    if (serviceAt) {
      const menu = await Menu.findOne({
        _id: menuItem.menuId,
        restaurantId,
        isActive: true,
      })
        .select({ timeSlot: 1 })
        .lean();
      const expectedTimeSlot = resolveMenuTimeSlotAt(
        serviceAt,
        restaurant?.timezone,
      );
      if (!menu || !expectedTimeSlot || menu.timeSlot !== expectedTimeSlot) {
        throw graphQLError(
          "Món này không phục vụ trong khung giờ đặt bàn.",
          "MENU_TIME_SLOT_MISMATCH",
        );
      }
    }
  }
  return menuItem;
}

async function loadServingVariant({ restaurantId, menuItemId, servingKey }) {
  const recipe = await Recipe.findOne({
    restaurantId,
    menuItemId,
    isActive: true,
    deletedAt: null,
  })
    .select({ servingVariants: 1 })
    .lean();
  if (!recipe) throw graphQLError("Món chưa có công thức đang hoạt động.");

  const variants = Array.isArray(recipe.servingVariants)
    ? recipe.servingVariants
    : [];
  const variant = variants.find(
    (candidate) => String(candidate?.key || "") === String(servingKey),
  );
  if (!variant) throw graphQLError("Biến thể phục vụ không hợp lệ.");
  return variant;
}

export const CustomerCartMutation = {
  addCartItem: async (_, { input }, ctx) => {
    const {
      userId,
      restaurantId,
      menuItemId,
      quantity = 1,
      note,
      servingVariantKey,
      selectedModifiers = [],
      serviceAt,
    } = input;

    const uid = resolveSelfUserId(userId, ctx);
    if (!mongoose.isValidObjectId(restaurantId)) {
      throw graphQLError("Invalid restaurantId");
    }
    if (!mongoose.isValidObjectId(menuItemId)) {
      throw graphQLError("Invalid menuItemId");
    }
    const parsedQuantity = Number(quantity || 1);
    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1) {
      throw graphQLError("quantity must be a positive integer");
    }

    const serviceDate = normalizeServiceAt(serviceAt);
    const { restaurant, availability } = await getPublicRestaurantOrThrow(
      restaurantId,
      undefined,
      serviceDate ? { now: serviceDate } : undefined,
    );
    assertRestaurantCanOrder(availability);
    const servingKey = getServingKey(servingVariantKey);
    const [menuItem, variant, warehouseId] = await Promise.all([
      loadSellableMenuItem({
        restaurantId,
        menuItemId,
        serviceAt: serviceDate,
        restaurant,
      }),
      loadServingVariant({ restaurantId, menuItemId, servingKey }),
      resolveWarehouseId(restaurantId),
    ]);
    const basePrice = Number(variant.price ?? menuItem.basePrice ?? 0);
    if (!Number.isFinite(basePrice) || basePrice < 0) {
      throw graphQLError("Giá món không hợp lệ.");
    }

    const modifierSelection = await resolveCustomerModifierSelection({
      restaurantId,
      menuItemId,
      selectedModifiers,
      basePrice,
    });

    const session = await mongoose.startSession();
    let after = null;
    let eventPayload = null;
    try {
      await session.withTransaction(async () => {
        let cart = await Cart.findOne({
          userId: uid,
          status: "active",
        }).session(session);
        if (!cart) {
          [cart] = await Cart.create(
            [{ userId: uid, items: [], status: "active" }],
            { session },
          );
        }
        assertNotBlocked(cart);

        const before = cart.toObject({ virtuals: true });
        const existing = cart.items.find((item) =>
          sameCartIdentity(item, {
            restaurantId,
            menuItemId,
            servingKey,
            note,
            modifierSelectionKey: modifierSelection.selectionKey,
            serviceAt: serviceDate,
          }),
        );
        const reservedItemId = existing?._id || createCartItemId();

        try {
          await reserveForOrderTx({
            restaurantId,
            warehouseId,
            orderCode: holdOrderCode(cart._id, reservedItemId),
            lines: [
              {
                menuItemId,
                quantity: parsedQuantity,
                servingKey,
                modifiers: modifierSelection.modifiers,
              },
            ],
            session,
          });
        } catch (error) {
          if (!isInsufficientStockError(error)) throw error;
          await publishOutOfStock(ctx, {
            restaurantId,
            menuItemId,
            servingKey,
            source: "cart_add",
          });
          throw graphQLError(
            "Món đã hết hàng hoặc không đủ tồn kho để giữ chỗ.",
            "OUT_OF_STOCK",
          );
        }

        const now = new Date();
        const holdExpiresAt = new Date(now.getTime() + HOLD_TTL_MS);
        if (existing) {
          existing.quantity = Number(existing.quantity || 0) + parsedQuantity;
          existing.holdExpiresAt = holdExpiresAt;
          existing.holdStatus = "active";
          existing.servingKey = servingKey;
          existing.name = menuItem.name;
          existing.price = basePrice;
          existing.thumbImage = menuItem.thumbImage || null;
          existing.modifiers = modifierSelection.modifiers;
          existing.modifiersPrice = modifierSelection.modifiersPrice;
          existing.modifierSelectionKey = modifierSelection.selectionKey;
          existing.serviceAt = serviceDate;
        } else {
          cart.items.push({
            _id: reservedItemId,
            itemType: "MENU_ITEM",
            menuItemId,
            restaurantId,
            name: menuItem.name,
            price: basePrice,
            modifiersPrice: modifierSelection.modifiersPrice,
            modifierSelectionKey: modifierSelection.selectionKey,
            modifiers: modifierSelection.modifiers,
            quantity: parsedQuantity,
            thumbImage: menuItem.thumbImage || null,
            note: normalizeNote(note) || null,
            servingKey,
            servingName: variant.name || servingKey,
            serviceAt: serviceDate,
            holdExpiresAt,
            holdStatus: "active",
          });
        }

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
          meta: {
            menuItemId,
            quantity: parsedQuantity,
            price: basePrice,
            modifiersPrice: modifierSelection.modifiersPrice,
            modifierSelectionKey: modifierSelection.selectionKey,
            servingVariantKey: servingKey,
          },
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
      rethrowTransactionError(error);
    } finally {
      await session.endSession();
    }

    emitInventoryEvent(ctx, eventPayload);
    return after;
  },

  updateCartItem: async (_, { input }, ctx) => {
    const { cartId, itemId, quantity } = input;
    requireAuthUser(ctx);
    if (!mongoose.isValidObjectId(cartId)) {
      throw graphQLError("Invalid cartId");
    }
    if (!mongoose.isValidObjectId(itemId)) {
      throw graphQLError("Invalid itemId");
    }
    const nextQuantity = Number(quantity);
    if (!Number.isInteger(nextQuantity) || nextQuantity < 1) {
      throw graphQLError("quantity must be a positive integer");
    }

    const session = await mongoose.startSession();
    let after = null;
    let eventPayload = null;
    try {
      await session.withTransaction(async () => {
        const cart = await Cart.findOne({
          _id: cartId,
          status: "active",
        }).session(session);
        if (!cart) throw graphQLError("Cart not found or not active");
        assertCartOwner(cart, ctx);

        const item = cart.items.id(itemId);
        if (!item) throw graphQLError("Cart item not found");
        const oldQuantity = Number(item.quantity || 0);
        const delta = nextQuantity - oldQuantity;
        const now = new Date();

        if (!isComboItem(item) && delta !== 0) {
          const warehouseId = await resolveWarehouseId(
            item.restaurantId,
            session,
          );
          const inventoryLine = buildInventoryLine(item, Math.abs(delta));
          if (delta > 0) {
            const serviceDate = normalizeServiceAt(item.serviceAt);
            const { availability } = await getPublicRestaurantOrThrow(
              item.restaurantId,
              undefined,
              serviceDate ? { now: serviceDate } : undefined,
            );
            assertRestaurantCanOrder(availability);
            try {
              await reserveForOrderTx({
                restaurantId: item.restaurantId,
                warehouseId,
                orderCode: holdOrderCode(cart._id, item._id),
                lines: [inventoryLine],
                session,
              });
            } catch (error) {
              if (!isInsufficientStockError(error)) throw error;
              await publishOutOfStock(ctx, {
                restaurantId: item.restaurantId,
                menuItemId: item.menuItemId,
                servingKey: inventoryLine.servingKey,
                source: "cart_update",
              });
              throw graphQLError(
                "Món đã hết hàng hoặc không đủ tồn kho để tăng số lượng.",
                "OUT_OF_STOCK",
              );
            }
          } else {
            await cancelReservationForOrderTx({
              restaurantId: item.restaurantId,
              warehouseId,
              orderCode: holdOrderCode(cart._id, item._id),
              lines: [inventoryLine],
              session,
            });
          }
        }

        item.quantity = nextQuantity;
        if (!isComboItem(item)) {
          item.holdExpiresAt = new Date(now.getTime() + HOLD_TTL_MS);
          item.holdStatus = "active";
        }
        applyCartDerivedFields(cart, { now });
        await cart.save({ session });
        after = cart.toObject({ virtuals: true });

        if (!isComboItem(item) && delta !== 0) {
          eventPayload = {
            type: delta > 0 ? "INVENTORY_HELD" : "INVENTORY_RELEASED",
            restaurantId: String(item.restaurantId),
            menuItemId: String(item.menuItemId),
            servingVariantKey: getServingKey(item.servingKey),
            quantityDelta: delta,
            reason: delta < 0 ? "update_quantity" : undefined,
            holdExpiresAt:
              delta > 0 ? item.holdExpiresAt?.toISOString?.() : undefined,
          };
        }
      });
    } catch (error) {
      rethrowTransactionError(error);
    } finally {
      await session.endSession();
    }

    emitInventoryEvent(ctx, eventPayload);
    if (eventPayload?.type === "INVENTORY_RELEASED") {
      await notifyWatchers(ctx, eventPayload);
    }
    return after;
  },

  removeCartItem: async (_, { input }, ctx) => {
    const { cartId, itemId } = input;
    if (!mongoose.isValidObjectId(cartId)) {
      throw graphQLError("Invalid cartId");
    }
    if (!mongoose.isValidObjectId(itemId)) {
      throw graphQLError("Invalid itemId");
    }

    const session = await mongoose.startSession();
    let after = null;
    let eventPayload = null;
    try {
      await session.withTransaction(async () => {
        const cart = await Cart.findOne({
          _id: cartId,
          status: "active",
        }).session(session);
        if (!cart) throw graphQLError("Cart not found or not active");
        assertCartOwner(cart, ctx);

        const item = cart.items.id(itemId);
        if (!item) throw graphQLError("Cart item not found");
        if (!isComboItem(item)) {
          const warehouseId = await resolveWarehouseId(
            item.restaurantId,
            session,
          );
          await cancelReservationForOrderTx({
            restaurantId: item.restaurantId,
            warehouseId,
            orderCode: holdOrderCode(cart._id, item._id),
            lines: [buildInventoryLine(item)],
            session,
          });
          eventPayload = buildReleaseEvent(item, "remove_item", cart._id);
        }

        cart.items.pull({ _id: itemId });
        applyCartDerivedFields(cart, { now: new Date() });
        await cart.save({ session });
        after = cart.toObject({ virtuals: true });
      });
    } catch (error) {
      rethrowTransactionError(error);
    } finally {
      await session.endSession();
    }

    emitInventoryEvent(ctx, eventPayload);
    await notifyWatchers(ctx, eventPayload);
    return after;
  },

  clearCart: async (_, { input }, ctx) => {
    const { cartId } = input;
    if (!mongoose.isValidObjectId(cartId)) {
      throw graphQLError("Invalid cartId");
    }
    requireAuthUser(ctx);

    const session = await mongoose.startSession();
    let releaseEvents = [];
    try {
      await session.withTransaction(async () => {
        const cart = await Cart.findOne({
          _id: cartId,
          status: "active",
        }).session(session);
        if (!cart) return;
        assertCartOwner(cart, ctx);

        const items = [...(cart.items || [])];
        await releaseItems({ cart, items, session });
        cart.items = [];
        applyCartDerivedFields(cart, { now: new Date() });
        await cart.save({ session });
        releaseEvents = items
          .map((item) => buildReleaseEvent(item, "clear_cart", cart._id))
          .filter(Boolean);
      });
    } catch (error) {
      rethrowTransactionError(error);
    } finally {
      await session.endSession();
    }

    for (const event of releaseEvents) {
      emitInventoryEvent(ctx, event);
      await notifyWatchers(ctx, event);
    }
    return true;
  },

  releaseMyCartHolds: async (_, { input = {} }, ctx) => {
    const userId = resolveSelfUserId(input.userId, ctx);
    const reason = String(input.reason || "exit").trim().toLowerCase() || "exit";
    const session = await mongoose.startSession();
    let releaseEvents = [];

    try {
      await session.withTransaction(async () => {
        const cart = await Cart.findOne({
          userId,
          status: "active",
        }).session(session);
        if (!cart) return;

        const now = new Date();
        const activeItems = [...(cart.items || [])].filter(
          (item) =>
            !isComboItem(item) &&
            (!item.holdStatus || item.holdStatus === "active"),
        );
        const items =
          reason === "timeout"
            ? activeItems.filter((item) => {
                if (!item.holdExpiresAt) return false;
                const expiresAt = new Date(item.holdExpiresAt);
                return (
                  !Number.isNaN(expiresAt.getTime()) && expiresAt <= now
                );
              })
            : activeItems;
        if (!items.length) return;

        await releaseItems({ cart, items, session });
        applyAbusePenalty(cart, reason, now);
        const releasedIds = new Set(items.map((item) => String(item._id)));
        cart.items = cart.items.filter(
          (item) => !releasedIds.has(String(item._id)),
        );
        applyCartDerivedFields(cart, { now });
        await cart.save({ session });
        releaseEvents = items
          .map((item) => buildReleaseEvent(item, reason, cart._id))
          .filter(Boolean);
      });
    } catch (error) {
      rethrowTransactionError(error);
    } finally {
      await session.endSession();
    }

    for (const event of releaseEvents) {
      emitInventoryEvent(ctx, event);
      await notifyWatchers(ctx, event);
    }
    return true;
  },
};
