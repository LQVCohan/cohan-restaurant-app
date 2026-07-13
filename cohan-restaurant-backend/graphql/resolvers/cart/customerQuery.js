import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Cart } from "../../../models/index.js";
import { resolveCustomerModifierSelection } from "../../../src/services/customerModifierSelection.service.js";
import { getMenuItemVariantAvailability } from "../../../src/services/menuItemAvailability.service.js";

const POLICY_MESSAGE =
  "Chính sách giữ chỗ tồn kho: mỗi lần thêm món sẽ giữ chỗ tối đa 5 phút. Hủy/thoát quá nhiều lần có thể bị cảnh báo hoặc tạm chặn.";
const HOLD_TTL_SECONDS = 5 * 60;

const inFlightAvailabilityReads = new Map();
const inFlightReservedHoldReads = new Map();

const singleFlight = (store, key, load) => {
  const existing = store.get(key);
  if (existing) return existing;

  const pending = Promise.resolve().then(load);
  store.set(key, pending);

  const cleanup = () => {
    if (store.get(key) === pending) store.delete(key);
  };
  pending.then(cleanup, cleanup);
  return pending;
};

const getServingKey = (value) =>
  String(value || "portion").trim() || "portion";

const getSelectionKey = (value) => String(value || "");

const availabilityReadKey = ({ restaurantId, menuItemId, servingKey }) =>
  `${restaurantId}:${menuItemId}:${servingKey}`;

const reservedHoldReadKey = ({
  restaurantId,
  menuItemId,
  servingKey,
  modifierSelectionKey,
}) =>
  `${availabilityReadKey({ restaurantId, menuItemId, servingKey })}:${getSelectionKey(
    modifierSelectionKey,
  )}`;

const readAvailability = ({ restaurantId, menuItemId, servingKey }) => {
  const key = availabilityReadKey({ restaurantId, menuItemId, servingKey });
  return singleFlight(inFlightAvailabilityReads, key, () =>
    getMenuItemVariantAvailability({
      restaurantId,
      menuItemId,
      servingKey,
    }),
  );
};

