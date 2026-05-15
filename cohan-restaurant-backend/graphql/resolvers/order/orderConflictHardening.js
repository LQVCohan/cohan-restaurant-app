import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Cart, Order, Warehouse } from "../../../models/index.js";
import {
  ORDER_KIND,
  SESSION_STATUS,
  KITCHEN_STATUS,
  ORDER_PAYMENT_STATUS,
  ACTIVE_SESSION_STATUSES,
  INACTIVE_ORDER_STATUSES,
  activeTableSessionLookupFilter,
  orderBatchOrLegacyFilter,
} from "../../../utils/orderLifecycle.js";
import {
  cancelReservationForOrderTx,
  reserveForOrderTx,
} from "../../../src/services/inventory.service.js";
import { publishMenuItemOutOfStock } from "../../../src/services/menuAvailabilityWatch.service.js";
import { markTableStatus } from "./helper/tableUtils.js";

function toId(value) {
  if (!value || !mongoose.isValidObjectId(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

function normalizeServingKey(value) {
  const key = String(value || "").trim();
  return key || "portion";
}

function normalizeTableCode(value) {
  const code = String(value || "").trim().toUpperCase();
  return code || null;
}

function getMenuItemId(item = {}) {
  return item.menuItemId || item.dishId || item.menuId || item.dish?._id || null;
}

function getRestaurantIdFromItem(item = {}, fallbackRestaurantId = null) {
  return item.restaurantId || fallbackRestaurantId || null;
}

function getItemQuantity(item = {}) {
  return Math.max(1, Number(item.quantity || 1));
}

function isInventoryConflictError(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    error?.extensions?.code === "OUT_OF_STOCK" ||
    message.includes("insufficient available stock") ||
    message.includes("insufficient reserved") ||
    message.includes("insufficient reserved/onhand") ||
    message.includes("insufficient onhand") ||
    message.includes("not enough reserved") ||
    message.includes("không đủ tồn kho") ||
    message.includes("hết hàng") ||
    message.includes("out of stock")
  );
}

function toOutOfStockError(error) {
  if (error?.extensions?.code === "OUT_OF_STOCK") return error;
  return new GraphQLError(
    "Món đã hết hàng hoặc không đủ tồn kho để giữ chỗ. Vui lòng chọn món khác hoặc đăng ký nhắc khi món có lại.",
    {
      extensions: {
        code: "OUT_OF_STOCK",
        originalMessage: error?.message || null,
      },
    },
  );
}

function collectItemsFromArgs(args = {}) {
  const input = args?.input || {};
  if (Array.isArray(input.items)) return input.items;
  return [];
}

async function publishOutOfStockForItems({ ctx, restaurantId, items, source }) {
  const seen = new Set();
  for (const item of items || []) {
    const rid = getRestaurantIdFromItem(item, restaurantId);
    const menuItemId = getMenuItemId(item);
    if (!rid || !menuItemId) continue;
    const servingKey = normalizeServingKey(item.servingKey || item.servingVariantKey);
    const key = `${rid}:${menuItemId}:${servingKey}`;
    if (seen.has(key)) continue;
    seen.add(key);

    try {
      await publishMenuItemOutOfStock({
        io: ctx?.io,
        restaurantId: rid,
        menuItemId,
        servingKey,
        reason: "reserve_failed",
        source,
      });
    } catch (publishError) {
      console.warn(
        "[OrderConflictHardening] Failed to publish out-of-stock event",
        publishError?.message || publishError,
      );
    }
  }
}

async function resolveWarehouseIdOrDefault(restaurantId, warehouseIdInput, session) {
  const rid = toId(restaurantId);
  if (!rid) throw new Error("Invalid restaurantId for warehouse resolution");

  if (warehouseIdInput) {
    const wid = toId(warehouseIdInput);
    if (!wid) throw new Error("Invalid warehouseId");
    return wid;
  }

  let q = Warehouse.findOne({ restaurantId: rid, isActive: true }).sort({
    createdAt: 1,
    _id: 1,
  });
  if (session) q = q.session(session);
  const warehouse = await q.lean();
  if (!warehouse?._id) throw new Error("No warehouse found for this restaurant");
  return warehouse._id;
}

function buildCartHoldOrderCode(cartId, cartItemId) {
  return `CART:${cartId}:${cartItemId}`;
}

function buildCartInventoryLine(cartItem) {
  return {
    menuItemId: cartItem.menuItemId,
    quantity: getItemQuantity(cartItem),
    servingKey: normalizeServingKey(cartItem.servingKey || cartItem.servingVariantKey),
  };
}

function computeCartTotals(items = []) {
  return {
    totalQuantity: (items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    totalAmount: (items || []).reduce(
      (sum, item) => sum + Number(item.quantity || 0) * Number(item.price || 0),
      0,
    ),
  };
}

function stripCartRefsFromCheckoutInput(input = {}) {
  return {
    ...input,
    items: (input.items || []).map((item) => {
      const { cartId, cartItemId, ...rest } = item || {};
      return rest;
    }),
  };
}

function getCheckoutCartRefs(items = []) {
  return (items || [])
    .map((item) => ({ item, cartId: item?.cartId, cartItemId: item?.cartItemId }))
    .filter((entry) => entry.cartId || entry.cartItemId);
}

async function prepareCheckoutCartHolds({ input, ctx }) {
  const refs = getCheckoutCartRefs(input?.items || []);
  if (!refs.length) {
    return { input, released: [] };
  }

  const authUserId = ctx?.user?.id && mongoose.isValidObjectId(ctx.user.id)
    ? String(ctx.user.id)
    : null;
  if (!authUserId) {
    throw new GraphQLError(
      "Món trong giỏ đã hết hạn hoặc không còn khớp với đơn hàng. Vui lòng kiểm tra lại giỏ.",
      { extensions: { code: "CART_HOLD_INVALID" } },
    );
  }

  const released = [];
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const ref of refs) {
        const cartId = toId(ref.cartId);
        const cartItemId = toId(ref.cartItemId);
        if (!cartId || !cartItemId) {
          throw new Error("Món trong giỏ đã hết hạn hoặc không còn khớp với đơn hàng. Vui lòng kiểm tra lại giỏ.");
        }

        const cart = await Cart.findOne({
          _id: cartId,
          userId: toId(authUserId),
          status: "active",
        }).session(session);
        if (!cart) {
          throw new Error("Món trong giỏ đã hết hạn hoặc không còn khớp với đơn hàng. Vui lòng kiểm tra lại giỏ.");
        }

        const cartItem = typeof cart.items?.id === "function"
          ? cart.items.id(cartItemId)
          : (cart.items || []).find((item) => String(item._id) === String(cartItemId));
        if (!cartItem) {
          throw new Error("Món trong giỏ đã hết hạn hoặc không còn khớp với đơn hàng. Vui lòng kiểm tra lại giỏ.");
        }

        const holdStatus = String(cartItem.holdStatus || "active");
        if (holdStatus !== "active") {
          throw new Error("Món trong giỏ đang được xử lý hoặc đã hết hạn. Vui lòng kiểm tra lại giỏ.");
        }
        if (!cartItem.holdExpiresAt || new Date(cartItem.holdExpiresAt) <= new Date()) {
          throw new Error("Món trong giỏ đã hết hạn. Vui lòng kiểm tra lại giỏ.");
        }

        const rawMenuItemId = getMenuItemId(ref.item);
        const rawRestaurantId = getRestaurantIdFromItem(ref.item);
        const rawServingKey = normalizeServingKey(ref.item?.servingKey || ref.item?.servingVariantKey);
        const cartServingKey = normalizeServingKey(cartItem.servingKey || cartItem.servingVariantKey);
        if (
          String(cartItem.restaurantId || "") !== String(rawRestaurantId || "") ||
          String(cartItem.menuItemId || "") !== String(rawMenuItemId || "") ||
          cartServingKey !== rawServingKey ||
          Number(cartItem.quantity || 0) !== Number(ref.item?.quantity || 0)
        ) {
          throw new Error("Món trong giỏ đã thay đổi hoặc không còn khớp với đơn hàng. Vui lòng kiểm tra lại giỏ.");
        }

        const warehouseId = await resolveWarehouseIdOrDefault(
          cartItem.restaurantId,
          input?.warehouseId,
          session,
        );
        const line = buildCartInventoryLine(cartItem);
        await cancelReservationForOrderTx({
          restaurantId: cartItem.restaurantId,
          warehouseId,
          orderCode: buildCartHoldOrderCode(cart._id, cartItem._id),
          lines: [line],
          session,
        });

        cartItem.holdStatus = "checkout_pending";
        cart.lastActivityAt = new Date();
        await cart.save({ session });

        released.push({
          cartId: String(cart._id),
          cartItemId: String(cartItem._id),
          restaurantId: String(cartItem.restaurantId),
          warehouseId: String(warehouseId),
          line,
        });
      }
    });
  } finally {
    await session.endSession();
  }

  return {
    input: stripCartRefsFromCheckoutInput(input),
    released,
  };
}

