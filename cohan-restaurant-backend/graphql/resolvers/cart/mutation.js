import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Cart, MenuItem } from "../../../models/index.js";
import { logObjectEvent } from "../../../src/services/eventLog.service.js";

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

export const CartMutation = {
  // ==============================
  // ADD CART ITEM
  // ==============================
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

    if (!mongoose.isValidObjectId(userId)) {
      throw new GraphQLError("Invalid userId");
    }
    if (!mongoose.isValidObjectId(restaurantId)) {
      throw new GraphQLError("Invalid restaurantId");
    }
    if (!mongoose.isValidObjectId(menuItemId)) {
      throw new GraphQLError("Invalid menuItemId");
    }

    // Lấy cart active của user (1 user 1 cart active)
    let cart = await Cart.findOne({
      userId,
      status: "active",
    });

    if (!cart) {
      cart = await Cart.create({
        userId,
        restaurantId,
        items: [],
        status: "active",
      });
    }

    // Clone snapshot trước khi thay đổi để log diff
    const before = cart.toObject({ virtuals: true });

    // Tìm item tương ứng để cộng dồn theo menuItemId + servingVariantKey
    const existing = cart.items.find(
      (it) =>
        String(it.menuItemId) === String(menuItemId) &&
        (it.servingVariantKey || "") === (servingVariantKey || "")
    );

    if (existing) {
      existing.quantity += quantity;
    } else {
      cart.items.push({
        menuItemId,
        name,
        price,
        quantity,
        restaurantId,
        thumbImage,
        note,
        servingVariantKey,
      });
    }

    const totals = computeTotals(cart.items);
    cart.totalQuantity = totals.totalQuantity;
    cart.totalAmount = totals.totalAmount;
    cart.lastActivityAt = new Date();

    await cart.save();
    const after = cart.toObject({ virtuals: true });

    // 🔔 Ghi log (không làm hỏng flow nếu lỗi)
    await logObjectEvent({
      ctx,
      verb: "cart.add_item",
      objectKind: "Cart",
      entity: cart, // service sẽ hiểu ra restaurantId, id...
      userId, // user thực hiện (đã có logic guest ở checkout)
      source: "web",
      status: "success",
      meta: {
        menuItemId,
        quantity,
        price,
        servingVariantKey,
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

    return after;
  },

  // ==============================
  // UPDATE CART ITEM
  // ==============================
  async updateCartItem(_, { input }, ctx) {
    const { cartId, itemId, quantity } = input;

    if (!mongoose.isValidObjectId(cartId)) {
      throw new GraphQLError("Invalid cartId");
    }
    if (!mongoose.isValidObjectId(itemId)) {
      throw new GraphQLError("Invalid itemId");
    }

    const cart = await Cart.findById(cartId);
    if (!cart || cart.status !== "active") {
      throw new GraphQLError("Cart not found or not active");
    }

    const before = cart.toObject({ virtuals: true });

    const it = cart.items.id(itemId);
    if (!it) throw new GraphQLError("Cart item not found");

    if (quantity <= 0) {
      it.remove(); // xoá item
    } else {
      it.quantity = quantity;
    }

    const totals = computeTotals(cart.items);
    cart.totalQuantity = totals.totalQuantity;
    cart.totalAmount = totals.totalAmount;
    cart.lastActivityAt = new Date();

    await cart.save();
    const after = cart.toObject({ virtuals: true });

    await logObjectEvent({
      ctx,
      verb: "cart.update_item",
      objectKind: "Cart",
      entity: cart,
      userId: ctx.user?.id, // nếu có user trong ctx
      source: "web",
      status: "success",
      meta: {
        itemId,
        quantity,
      },
      diff: {
        before: {
          totalQuantity: before.totalQuantity,
          totalAmount: before.totalAmount,
        },
        after: {
          totalQuantity: after.totalQuantity,
          totalAmount: after.totalAmount,
        },
      },
    });

    return after;
  },

  // ==============================
  // REMOVE CART ITEM
  // ==============================
  async removeCartItem(_, { input }, ctx) {
    const { cartId, itemId } = input;

    if (!mongoose.isValidObjectId(cartId)) {
      throw new GraphQLError("Invalid cartId");
    }
    if (!mongoose.isValidObjectId(itemId)) {
      throw new GraphQLError("Invalid itemId");
    }

    const cart = await Cart.findById(cartId);
    if (!cart || cart.status !== "active") {
      throw new GraphQLError("Cart not found or not active");
    }

    const before = cart.toObject({ virtuals: true });

    const it = cart.items.id(itemId);
    if (!it) throw new GraphQLError("Cart item not found");

    it.remove();

    const totals = computeTotals(cart.items);
    cart.totalQuantity = totals.totalQuantity;
    cart.totalAmount = totals.totalAmount;
    cart.lastActivityAt = new Date();

    await cart.save();
    const after = cart.toObject({ virtuals: true });

    await logObjectEvent({
      ctx,
      verb: "cart.remove_item",
      objectKind: "Cart",
      entity: cart,
      userId: ctx.user?.id,
      source: "web",
      status: "success",
      meta: { itemId },
      diff: {
        before: {
          totalQuantity: before.totalQuantity,
          totalAmount: before.totalAmount,
        },
        after: {
          totalQuantity: after.totalQuantity,
          totalAmount: after.totalAmount,
        },
      },
    });

    return after;
  },

  // ==============================
  // CLEAR CART
  // ==============================
  async clearCart(_, { input }, ctx) {
    const { cartId } = input;

    if (!mongoose.isValidObjectId(cartId)) {
      throw new GraphQLError("Invalid cartId");
    }

    const cart = await Cart.findById(cartId);
    if (!cart || cart.status !== "active") {
      // Không có cart thì coi như đã rỗng
      return true;
    }

    const before = cart.toObject({ virtuals: true });

    cart.items = [];
    cart.totalQuantity = 0;
    cart.totalAmount = 0;
    cart.lastActivityAt = new Date();

    await cart.save();
    const after = cart.toObject({ virtuals: true });

    await logObjectEvent({
      ctx,
      verb: "cart.clear",
      objectKind: "Cart",
      entity: cart,
      userId: ctx.user?.id,
      source: "web",
      status: "success",
      meta: {},
      diff: {
        before: {
          totalQuantity: before.totalQuantity,
          totalAmount: before.totalAmount,
        },
        after: {
          totalQuantity: after.totalQuantity,
          totalAmount: after.totalAmount,
        },
      },
    });

    return true;
  },
};
