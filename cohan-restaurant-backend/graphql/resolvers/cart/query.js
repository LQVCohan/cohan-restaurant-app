import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Cart, Warehouse } from "../../../models/index.js";
import { checkAvailabilityForLinesTx } from "../../../src/services/inventory.service.js";

const POLICY_MESSAGE =
  "Chính sách giữ chỗ tồn kho: mỗi lần thêm món sẽ giữ chỗ tối đa 5 phút. Hủy/thoát quá nhiều lần có thể bị cảnh báo hoặc tạm chặn.";

async function resolveWarehouseIdOrDefault(restaurantId) {
  const wh = await Warehouse.findOne({ restaurantId, isActive: true })
    .sort({ createdAt: 1, _id: 1 })
    .lean();
  if (!wh?._id) throw new GraphQLError("No warehouse found for this restaurant");
  return wh._id;
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
    const { restaurantId, menuItemId, servingVariantKey, userId } = input || {};
    if (!mongoose.isValidObjectId(restaurantId)) throw new GraphQLError("Invalid restaurantId");
    if (!mongoose.isValidObjectId(menuItemId)) throw new GraphQLError("Invalid menuItemId");

    let uid = null;
    if (userId) uid = resolveSelfUserId(userId, ctx);
    else if (ctx?.user?.id && mongoose.isValidObjectId(ctx.user.id)) uid = ctx.user.id;

    let abuse = null;
    if (uid) {
      const cart = await Cart.findOne({ userId: uid, status: "active" })
        .select({ abuse: 1 })
        .lean();
      abuse = cart?.abuse || null;
    }

    const warehouseId = await resolveWarehouseIdOrDefault(restaurantId);
    const availability = await checkAvailabilityForLinesTx({
      restaurantId,
      warehouseId,
      lines: [{ menuItemId, quantity: 1, servingKey: servingVariantKey || "portion" }],
    });

    const key = `${restaurantId}:${menuItemId}`;
    const viewerCount = Number(ctx?.menuPresenceStore?.get?.(key) || 0);

    const blockedUntil = abuse?.blockedUntil ? new Date(abuse.blockedUntil) : null;
    const blocked = !!(blockedUntil && blockedUntil > new Date());

    const violationCount = Number(abuse?.timeoutReleaseCount || 0) + Number(abuse?.exitReleaseCount || 0);

    return {
      menuItemId,
      restaurantId,
      servingVariantKey: servingVariantKey || "portion",
      viewerCount,
      maxAvailableQty: Math.max(0, Number(availability?.maxAvailable || 0)),
      outOfStock: !availability?.isAvailable,
      blocked,
      blockedUntil,
      abuseWarning:
        violationCount >= 3
          ? `Bạn đã trả giữ chỗ ${violationCount} lần. Nếu tiếp tục có thể bị chặn tạm thời.`
          : null,
      policyMessage: POLICY_MESSAGE,
    };
  },
};