async function removeReleasedCartItems(released = []) {
  if (!released.length) return;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const byCart = new Map();
      for (const ref of released) {
        if (!byCart.has(ref.cartId)) byCart.set(ref.cartId, []);
        byCart.get(ref.cartId).push(ref.cartItemId);
      }

      for (const [cartId, itemIds] of byCart.entries()) {
        const cart = await Cart.findById(toId(cartId)).session(session);
        if (!cart) continue;
        const idSet = new Set(itemIds.map(String));
        cart.items = (cart.items || []).filter((item) => !idSet.has(String(item._id)));
        const totals = computeCartTotals(cart.items || []);
        cart.totalQuantity = totals.totalQuantity;
        cart.totalAmount = totals.totalAmount;
        cart.lastActivityAt = new Date();
        if (!(cart.items || []).length) cart.status = "checked_out";
        await cart.save({ session });
      }
    });
  } finally {
    await session.endSession();
  }
}

async function restoreReleasedCartHolds(released = []) {
  if (!released.length) return;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const ref of released) {
        const cart = await Cart.findById(toId(ref.cartId)).session(session);
        const cartItem = cart?.items?.id?.(ref.cartItemId) ||
          (cart?.items || []).find((item) => String(item._id) === String(ref.cartItemId));
        if (!cart || !cartItem) continue;

        try {
          await reserveForOrderTx({
            restaurantId: ref.restaurantId,
            warehouseId: ref.warehouseId,
            orderCode: buildCartHoldOrderCode(ref.cartId, ref.cartItemId),
            lines: [ref.line],
            session,
          });
          cartItem.holdStatus = "active";
        } catch (error) {
          cartItem.holdStatus = "expired";
        }
        cart.lastActivityAt = new Date();
        await cart.save({ session });
      }
    });
  } finally {
    await session.endSession();
  }
}

