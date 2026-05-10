import { beforeEach, describe, expect, it, vi } from "vitest";

const model = vi.hoisted(() => ({
  Cart: { findOne: vi.fn(), findById: vi.fn(), create: vi.fn() },
  Warehouse: { findOne: vi.fn() },
}));
const inv = vi.hoisted(() => ({ checkAvailabilityForLinesTx: vi.fn(), reserveForOrderTx: vi.fn(), cancelReservationForOrderTx: vi.fn() }));
const event = vi.hoisted(() => ({ logObjectEvent: vi.fn() }));
const mg = vi.hoisted(() => ({
  isValidObjectId: vi.fn((v) => String(v).startsWith("valid-")),
  startSession: vi.fn(),
  Types: { ObjectId: vi.fn(() => "valid-generated-item") },
}));

vi.mock("../../models/index.js", () => model);
vi.mock("../../src/services/inventory.service.js", () => inv);
vi.mock("../../src/services/eventLog.service.js", () => event);
vi.mock("mongoose", () => ({ default: mg }));

const leanChain = (val) => ({ lean: vi.fn().mockResolvedValue(val) });
const whChain = (val) => ({ sort: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(val) })) });
const sessionQuery = (val) => ({ session: vi.fn().mockResolvedValue(val) });
const makeItems = (items = []) => {
  items.id = vi.fn((id) => items.find((it) => String(it._id) === String(id)));
  return items;
};
const makeCart = ({
  cartId = "valid-c1",
  userId = "valid-u1",
  status = "active",
  items = [],
} = {}) => {
  const cartItems = makeItems(items);
  return {
    _id: cartId,
    userId,
    status,
    items: cartItems,
    abuse: {},
    totalQuantity: cartItems.reduce((sum, it) => sum + Number(it.quantity || 0), 0),
    totalAmount: cartItems.reduce((sum, it) => sum + Number(it.quantity || 0) * Number(it.price || 0), 0),
    lastActivityAt: null,
    save: vi.fn(async function save() {
      this.totalQuantity = this.items.reduce((sum, it) => sum + Number(it.quantity || 0), 0);
      this.totalAmount = this.items.reduce((sum, it) => sum + Number(it.quantity || 0) * Number(it.price || 0), 0);
      return this;
    }),
    toObject: vi.fn(function toObject() {
      return {
        _id: this._id,
        userId: this.userId,
        status: this.status,
        totalQuantity: this.totalQuantity,
        totalAmount: this.totalAmount,
        lastActivityAt: this.lastActivityAt,
        items: this.items.map((it) => ({ ...it })),
      };
    }),
  };
};

