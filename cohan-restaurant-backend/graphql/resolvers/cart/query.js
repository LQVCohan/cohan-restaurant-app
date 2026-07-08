import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Cart, Warehouse } from "../../../models/index.js";
import { checkAvailabilityForLinesTx } from "../../../src/services/inventory.service.js";

const POLICY_MESSAGE =
  "Chính sách giữ chỗ tồn kho: mỗi lần thêm món sẽ giữ chỗ tối đa 5 phút. Hủy/thoát quá nhiều lần có thể bị cảnh báo hoặc tạm chặn.";
const HOLD_TTL_SECONDS = 5 * 60;

const inFlightAvailabilityReads = new Map();
const inFlightReservedHoldReads = new Map();

function singleFlight(store, key, load) {
  const existing = store.get(key);
  if (existing) return existing;

  const pending = Promise.resolve().then(load);
  store.set(key, pending);

  const cleanup = () => {
    if (store.get(key) === pending) store.delete(key);
  };
  pending.then(cleanup, cleanup);
  return pending;
}

async function resolveWarehouseIdOrDefault(restaurantId) {
  const wh = await Warehouse.findOne({ restaurantId, isActive: true })
    .sort({ createdAt: 1, _id: 1 })
    .lean();
  if (!wh?._id) throw new GraphQLError("No warehouse found for this restaurant");
  return wh._id;
}

function getServingKey(value) {
  const key = String(value || "").trim();
  return key || "portion";
}

function getActiveHoldExpiry(item, now) {
  const holdExpiresAt = item?.holdExpiresAt ? new Date(item.holdExpiresAt) : null;
  if (!holdExpiresAt || Number.isNaN(holdExpiresAt.getTime()) || holdExpiresAt <= now) return null;
  if (item?.holdStatus && item.holdStatus !== "active") return null;
  return holdExpiresAt;
}

function getMatchingHoldExpiry(item, { restaurantId, menuItemId, servingKey, now }) {
  if (String(item?.restaurantId) !== String(restaurantId)) return null;
  if (String(item?.menuItemId) !== String(menuItemId)) return null;
  if (getServingKey(item?.servingKey || item?.servingVariantKey) !== servingKey) return null;
  return getActiveHoldExpiry(item, now);
}

function liveStateKey({ restaurantId, menuItemId, servingKey }) {
  return `${restaurantId}:${menuItemId}:${servingKey}`;
}

function readAvailability({ restaurantId, menuItemId, servingKey }) {
  const key = liveStateKey({ restaurantId, menuItemId, servingKey });
  return singleFlight(inFlightAvailabilityReads, key, async () => {
    const warehouseId = await resolveWarehouseIdOrDefault(restaurantId);
    return checkAvailabilityForLinesTx({
      restaurantId,
      warehouseId,
      lines: [{ menuItemId, quantity: 1, servingKey }],
    });
  });
}

function readReservedCartQty({ restaurantId, menuItemId, servingKey, now }) {
  const key = liveStateKey({ restaurantId, menuItemId, servingKey });
  return singleFlight(inFlightReservedHoldReads, key, async () => {
    const reservedCarts = await Cart.find({
      status: "active",
      items: {
        $elemMatch: {
          restaurantId,
          menuItemId,
          holdExpiresAt: { $gt: now },
          $or: [{ holdStatus: "active" }, { holdStatus: { $exists: false } }],
        },
      },
    })
      .select({ items: 1 })
      .lean();

    let reservedCartQty = 0;
    for (const cart of reservedCarts) {
      const items = Array.isArray(cart?.items) ? cart.items : [];
      for (const item of items) {
        const holdExpiry = getMatchingHoldExpiry(item, {
          restaurantId,
          menuItemId,
          servingKey,
          now,
        });
        if (!holdExpiry) continue;
        reservedCartQty += Number(item?.quantity) || 0;
      }
    }
    return reservedCartQty;
  });
}

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

export const CartQuery = {
  async myCart(_, { userId }, ctx) {
    const uid = resolveSelfUserId(userId, ctx);

    const cart = await Cart.findOne({ userId: uid, status: "active" }).lean({ virtuals: true });
    return cart;
  },

  async menuItemLiveState(_, { input }, ctx) {
    const {
      restaurantId,
      menuItemId,
      servingVariantKey,
      userId,
      itemType = "MENU_ITEM",
    } = input || {};
    if (String(itemType).toUpperCase() !== "MENU_ITEM") {
      throw new GraphQLError("Unsupported itemType");
    }
    if (!mongoose.isValidObjectId(restaurantId)) throw new GraphQLError("Invalid restaurantId");
    if (!mongoose.isValidObjectId(menuItemId)) throw new GraphQLError("Invalid menuItemId");

    const normalizedServingKey = getServingKey(servingVariantKey);
    const now = new Date();

    let uid = null;
    if (userId) uid = resolveSelfUserId(userId, ctx);
    else if (ctx?.user?.id && mongoose.isValidObjectId(ctx.user.id)) uid = ctx.user.id;

    const cartPromise = uid
      ? Cart.findOne({ userId: uid, status: "active" })
          .select({ abuse: 1, items: 1 })
          .lean()
      : Promise.resolve(null);

    const [cart, reservedCartQty, availability] = await Promise.all([
      cartPromise,
      readReservedCartQty({
        restaurantId,
        menuItemId,
        servingKey: normalizedServingKey,
        now,
      }),
      readAvailability({
        restaurantId,
        menuItemId,
        servingKey: normalizedServingKey,
      }),
    ]);

    const abuse = cart?.abuse || null;
    const cartItems = Array.isArray(cart?.items) ? cart.items : [];
    let myCartQty = 0;
    let myHoldExpiresAt = null;
    for (const item of cartItems) {
      const holdExpiry = getMatchingHoldExpiry(item, {
        restaurantId,
        menuItemId,
        servingKey: normalizedServingKey,
        now,
      });
      if (!holdExpiry) continue;

      myCartQty += Number(item?.quantity) || 0;
      if (!myHoldExpiresAt || holdExpiry < myHoldExpiresAt) myHoldExpiresAt = holdExpiry;
    }

    const key = `${restaurantId}:${menuItemId}`;
    const viewerCount = Number(ctx?.menuPresenceStore?.get?.(key) || 0);

    const blockedUntil = abuse?.blockedUntil ? new Date(abuse.blockedUntil) : null;
    const blocked = !!(blockedUntil && blockedUntil > now);

    const violationCount = Number(abuse?.timeoutReleaseCount || 0) + Number(abuse?.exitReleaseCount || 0);

    return {
      itemType: "MENU_ITEM",
      menuItemId,
      restaurantId,
      servingVariantKey: normalizedServingKey,
      viewerCount,
      maxAvailableQty: Math.max(0, Number(availability?.maxAvailable || 0)),
      outOfStock: !availability?.isAvailable,
      blocked,
      blockedUntil,
      abuseWarning: blocked
        ? "B\u1ea1n \u0111ang b\u1ecb t\u1ea1m ch\u1eb7n gi\u1eef m\u00f3n do nhi\u1ec1u l\u1ea7n gi\u1eef m\u00f3n r\u1ed3i kh\u00f4ng x\u00e1c nh\u1eadn."
        : violationCount >= 3
          ? `Bạn đã trả giữ chỗ ${violationCount} lần. Nếu tiếp tục có thể bị chặn tạm thời.`
          : null,
      policyMessage: POLICY_MESSAGE,
      holdTtlSeconds: HOLD_TTL_SECONDS,
      myCartQty,
      myHoldExpiresAt,
      reservedCartQty,
    };
  },
};
