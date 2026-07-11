import mongoose from "mongoose";
import { GraphQLError } from "graphql";

import { Cart, MenuItem, Warehouse } from "../../../models/index.js";
import { applyCartDerivedFields } from "../../../models/cartDerivedFields.js";
import { reserveForOrderTx } from "../../../src/services/inventory.service.js";
import { getOrderableSupplyCatalogItem } from "../../../src/services/orderableSupplyCatalog.service.js";
import {
  assertRestaurantCanOrder,
  getPublicRestaurantOrThrow,
} from "../shared/restaurantCapabilityGuards.js";

const HOLD_TTL_MS = 5 * 60 * 1000;

const graphQLError = (message, code = "BAD_USER_INPUT") =>
  new GraphQLError(message, { extensions: { code } });

const requireSelf = (ctx, inputUserId) => {
  const authUserId = ctx?.user?.id;
  if (!authUserId || !mongoose.isValidObjectId(authUserId)) {
    throw graphQLError("Unauthorized", "UNAUTHENTICATED");
  }
  if (inputUserId && String(inputUserId) !== String(authUserId)) {
    throw graphQLError("Forbidden", "FORBIDDEN");
  }
  return authUserId;
};

const normalizeServiceAt = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw graphQLError("serviceAt không hợp lệ.");
  }
  return date;
};

const normalizeNote = (value) => String(value || "").trim();
const sameDate = (left, right) =>
  (left ? new Date(left).getTime() : null) ===
  (right ? new Date(right).getTime() : null);

async function resolveWarehouseId(restaurantId, session = null) {
  let query = Warehouse.findOne({ restaurantId, isActive: true })
    .sort({ createdAt: 1, _id: 1 })
    .select({ _id: 1 });
  if (session) query = query.session(session);
  const warehouse = await query.lean();
  if (!warehouse?._id) {
    throw graphQLError("Nhà hàng chưa có kho để giữ tồn supply.");
  }
  return warehouse._id;
}

async function resolveSupplyFromInput(input, session = null) {
  const restaurantId = input?.restaurantId;
  const candidateId = input?.supplyId || input?.menuItemId;
  if (
    !mongoose.isValidObjectId(restaurantId) ||
    !mongoose.isValidObjectId(candidateId)
  ) {
    return null;
  }

  const explicit =
    String(input?.itemType || "").toUpperCase() === "SUPPLY" ||
    Boolean(input?.supplyId);
  if (!explicit) {
    let query = MenuItem.exists({
      _id: candidateId,
      restaurantId,
    });
    if (session) query = query.session(session);
    if (await query) return null;
  }

  return getOrderableSupplyCatalogItem({
    restaurantId,
    supplyId: candidateId,
    includeOutOfStock: true,
    session,
  });
}

const sameSupplyCartIdentity = (item, input) =>
  String(item?.itemType || "").toUpperCase() === "SUPPLY" &&
  String(item?.supplyId || item?.menuItemId || "") === String(input.supplyId) &&
  String(item?.restaurantId || "") === String(input.restaurantId) &&
  normalizeNote(item?.note) === normalizeNote(input.note) &&
  sameDate(item?.serviceAt, input.serviceAt);