describe("cart access hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    model.Cart.findOne.mockReturnValue(leanChain(null));
    model.Warehouse.findOne.mockReturnValue(whChain({ _id: "valid-wh1" }));
    inv.checkAvailabilityForLinesTx.mockResolvedValue({ isAvailable: true, maxAvailable: 10 });
    inv.reserveForOrderTx.mockResolvedValue({});
    inv.cancelReservationForOrderTx.mockResolvedValue({});
    const session = { withTransaction: vi.fn(async (fn) => fn()), endSession: vi.fn() };
    mg.startSession.mockResolvedValue(session);
    model.Cart.create.mockResolvedValue([{ _id: "valid-c1", items: [], status: "active", toObject: () => ({ _id: "valid-c1", items: [] }), save: vi.fn() }]);
  });

  it("myCart rejects unauthenticated and cross-user", async () => {
    const q = (await import("../../graphql/resolvers/cart/query.js")).CartQuery;
    await expect(q.myCart(null, {}, {})).rejects.toMatchObject({ extensions: { code: "UNAUTHENTICATED" } });
    await expect(q.myCart(null, { userId: "valid-u2" }, { user: { id: "valid-u1" } })).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
    expect(model.Cart.findOne).not.toHaveBeenCalled();
  });

  it("myCart allowed uses ctx.user.id", async () => {
    const q = (await import("../../graphql/resolvers/cart/query.js")).CartQuery;
    await q.myCart(null, {}, { user: { id: "valid-u1" } });
    expect(model.Cart.findOne).toHaveBeenCalledWith({ userId: "valid-u1", status: "active" });
  });

  it("menuItemLiveState public works without reading cart", async () => {
    const q = (await import("../../graphql/resolvers/cart/query.js")).CartQuery;
    await q.menuItemLiveState(null, { input: { restaurantId: "valid-r1", menuItemId: "valid-m1" } }, {});
    expect(model.Cart.findOne).not.toHaveBeenCalled();
    expect(model.Warehouse.findOne).toHaveBeenCalled();
    expect(inv.checkAvailabilityForLinesTx).toHaveBeenCalled();
  });

  it("menuItemLiveState rejects cross-user userId", async () => {
    const q = (await import("../../graphql/resolvers/cart/query.js")).CartQuery;
    await expect(q.menuItemLiveState(null, { input: { restaurantId: "valid-r1", menuItemId: "valid-m1", userId: "valid-u2" } }, { user: { id: "valid-u1" } })).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
    expect(model.Cart.findOne).not.toHaveBeenCalled();
    expect(model.Warehouse.findOne).not.toHaveBeenCalled();
  });

  it("addCartItem auth guard before warehouse/session", async () => {
    const m = (await import("../../graphql/resolvers/cart/mutation.js")).CartMutation;
    const input = { restaurantId: "valid-r1", menuItemId: "valid-m1", quantity: 1, price: 10, name: "A" };
    await expect(m.addCartItem(null, { input }, {})).rejects.toMatchObject({ extensions: { code: "UNAUTHENTICATED" } });
    await expect(m.addCartItem(null, { input: { ...input, userId: "valid-u2" } }, { user: { id: "valid-u1" } })).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
    expect(model.Warehouse.findOne).not.toHaveBeenCalled();
    expect(mg.startSession).not.toHaveBeenCalled();
  });

  it("update/remove/clear enforce owner before mutating", async () => {
    const m = (await import("../../graphql/resolvers/cart/mutation.js")).CartMutation;
    const save = vi.fn();
    const item = { _id: "valid-i1", menuItemId: "valid-m1", quantity: 1, restaurantId: "valid-r1", servingVariantKey: "portion", remove: vi.fn() };
    const cart = { _id: "valid-c1", userId: "valid-u2", status: "active", items: { id: vi.fn(() => item), [Symbol.iterator]: function*(){ yield item; } }, save, toObject: () => ({}) };
    model.Cart.findById
      .mockImplementationOnce(() => sessionQuery(cart))
      .mockResolvedValue(cart);
    await expect(m.updateCartItem(null, { input: { cartId: "valid-c1", itemId: "valid-i1", quantity: 2 } }, { user: { id: "valid-u1" } })).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
    await expect(m.removeCartItem(null, { input: { cartId: "valid-c1", itemId: "valid-i1" } }, { user: { id: "valid-u1" } })).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
    await expect(m.clearCart(null, { input: { cartId: "valid-c1" } }, { user: { id: "valid-u1" } })).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
    expect(save).not.toHaveBeenCalled();
  });

  it("releaseMyCartHolds blocks cross-user and allows owner", async () => {
    const m = (await import("../../graphql/resolvers/cart/mutation.js")).CartMutation;
    await expect(m.releaseMyCartHolds(null, { input: { userId: "valid-u2" } }, { user: { id: "valid-u1" } })).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
    expect(model.Cart.findOne).not.toHaveBeenCalled();

    const save = vi.fn();
    const cart = { _id: "valid-c1", userId: "valid-u1", status: "active", items: [], abuse: {}, save };
    model.Cart.findOne.mockResolvedValue(cart);
    await expect(m.releaseMyCartHolds(null, { input: {} }, { user: { id: "valid-u1" } })).resolves.toBe(true);
    expect(save).toHaveBeenCalled();
  });

  it("addCartItem reserves new item with stable real item id in orderCode", async () => {
    const m = (await import("../../graphql/resolvers/cart/mutation.js")).CartMutation;
    const cart = makeCart();
    model.Cart.findOne.mockImplementation(() => sessionQuery(cart));

    const result = await m.addCartItem(
      null,
      {
        input: {
          restaurantId: "valid-r1",
          menuItemId: "valid-m1",
          quantity: 2,
          price: 10,
          name: "A",
        },
      },
      { user: { id: "valid-u1" } }
    );

    expect(inv.reserveForOrderTx).toHaveBeenCalledWith(
      expect.objectContaining({
        orderCode: "CART:valid-c1:valid-generated-item",
      })
    );
    expect(result.items[0]._id).toBe("valid-generated-item");
    expect(inv.reserveForOrderTx.mock.calls[0][0].orderCode).not.toContain(":new");
  });

  it("updateCartItem increase reserves only the delta", async () => {
    const m = (await import("../../graphql/resolvers/cart/mutation.js")).CartMutation;
    const item = { _id: "valid-i1", menuItemId: "valid-m1", quantity: 1, price: 10, restaurantId: "valid-r1", servingVariantKey: "portion" };
    const cart = makeCart({ items: [item] });
    model.Cart.findById.mockImplementation(() => sessionQuery(cart));

    const result = await m.updateCartItem(
      null,
      { input: { cartId: "valid-c1", itemId: "valid-i1", quantity: 3 } },
      { user: { id: "valid-u1" } }
    );

    expect(inv.reserveForOrderTx).toHaveBeenCalledWith(
      expect.objectContaining({
        orderCode: "CART:valid-c1:valid-i1",
        lines: [{ menuItemId: "valid-m1", quantity: 2, servingKey: "portion" }],
      })
    );
    expect(inv.cancelReservationForOrderTx).not.toHaveBeenCalled();
    expect(result.items[0].quantity).toBe(3);
    expect(result.totalQuantity).toBe(3);
  });

  it("updateCartItem decrease releases only the delta", async () => {
    const m = (await import("../../graphql/resolvers/cart/mutation.js")).CartMutation;
    const item = { _id: "valid-i1", menuItemId: "valid-m1", quantity: 5, price: 10, restaurantId: "valid-r1", servingVariantKey: "portion" };
    const cart = makeCart({ items: [item] });
    model.Cart.findById.mockImplementation(() => sessionQuery(cart));

    const result = await m.updateCartItem(
      null,
      { input: { cartId: "valid-c1", itemId: "valid-i1", quantity: 2 } },
      { user: { id: "valid-u1" } }
    );

    expect(inv.cancelReservationForOrderTx).toHaveBeenCalledWith(
      expect.objectContaining({
        orderCode: "CART:valid-c1:valid-i1",
        lines: [{ menuItemId: "valid-m1", quantity: 3, servingKey: "portion" }],
      })
    );
    expect(inv.reserveForOrderTx).not.toHaveBeenCalled();
    expect(result.items[0].quantity).toBe(2);
    expect(result.totalQuantity).toBe(2);
  });

  it("updateCartItem keeps quantity unchanged when reserve delta fails", async () => {
    const m = (await import("../../graphql/resolvers/cart/mutation.js")).CartMutation;
    const item = { _id: "valid-i1", menuItemId: "valid-m1", quantity: 1, price: 10, restaurantId: "valid-r1", servingVariantKey: "portion" };
    const cart = makeCart({ items: [item] });
    model.Cart.findById.mockImplementation(() => sessionQuery(cart));
    inv.reserveForOrderTx.mockRejectedValueOnce(new Error("Insufficient"));

    await expect(
      m.updateCartItem(
        null,
        { input: { cartId: "valid-c1", itemId: "valid-i1", quantity: 4 } },
        { user: { id: "valid-u1" } }
      )
    ).rejects.toMatchObject({ message: "Món đã hết hàng hoặc không đủ tồn kho để tăng số lượng." });

    expect(item.quantity).toBe(1);
    expect(cart.totalQuantity).toBe(1);
    expect(cart.totalAmount).toBe(10);
    expect(cart.save).not.toHaveBeenCalled();
  });

  it("updateCartItem delta zero only refreshes hold", async () => {
    const m = (await import("../../graphql/resolvers/cart/mutation.js")).CartMutation;
    const oldHold = new Date("2026-05-10T00:00:00.000Z");
    const item = { _id: "valid-i1", menuItemId: "valid-m1", quantity: 2, price: 10, restaurantId: "valid-r1", servingVariantKey: "portion", holdExpiresAt: oldHold };
    const cart = makeCart({ items: [item] });
    model.Cart.findById.mockImplementation(() => sessionQuery(cart));

    const result = await m.updateCartItem(
      null,
      { input: { cartId: "valid-c1", itemId: "valid-i1", quantity: 2 } },
      { user: { id: "valid-u1" } }
    );

    expect(inv.reserveForOrderTx).not.toHaveBeenCalled();
    expect(inv.cancelReservationForOrderTx).not.toHaveBeenCalled();
    expect(new Date(result.items[0].holdExpiresAt).getTime()).toBeGreaterThan(oldHold.getTime());
  });
});
