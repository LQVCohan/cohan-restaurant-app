import { describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { __customerRemoteCheckoutTestables } from "../../graphql/resolvers/order/mutation.js";
import { Cart } from "../../models/cart.model.js";

const {
  assertCustomerRemoteCheckoutAuth,
  assertCartHoldCheckoutAllowed,
  removeCheckedOutCartItemsTx,
} = __customerRemoteCheckoutTestables;

const validId = () => new mongoose.Types.ObjectId().toString();

const makeCart = (items, { restaurantId = validId() } = {}) => {
  const cart = new Cart({
    userId: validId(),
    status: "active",
    restaurantId,
    totalAmount: 999999,
    lastActivityAt: null,
    items: items.map((item) => ({
      _id: validId(),
      menuItemId: validId(),
      restaurantId,
      ...item,
    })),
  });
  cart.save = vi.fn(async function save() {
    return this;
  });
  return cart;
};

describe("customer remote checkout guards", () => {
  it("declares persisted cart fields used by GraphQL and checkout cleanup", () => {
    expect(Cart.schema.path("restaurantId")).toBeTruthy();
    expect(Cart.schema.path("totalAmount")).toBeTruthy();
    expect(Cart.schema.path("lastActivityAt")).toBeTruthy();
  });

  it("rejects missing ctx.user as UNAUTHENTICATED", () => {
    expect(() => assertCustomerRemoteCheckoutAuth({}, null)).toThrow(
      expect.objectContaining({ extensions: { code: "UNAUTHENTICATED" } }),
    );
  });

  it.each(["manager", "admin", "staff"])("rejects %s role as FORBIDDEN", (roleName) => {
    expect(() =>
      assertCustomerRemoteCheckoutAuth(
        { user: { id: validId(), roleName } },
        null,
      ),
    ).toThrow(expect.objectContaining({ extensions: { code: "FORBIDDEN" } }));
  });

  it("allows customer role to continue with authenticated user id", () => {
    const userId = validId();
    expect(
      assertCustomerRemoteCheckoutAuth(
        { user: { id: userId, roleName: "customer" } },
        userId,
      ),
    ).toBe(userId);
  });

  it("rejects mismatched input.userId as FORBIDDEN", () => {
    expect(() =>
      assertCustomerRemoteCheckoutAuth(
        { user: { id: validId(), roleName: "customer" } },
        validId(),
      ),
    ).toThrow(expect.objectContaining({ extensions: { code: "FORBIDDEN" } }));
  });


  it("allows checkout item with valid cartId/cartItemId to continue", () => {
    const cartId = validId();
    const cartItemId = validId();

    expect(
      assertCartHoldCheckoutAllowed({
        item: { cartId, cartItemId },
        authUserId: validId(),
      }),
    ).toEqual({ cartId, cartItemId });
  });

  it("blocks checkout item missing cartId/cartItemId", () => {
    expect(() =>
      assertCartHoldCheckoutAllowed({
        item: { cartId: validId() },
        authUserId: validId(),
      }),
    ).toThrow(/Món trong giỏ đã hết hạn|không còn khớp/);
  });

  it("marks cart checked_out and clears stale total when all checked-out items are removed", async () => {
    const cart = makeCart([
      { quantity: 2, price: 10000 },
      { quantity: 1, price: 25000 },
    ]);

    await removeCheckedOutCartItemsTx({
      releasedCartItems: cart.items.map((item) => ({
        cart,
        cartItemId: item._id,
      })),
      session: { id: "session" },
    });

    expect(cart.items).toHaveLength(0);
    expect(cart.status).toBe("checked_out");
    expect(cart.totalAmount).toBe(0);
    expect(cart.restaurantId).toBeNull();
    expect(cart.lastActivityAt).toBeInstanceOf(Date);
    expect(cart.save).toHaveBeenCalledWith({ session: { id: "session" } });
  });

  it("keeps partial cart active and recalculates totalAmount for remaining items", async () => {
    const restaurantId = validId();
    const cart = makeCart(
      [
        { quantity: 2, price: 10000 },
        { quantity: 3, price: 5000 },
      ],
      { restaurantId },
    );
    const checkedOutItem = cart.items[0];

    await removeCheckedOutCartItemsTx({
      releasedCartItems: [{ cart, cartItemId: checkedOutItem._id }],
      session: null,
    });

    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]._id).not.toBe(checkedOutItem._id);
    expect(cart.status).toBe("active");
    expect(cart.totalAmount).toBe(15000);
    expect(String(cart.restaurantId)).toBe(restaurantId);
    expect(cart.lastActivityAt).toBeInstanceOf(Date);
    expect(cart.save).toHaveBeenCalledWith({ session: null });
  });

  it("sets restaurantId null for remaining multi-restaurant carts", async () => {
    const checkedOutRestaurantId = validId();
    const firstRemainingRestaurantId = validId();
    const secondRemainingRestaurantId = validId();
    const cart = makeCart(
      [
        { quantity: 1, price: 10000, restaurantId: checkedOutRestaurantId },
        { quantity: 2, price: 12000, restaurantId: firstRemainingRestaurantId },
        { quantity: 1, price: 30000, restaurantId: secondRemainingRestaurantId },
      ],
      { restaurantId: checkedOutRestaurantId },
    );
    const checkedOutItem = cart.items[0];

    await removeCheckedOutCartItemsTx({
      releasedCartItems: [{ cart, cartItemId: checkedOutItem._id }],
      session: null,
    });

    expect(cart.items).toHaveLength(2);
    expect(cart.status).toBe("active");
    expect(cart.totalAmount).toBe(54000);
    expect(cart.restaurantId).toBeNull();
  });
});