async function findIdempotentOrder({ restaurantId, idempotencyKey, source }) {
  if (!restaurantId || !idempotencyKey) return null;
  const filter = {
    restaurantId: toId(restaurantId),
    "clientMeta.idempotencyKey": String(idempotencyKey),
  };
  if (source) filter["clientMeta.source"] = source;
  return Order.findOne(filter).sort({ createdAt: -1 }).lean({ virtuals: true });
}

async function hasActiveTableWork({ restaurantId, tableCode, excludeOrderId = null }) {
  const filter = {
    restaurantId: toId(restaurantId),
    tableCode: String(tableCode),
    currentStatus: { $nin: INACTIVE_ORDER_STATUSES },
  };
  if (excludeOrderId) filter._id = { $ne: toId(excludeOrderId) };
  const active = await Order.exists(filter);
  return Boolean(active);
}

async function syncLifecycleFields(orderLike) {
  if (!orderLike?._id && !orderLike?.id) return;
  const id = toId(orderLike._id || orderLike.id);
  if (!id) return;

  const currentStatus = String(orderLike.currentStatus || "");
  const paymentStatus = String(orderLike?.payment?.status || "");
  const set = {};

  const kitchenByStatus = {
    draft: KITCHEN_STATUS.DRAFT,
    pending: KITCHEN_STATUS.PENDING,
    confirmed: KITCHEN_STATUS.CONFIRMED,
    customer_attached: KITCHEN_STATUS.CUSTOMER_ATTACHED,
    preparing: KITCHEN_STATUS.PREPARING,
    ready: KITCHEN_STATUS.READY,
    served: KITCHEN_STATUS.SERVED,
    cancelled: KITCHEN_STATUS.CANCELLED,
    failed: KITCHEN_STATUS.FAILED,
  };

  if (kitchenByStatus[currentStatus]) set.kitchenStatus = kitchenByStatus[currentStatus];
  if (paymentStatus === "payment_requested") set.orderPaymentStatus = ORDER_PAYMENT_STATUS.PAYMENT_REQUESTED;
  if (paymentStatus === "paid") set.orderPaymentStatus = ORDER_PAYMENT_STATUS.PAID;
  if (paymentStatus === "refunded") set.orderPaymentStatus = ORDER_PAYMENT_STATUS.REFUNDED;
  if (currentStatus === "cancelled") set.sessionStatus = SESSION_STATUS.CANCELLED;
  if (currentStatus === "completed" && paymentStatus === "paid") set.sessionStatus = SESSION_STATUS.CLOSED;

  if (Object.keys(set).length) {
    await Order.updateOne({ _id: id }, { $set: set });
  }
}

async function normalizeStockConflict({ error, ctx, args, source }) {
  if (!isInventoryConflictError(error)) throw error;
  await publishOutOfStockForItems({
    ctx,
    restaurantId: args?.input?.restaurantId,
    items: collectItemsFromArgs(args),
    source,
  });
  throw toOutOfStockError(error);
}