async function addSupplyCartItem({ input, ctx, catalogItem }) {
  const userId = requireSelf(ctx, input?.userId);
  const quantity = Number(input?.quantity || 1);
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw graphQLError("quantity must be a positive integer");
  }
  if (catalogItem.status !== "available") {
    throw graphQLError(`${catalogItem.name} đã hết hàng.`, "OUT_OF_STOCK");
  }

  const serviceAt = normalizeServiceAt(input?.serviceAt);
  const { availability } = await getPublicRestaurantOrThrow(
    input.restaurantId,
    undefined,
    serviceAt ? { now: serviceAt } : undefined,
  );
  assertRestaurantCanOrder(availability);

  const session = await mongoose.startSession();
  let result = null;
  try {
    await session.withTransaction(async () => {
      let cart = await Cart.findOne({ userId, status: "active" }).session(session);
      if (!cart) {
        [cart] = await Cart.create(
          [{ userId, items: [], status: "active" }],
          { session },
        );
      }
      if (
        cart?.abuse?.blockedUntil &&
        new Date(cart.abuse.blockedUntil).getTime() > Date.now()
      ) {
        throw graphQLError(
          "Giỏ hàng đang tạm khóa do có quá nhiều lượt giữ chỗ không hoàn tất.",
          "CART_BLOCKED",
        );
      }

      const supplyId = catalogItem.supplyId || catalogItem.id;
      const existing = cart.items.find((item) =>
        sameSupplyCartIdentity(item, {
          supplyId,
          restaurantId: input.restaurantId,
          note: input.note,
          serviceAt,
        }),
      );
      const itemId = existing?._id || new mongoose.Types.ObjectId();
      const warehouseId = await resolveWarehouseId(input.restaurantId, session);

      try {
        await reserveForOrderTx({
          restaurantId: input.restaurantId,
          warehouseId,
          orderCode: `CART:${String(cart._id)}:${String(itemId)}`,
          lines: [
            {
              itemType: "SUPPLY",
              supplyId,
              menuItemId: supplyId,
              quantity,
              servingKey: "unit",
            },
          ],
          session,
        });
      } catch (error) {
        if (
          error?.code === "INSUFFICIENT_STOCK" ||
          String(error?.message || "").includes("Insufficient")
        ) {
          throw graphQLError(
            `${catalogItem.name} đã hết hàng hoặc không đủ tồn kho để giữ chỗ.`,
            "OUT_OF_STOCK",
          );
        }
        throw error;
      }

      const now = new Date();
      const holdExpiresAt = new Date(now.getTime() + HOLD_TTL_MS);
      const variant = catalogItem.servingVariants?.[0] || {};
      const price = Number(variant.price ?? catalogItem.basePrice ?? 0);
      if (existing) {
        existing.quantity = Number(existing.quantity || 0) + quantity;
        existing.name = catalogItem.name;
        existing.price = price;
        existing.thumbImage = catalogItem.thumbImage || null;
        existing.servingKey = variant.key || "unit";
        existing.servingName = variant.name || catalogItem.servingUnit || "Đơn vị";
        existing.holdExpiresAt = holdExpiresAt;
        existing.holdStatus = "active";
        existing.serviceAt = serviceAt;
      } else {
        cart.items.push({
          _id: itemId,
          itemType: "SUPPLY",
          supplyId,
          // Giữ alias legacy để checkout/release dùng chung inventory router.
          menuItemId: supplyId,
          restaurantId: input.restaurantId,
          name: catalogItem.name,
          price,
          modifiersPrice: 0,
          modifierSelectionKey: "",
          modifiers: [],
          quantity,
          thumbImage: catalogItem.thumbImage || null,
          note: normalizeNote(input.note) || null,
          servingKey: variant.key || "unit",
          servingName: variant.name || catalogItem.servingUnit || "Đơn vị",
          serviceAt,
          holdExpiresAt,
          holdStatus: "active",
        });
      }

      applyCartDerivedFields(cart, { now });
      await cart.save({ session });
      result = cart.toObject({ virtuals: true });
    });
  } finally {
    await session.endSession();
  }

  return result;
}

export const createSupplyAwareAddCartItem = (fallbackResolver) =>
  async (parent, args, ctx, info) => {
    const catalogItem = await resolveSupplyFromInput(args?.input);
    if (!catalogItem) return fallbackResolver(parent, args, ctx, info);
    return addSupplyCartItem({ input: args.input, ctx, catalogItem });
  };

export const createSupplyAwareLiveState = (fallbackResolver) =>
  async (parent, args, ctx, info) => {
    const catalogItem = await resolveSupplyFromInput(args?.input);
    if (!catalogItem) return fallbackResolver(parent, args, ctx, info);

    const userId = ctx?.user?.id;
    const supplyId = catalogItem.supplyId || catalogItem.id;
    let myCartQty = 0;
    let myHoldExpiresAt = null;
    if (userId && mongoose.isValidObjectId(userId)) {
      const cart = await Cart.findOne({ userId, status: "active" })
        .select({ items: 1 })
        .lean();
      for (const item of cart?.items || []) {
        if (
          String(item?.itemType || "").toUpperCase() === "SUPPLY" &&
          String(item?.supplyId || item?.menuItemId || "") === String(supplyId)
        ) {
          myCartQty += Number(item.quantity || 0);
          if (
            item.holdExpiresAt &&
            (!myHoldExpiresAt ||
              new Date(item.holdExpiresAt) > new Date(myHoldExpiresAt))
          ) {
            myHoldExpiresAt = item.holdExpiresAt;
          }
        }
      }
    }

    const maxAvailableQty = Math.max(0, Number(catalogItem.maxAvailable || 0));
    return {
      itemType: "SUPPLY",
      menuItemId: supplyId,
      comboId: null,
      comboSnapshot: null,
      restaurantId: args.input.restaurantId,
      servingVariantKey: "unit",
      viewerCount: 0,
      maxAvailableQty,
      outOfStock: maxAvailableQty <= 0,
      blocked: false,
      blockedUntil: null,
      abuseWarning: null,
      policyMessage:
        maxAvailableQty > 0
          ? "Supply có sẵn ở mọi khung giờ phục vụ."
          : `${catalogItem.name} hiện đã hết hàng.`,
      holdTtlSeconds: HOLD_TTL_MS / 1000,
      myCartQty,
      myHoldExpiresAt,
      reservedCartQty: 0,
    };
  };
