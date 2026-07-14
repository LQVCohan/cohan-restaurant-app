import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Cart, MenuItem } from "../../../models/index.js";

const COMBO_HOLD_TTL_MS = 5 * 60 * 1000;
const CART_HOLD_CHECKOUT_ERROR =
  "Món trong giỏ đã hết hạn hoặc không còn khớp với đơn hàng. Vui lòng kiểm tra lại giỏ.";

function toObjectId(value) {
  if (!value || !mongoose.isValidObjectId(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

function getAuthUserId(ctx) {
  const rawUserId = ctx?.user?.id || ctx?.user?._id;
  return rawUserId && mongoose.isValidObjectId(rawUserId)
    ? String(rawUserId)
    : null;
}

function getCartRefs(item = {}) {
  return {
    cartId: item.cartId ? String(item.cartId) : "",
    cartItemId: item.cartItemId ? String(item.cartItemId) : "",
  };
}

export function isComboCheckoutItem(item = {}) {
  return String(item.itemType || "MENU_ITEM").toUpperCase() === "COMBO" || Boolean(item.comboId);
}

export function getSyntheticComboHoldExpiry(now = new Date()) {
  return new Date(now.getTime() + COMBO_HOLD_TTL_MS);
}

function cloneSnapshot(value) {
  if (!value) return null;
  if (typeof value.toObject === "function") {
    return value.toObject({ depopulate: true });
  }
  return JSON.parse(JSON.stringify(value));
}

function getComboPrice(cartItem = {}) {
  const price = Number(
    cartItem?.comboSnapshot?.comboPrice ?? cartItem?.price ?? 0,
  );
  return Number.isFinite(price) && price >= 0 ? price : 0;
}

export function normalizeComboCheckoutItem(
  rawItem,
  cartItem,
  refs,
  menuItem,
) {
  const menuItemId =
    cartItem.menuItemId ||
    cartItem.comboSnapshot?.items?.[0]?.menuItemId ||
    rawItem.dishId ||
    rawItem.menuId;
  const categoryId = menuItem?.categoryId || rawItem.categoryId;
  if (!menuItemId || !categoryId) throwInvalidCartHold();

  const servingKey =
    rawItem.servingKey || cartItem.servingKey || rawItem.servingVariant?.key || "portion";
  const comboPrice = getComboPrice(cartItem);

  return {
    ...rawItem,
    itemType: "COMBO",
    comboId: String(cartItem.comboId),
    comboSnapshot: cloneSnapshot(cartItem.comboSnapshot),
    restaurantId: String(cartItem.restaurantId),
    dishId: String(menuItemId),
    menuId: String(menuItemId),
    categoryId: String(categoryId),
    name: cartItem.name || rawItem.name,
    unit: rawItem.unit || "combo",
    image: cartItem.thumbImage || rawItem.image,
    quantity: Number(cartItem.quantity || 1),
    basePrice: comboPrice,
    servingKey,
    servingVariant: {
      key: servingKey,
      name: cartItem.servingName || "Combo",
      mode: "PORTION",
      price: comboPrice,
      sellQty: 1,
      sellUnit: "portion",
    },
    cartId: refs.cartId,
    cartItemId: refs.cartItemId,
  };
}

function throwInvalidCartHold() {
  throw new GraphQLError(CART_HOLD_CHECKOUT_ERROR, {
    extensions: { code: "CART_HOLD_INVALID" },
  });
}

async function prepareComboCheckoutItems({ items = [], ctx }) {
  const comboIndexes = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => isComboCheckoutItem(item));

  if (!comboIndexes.length) {
    return { items, prepared: [] };
  }

  const authUserId = getAuthUserId(ctx);
  if (!authUserId) throwInvalidCartHold();

  const nextItems = [...items];
  const prepared = [];
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const now = new Date();

      for (const { item: rawItem, index } of comboIndexes) {
        const refs = getCartRefs(rawItem);
        const cartId = toObjectId(refs.cartId);
        const cartItemId = toObjectId(refs.cartItemId);
        if (!cartId || !cartItemId) throwInvalidCartHold();

        const cart = await Cart.findOne({
          _id: cartId,
          userId: toObjectId(authUserId),
          status: "active",
        }).session(session);
        if (!cart) throwInvalidCartHold();

        const cartItem =
          typeof cart.items?.id === "function"
            ? cart.items.id(cartItemId)
            : (cart.items || []).find(
                (entry) => String(entry._id) === String(cartItemId),
              );
        if (!cartItem) throwInvalidCartHold();

        const holdStatus = String(cartItem.holdStatus || "active");
        if (
          holdStatus !== "active" ||
          String(cartItem.itemType || "MENU_ITEM").toUpperCase() !== "COMBO" ||
          !cartItem.comboId ||
          String(cartItem.comboId) !== String(rawItem.comboId || "") ||
          String(cartItem.restaurantId || "") !== String(rawItem.restaurantId || "") ||
          Number(cartItem.quantity || 0) !== Number(rawItem.quantity || 0)
        ) {
          throwInvalidCartHold();
        }

        const comboMenuItemId =
          cartItem.menuItemId || cartItem.comboSnapshot?.items?.[0]?.menuItemId;
        const menuItemObjectId = toObjectId(comboMenuItemId);
        if (!menuItemObjectId) throwInvalidCartHold();

        const menuItem = await MenuItem.findOne({
          _id: menuItemObjectId,
          restaurantId: cartItem.restaurantId,
        })
          .select("_id categoryId")
          .session(session)
          .lean();
        if (!menuItem?.categoryId) throwInvalidCartHold();

        const previousHoldExpiresAt = cartItem.holdExpiresAt || null;
        const expiry = previousHoldExpiresAt
          ? new Date(previousHoldExpiresAt)
          : null;
        if (!expiry || Number.isNaN(expiry.getTime()) || expiry <= now) {
          cartItem.holdExpiresAt = getSyntheticComboHoldExpiry(now);
        }

        cart.lastActivityAt = now;
        await cart.save({ session });

        prepared.push({
          cartId: String(cart._id),
          cartItemId: String(cartItem._id),
          previousHoldExpiresAt,
        });
        nextItems[index] = normalizeComboCheckoutItem(
          rawItem,
          cartItem,
          refs,
          menuItem,
        );
      }
    });
  } finally {
    await session.endSession();
  }

  return { items: nextItems, prepared };
}