export function withOrderConflictHardening(mutation = {}) {
  return {
    ...mutation,

    async createOrderForTable(parent, args, ctx, info) {
      const input = args?.input || {};
      const idempotencyKey = input?.clientMeta?.idempotencyKey;
      const existing = await findIdempotentOrder({
        restaurantId: input.restaurantId,
        idempotencyKey,
        source: input?.clientMeta?.source,
      });
      if (existing) return { isNewOrder: false, order: existing };

      try {
        return await mutation.createOrderForTable.call(mutation, parent, args, ctx, info);
      } catch (error) {
        await normalizeStockConflict({ error, ctx, args, source: "dine_in_order" });
      }
    },

    async createOffPremiseOrder(parent, args, ctx, info) {
      const input = args?.input || {};
      const idempotencyKey = input?.clientMeta?.idempotencyKey || input?.idempotencyKey;
      const existing = await findIdempotentOrder({
        restaurantId: input.restaurantId,
        idempotencyKey,
        source: input?.clientMeta?.source,
      });
      if (existing) return { order: existing, idempotentHit: true };

      try {
        return await mutation.createOffPremiseOrder.call(mutation, parent, args, ctx, info);
      } catch (error) {
        await normalizeStockConflict({ error, ctx, args, source: "off_premise_order" });
      }
    },

    async createCheckoutOrders(parent, args, ctx, info) {
      let prepared = null;
      try {
        prepared = await prepareCheckoutCartHolds({ input: args?.input || {}, ctx });
        const result = await mutation.createCheckoutOrders.call(
          mutation,
          parent,
          { ...args, input: prepared.input },
          ctx,
          info,
        );
        await removeReleasedCartItems(prepared.released);
        return result;
      } catch (error) {
        if (prepared?.released?.length) {
          await restoreReleasedCartHolds(prepared.released).catch((restoreError) => {
            console.warn(
              "[OrderConflictHardening] Failed to restore cart holds after checkout failure",
              restoreError?.message || restoreError,
            );
          });
        }
        await normalizeStockConflict({ error, ctx, args, source: "checkout_order" });
      }
    },

    async adjustOrderItemQuantity(parent, args, ctx, info) {
      try {
        return await mutation.adjustOrderItemQuantity.call(mutation, parent, args, ctx, info);
      } catch (error) {
        await normalizeStockConflict({ error, ctx, args, source: "adjust_order_item_quantity" });
      }
    },

    async updateOrderItemStatus(parent, args, ctx, info) {
      try {
        return await mutation.updateOrderItemStatus.call(mutation, parent, args, ctx, info);
      } catch (error) {
        await normalizeStockConflict({ error, ctx, args, source: "update_order_item_status" });
      }
    },

    async updateOrderStatus(parent, args, ctx, info) {
      const result = await mutation.updateOrderStatus.call(mutation, parent, args, ctx, info);
      await syncLifecycleFields(result).catch((error) => {
        console.warn("[OrderConflictHardening] Failed to sync lifecycle fields", error?.message || error);
      });
      return result;
    },

    async requestPaymentForTable(parent, args, ctx, info) {
      const { restaurantId, tableCode, tableId } = args?.input || {};
      const rid = toId(restaurantId);
      if (!rid) throw new Error("restaurantId is required");
      const normalizedTableCode = normalizeTableCode(tableCode);

      const activeParent = await Order.findOne(
        activeTableSessionLookupFilter({
          restaurantId: rid,
          tableId: toId(tableId),
          tableCode: normalizedTableCode,
        }),
      )
        .sort({ openedAt: -1, createdAt: -1, _id: -1 })
        .lean();

      let orders = [];
      if (activeParent?._id) {
        orders = await Order.find({
          restaurantId: rid,
          parentOrderId: activeParent._id,
          orderKind: ORDER_KIND.ORDER_BATCH,
          currentStatus: { $nin: INACTIVE_ORDER_STATUSES },
        }).lean();
      } else {
        orders = await Order.find({
          $and: [
            {
              restaurantId: rid,
              tableCode: normalizedTableCode,
              currentStatus: { $nin: INACTIVE_ORDER_STATUSES },
            },
            orderBatchOrLegacyFilter(),
          ],
        }).lean();
      }

      if (!orders.length) {
        throw new Error("Không tìm thấy đơn đang phục vụ của bàn này.");
      }

      return mutation.requestPaymentForOrder.call(
        mutation,
        parent,
        {
          input: {
            restaurantId,
            orderIds: orders.map((order) => String(order._id)),
          },
        },
        ctx,
        info,
      );
    },

    async cancelOrder(parent, args, ctx, info) {
      const result = await mutation.cancelOrder.call(mutation, parent, args, ctx, info);
      const order = result?.order || null;
      if (order?.orderType === "dine_in" && order?.tableCode) {
        const active = await hasActiveTableWork({
          restaurantId: args?.restaurantId || order.restaurantId,
          tableCode: order.tableCode,
          excludeOrderId: order._id || order.id,
        });
        await markTableStatus(
          args?.restaurantId || order.restaurantId,
          order.tableCode,
          active ? "occupied" : "available",
        );
      }
      return result;
    },
  };
}

export default withOrderConflictHardening;