const requireSelfUserId = (inputUserId, ctx) => {
  const authUserId = ctx?.user?.id;
  if (!authUserId || !mongoose.isValidObjectId(authUserId)) {
    throw new GraphQLError("Unauthorized", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  }
  if (inputUserId && String(inputUserId) !== String(authUserId)) {
    throw new GraphQLError("Forbidden", {
      extensions: { code: "FORBIDDEN" },
    });
  }
  return authUserId;
};

const getActiveHoldExpiry = (item, now) => {
  if (item?.holdStatus && item.holdStatus !== "active") return null;
  const expiresAt = item?.holdExpiresAt ? new Date(item.holdExpiresAt) : null;
  if (!expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt <= now) {
    return null;
  }
  return expiresAt;
};

const matchesSelection = (
  item,
  { restaurantId, menuItemId, servingKey, modifierSelectionKey },
) =>
  String(item?.restaurantId) === String(restaurantId) &&
  String(item?.menuItemId) === String(menuItemId) &&
  getServingKey(item?.servingKey || item?.servingVariantKey) === servingKey &&
  getSelectionKey(item?.modifierSelectionKey) ===
    getSelectionKey(modifierSelectionKey);

const readReservedCartQty = ({
  restaurantId,
  menuItemId,
  servingKey,
  modifierSelectionKey,
  now,
}) => {
  const key = reservedHoldReadKey({
    restaurantId,
    menuItemId,
    servingKey,
    modifierSelectionKey,
  });

  return singleFlight(inFlightReservedHoldReads, key, async () => {
    const carts = await Cart.find({
      status: "active",
      items: {
        $elemMatch: {
          restaurantId,
          menuItemId,
          holdExpiresAt: { $gt: now },
          $or: [
            { holdStatus: "active" },
            { holdStatus: { $exists: false } },
          ],
        },
      },
    })
      .select({ items: 1 })
      .lean();

    let reservedCartQty = 0;
    for (const cart of carts) {
      for (const item of cart?.items || []) {
        if (
          matchesSelection(item, {
            restaurantId,
            menuItemId,
            servingKey,
            modifierSelectionKey,
          }) &&
          getActiveHoldExpiry(item, now)
        ) {
          reservedCartQty += Number(item.quantity || 0);
        }
      }
    }
    return reservedCartQty;
  });
};

export const CustomerCartQuery = {
  menuItemLiveState: async (_, { input }, ctx) => {
    const {
      itemType = "MENU_ITEM",
      restaurantId,
      menuItemId,
      servingVariantKey,
      selectedModifiers = [],
      userId,
    } = input || {};

    if (!mongoose.isValidObjectId(restaurantId)) {
      throw new GraphQLError("Invalid restaurantId");
    }
    if (!mongoose.isValidObjectId(menuItemId)) {
      throw new GraphQLError("Invalid menuItemId");
    }
    const normalizedItemType = String(itemType || "MENU_ITEM").toUpperCase();
    if (normalizedItemType !== "MENU_ITEM") {
      throw new GraphQLError("Unsupported itemType", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    let resolvedUserId = null;
    if (userId) resolvedUserId = requireSelfUserId(userId, ctx);
    else if (ctx?.user?.id && mongoose.isValidObjectId(ctx.user.id)) {
      resolvedUserId = ctx.user.id;
    }

    const servingKey = getServingKey(servingVariantKey);
    const now = new Date();

    const availabilityPromise = readAvailability({
      restaurantId,
      menuItemId,
      servingKey,
    });
    const modifierSelectionPromise = resolveCustomerModifierSelection({
      restaurantId,
      menuItemId,
      selectedModifiers,
      validateRequired: false,
    });
    const myCartPromise = resolvedUserId
      ? Cart.findOne({ userId: resolvedUserId, status: "active" })
          .select({ abuse: 1, items: 1 })
          .lean()
      : Promise.resolve(null);
    const reservedCartQtyPromise = modifierSelectionPromise.then(
      (modifierSelection) =>
        readReservedCartQty({
          restaurantId,
          menuItemId,
          servingKey,
          modifierSelectionKey: modifierSelection.selectionKey,
          now,
        }),
    );

    const [availability, modifierSelection, myCart, reservedCartQty] =
      await Promise.all([
        availabilityPromise,
        modifierSelectionPromise,
        myCartPromise,
        reservedCartQtyPromise,
      ]);

    let myCartQty = 0;
    let myHoldExpiresAt = null;
    for (const item of myCart?.items || []) {
      if (
        !matchesSelection(item, {
          restaurantId,
          menuItemId,
          servingKey,
          modifierSelectionKey: modifierSelection.selectionKey,
        })
      ) {
        continue;
      }
      const expiresAt = getActiveHoldExpiry(item, now);
      if (!expiresAt) continue;
      myCartQty += Number(item.quantity || 0);
      if (!myHoldExpiresAt || expiresAt < myHoldExpiresAt) {
        myHoldExpiresAt = expiresAt;
      }
    }

    const blockedUntil = myCart?.abuse?.blockedUntil
      ? new Date(myCart.abuse.blockedUntil)
      : null;
    const blocked = Boolean(blockedUntil && blockedUntil > now);
    const violationCount =
      Number(myCart?.abuse?.timeoutReleaseCount || 0) +
      Number(myCart?.abuse?.exitReleaseCount || 0);
    const presenceKey = `${restaurantId}:${menuItemId}`;

    return {
      itemType: normalizedItemType,
      menuItemId,
      restaurantId,
      servingVariantKey: servingKey,
      viewerCount: Number(ctx?.menuPresenceStore?.get?.(presenceKey) || 0),
      maxAvailableQty: Math.max(0, Number(availability.maxAvailable || 0)),
      outOfStock: !availability.isAvailable,
      blocked,
      blockedUntil,
      abuseWarning: blocked
        ? "Bạn đang bị tạm chặn giữ món do nhiều lần giữ món rồi không xác nhận."
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