async function restoreComboHoldExpiries(prepared = []) {
  if (!prepared.length) return;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const ref of prepared) {
        const cart = await Cart.findById(toObjectId(ref.cartId)).session(session);
        const cartItem =
          cart?.items?.id?.(ref.cartItemId) ||
          (cart?.items || []).find(
            (entry) => String(entry._id) === String(ref.cartItemId),
          );
        if (!cart || !cartItem) continue;

        cartItem.holdExpiresAt = ref.previousHoldExpiresAt || undefined;
        cart.lastActivityAt = new Date();
        await cart.save({ session });
      }
    });
  } finally {
    await session.endSession();
  }
}

export function withComboCheckoutHoldCompatibility(mutation = {}) {
  return {
    ...mutation,

    async createCheckoutOrders(parent, args, ctx, info) {
      let prepared = [];
      try {
        const normalized = await prepareComboCheckoutItems({
          items: args?.input?.items || [],
          ctx,
        });
        prepared = normalized.prepared;

        return await mutation.createCheckoutOrders.call(
          mutation,
          parent,
          {
            ...args,
            input: {
              ...(args?.input || {}),
              items: normalized.items,
            },
          },
          ctx,
          info,
        );
      } catch (error) {
        if (prepared.length) {
          await restoreComboHoldExpiries(prepared).catch((restoreError) => {
            console.warn(
              "[ComboCheckoutHoldCompatibility] Failed to restore combo cart hold expiry",
              restoreError?.message || restoreError,
            );
          });
        }
        throw error;
      }
    },
  };
}

export default withComboCheckoutHoldCompatibility;
