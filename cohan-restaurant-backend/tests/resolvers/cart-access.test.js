import { beforeEach, describe, expect, it, vi } from "vitest";

const model = vi.hoisted(() => ({
  Cart: { find: vi.fn(), findOne: vi.fn(), findById: vi.fn(), create: vi.fn() },
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

const queryChain = (val) => ({
  select: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(val) })),
  lean: vi.fn().mockResolvedValue(val),
});
const whChain = (val) => ({
  sort: vi.fn(() => ({
    lean: vi.fn().mockResolvedValue(val),
    session: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(val) })),
  })),
  session: vi.fn(() => ({
    sort: vi.fn(() => ({
      lean: vi.fn().mockResolvedValue(val),
    })),
  })),
});
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
  abuse = {},
} = {}) => {
  const cartItems = makeItems(items);
  return {
    _id: cartId,
    userId,
    status,
    items: cartItems,
    abuse: { ...abuse },
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
    model.Cart.findOne.mockReturnValue(queryChain(null));
    model.Cart.find.mockReturnValue(queryChain([]));
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

  it("menuItemLiveState public returns hold metadata and reserved cart qty", async () => {
    const future = "2099-05-11T04:30:00.000Z";
    model.Cart.find.mockReturnValue(
      queryChain([
        {
          items: [
            {
              restaurantId: "valid-r1",
              menuItemId: "valid-m1",
              quantity: 2,
              servingKey: "portion",
              holdStatus: "active",
              holdExpiresAt: future,
            },
          ],
        },
      ])
    );

    const q = (await import("../../graphql/resolvers/cart/query.js")).CartQuery;
    const result = await q.menuItemLiveState(null, { input: { restaurantId: "valid-r1", menuItemId: "valid-m1" } }, {});

    expect(model.Cart.findOne).not.toHaveBeenCalled();
    expect(model.Cart.find).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "active",
        items: expect.objectContaining({
          $elemMatch: expect.objectContaining({
            restaurantId: "valid-r1",
            menuItemId: "valid-m1",
          }),
        }),
      })
    );
    expect(model.Warehouse.findOne).toHaveBeenCalled();
    expect(inv.checkAvailabilityForLinesTx).toHaveBeenCalledWith(
      expect.objectContaining({
        lines: [{ menuItemId: "valid-m1", quantity: 1, servingKey: "portion" }],
      })
    );
    expect(result.myCartQty).toBe(0);
    expect(result.myHoldExpiresAt).toBeNull();
    expect(result.holdTtlSeconds).toBe(300);
    expect(result.reservedCartQty).toBe(2);
    expect(result.servingVariantKey).toBe("portion");
  });

  it("menuItemLiveState returns my hold details for matching active items", async () => {
    const earliest = "2099-05-11T04:30:00.000Z";
    const later = "2099-05-11T04:45:00.000Z";

    model.Cart.findOne.mockReturnValue(
      queryChain({
        abuse: { timeoutReleaseCount: 1, exitReleaseCount: 1 },
        items: [
          {
            restaurantId: "valid-r1",
            menuItemId: "valid-m1",
            quantity: 2,
            servingKey: " portion ",
            holdStatus: "active",
            holdExpiresAt: later,
          },
          {
            restaurantId: "valid-r1",
            menuItemId: "valid-m1",
            quantity: 1,
            servingVariantKey: "portion",
            holdStatus: "active",
            holdExpiresAt: earliest,
          },
          {
            restaurantId: "valid-r1",
            menuItemId: "valid-m1",
            quantity: 4,
            servingKey: "large",
            holdStatus: "active",
            holdExpiresAt: later,
          },
        ],
      })
    );
    model.Cart.find.mockReturnValue(
      queryChain([
        {
          items: [
            {
              restaurantId: "valid-r1",
              menuItemId: "valid-m1",
              quantity: 2,
              servingKey: "portion",
              holdStatus: "active",
              holdExpiresAt: later,
            },
            {
              restaurantId: "valid-r1",
              menuItemId: "valid-m1",
              quantity: 1,
              servingVariantKey: "portion",
              holdStatus: "active",
              holdExpiresAt: earliest,
            },
          ],
        },
        {
          items: [
            {
              restaurantId: "valid-r1",
              menuItemId: "valid-m1",
              quantity: 3,
              servingKey: "portion",
              holdStatus: "active",
              holdExpiresAt: later,
            },
          ],
        },
      ])
    );

    const q = (await import("../../graphql/resolvers/cart/query.js")).CartQuery;
    const result = await q.menuItemLiveState(
      null,
      { input: { restaurantId: "valid-r1", menuItemId: "valid-m1", servingVariantKey: " portion ", userId: "valid-u1" } },
      { user: { id: "valid-u1" } }
    );

    expect(model.Cart.findOne).toHaveBeenCalledWith({ userId: "valid-u1", status: "active" });
    expect(result.myCartQty).toBe(3);
    expect(result.myHoldExpiresAt?.toISOString()).toBe(earliest);
    expect(result.reservedCartQty).toBe(6);
    expect(result.servingVariantKey).toBe("portion");
    expect(result.abuseWarning).toBeNull();
  });

  it("menuItemLiveState ignores expired, released, and variant-mismatched holds", async () => {
    const future = "2099-05-11T05:00:00.000Z";
    const expired = "2000-05-11T05:00:00.000Z";

    model.Cart.findOne.mockReturnValue(
      queryChain({
        abuse: {},
        items: [
          {
            restaurantId: "valid-r1",
            menuItemId: "valid-m1",
            quantity: 2,
            servingKey: "portion",
            holdStatus: "released",
            holdExpiresAt: future,
          },
          {
            restaurantId: "valid-r1",
            menuItemId: "valid-m1",
            quantity: 1,
            servingKey: "portion",
            holdStatus: "active",
            holdExpiresAt: expired,
          },
          {
            restaurantId: "valid-r1",
            menuItemId: "valid-m1",
            quantity: 3,
            servingKey: "large",
            holdStatus: "active",
            holdExpiresAt: future,
          },
        ],
      })
    );
    model.Cart.find.mockReturnValue(
      queryChain([
        {
          items: [
            {
              restaurantId: "valid-r1",
              menuItemId: "valid-m1",
              quantity: 2,
              servingKey: "portion",
              holdStatus: "released",
              holdExpiresAt: future,
            },
            {
              restaurantId: "valid-r1",
              menuItemId: "valid-m1",
              quantity: 1,
              servingKey: "portion",
              holdStatus: "active",
              holdExpiresAt: expired,
            },
            {
              restaurantId: "valid-r1",
              menuItemId: "valid-m1",
              quantity: 4,
              servingKey: "large",
              holdStatus: "active",
              holdExpiresAt: future,
            },
            {
              restaurantId: "valid-r1",
              menuItemId: "valid-m1",
              quantity: 5,
              servingVariantKey: "portion",
              holdExpiresAt: future,
            },
          ],
        },
      ])
    );

    const q = (await import("../../graphql/resolvers/cart/query.js")).CartQuery;
    const result = await q.menuItemLiveState(
      null,
      { input: { restaurantId: "valid-r1", menuItemId: "valid-m1", servingVariantKey: "portion", userId: "valid-u1" } },
      { user: { id: "valid-u1" } }
    );

    expect(result.myCartQty).toBe(0);
    expect(result.myHoldExpiresAt).toBeNull();
    expect(result.reservedCartQty).toBe(5);
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
    const cart = { _id: "valid-c1", userId: "valid-u2", status: "active", items: { id: vi.fn(() => item), [Symbol.iterator]: function* () { yield item; } }, save, toObject: () => ({}) };
    model.Cart.findById
      .mockImplementationOnce(() => sessionQuery(cart))
      .mockResolvedValue(cart);
    model.Cart.findOne.mockImplementationOnce(() => sessionQuery(cart));
    await expect(m.updateCartItem(null, { input: { cartId: "valid-c1", itemId: "valid-i1", quantity: 2 } }, { user: { id: "valid-u1" } })).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
    await expect(m.removeCartItem(null, { input: { cartId: "valid-c1", itemId: "valid-i1" } }, { user: { id: "valid-u1" } })).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
    await expect(m.clearCart(null, { input: { cartId: "valid-c1" } }, { user: { id: "valid-u1" } })).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
    expect(save).not.toHaveBeenCalled();
  });

  it("releaseMyCartHolds blocks cross-user and skips empty cart abuse/save", async () => {
    const m = (await import("../../graphql/resolvers/cart/mutation.js")).CartMutation;
    await expect(m.releaseMyCartHolds(null, { input: { userId: "valid-u2" } }, { user: { id: "valid-u1" } })).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
    expect(model.Cart.findOne).not.toHaveBeenCalled();

    const cart = makeCart();
    model.Cart.findOne.mockImplementation(() => sessionQuery(cart));
    await expect(m.releaseMyCartHolds(null, { input: {} }, { user: { id: "valid-u1" } })).resolves.toBe(true);
    expect(cart.save).not.toHaveBeenCalled();
    expect(cart.abuse).toEqual({});
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
    expect(inv.reserveForOrderTx.mock.calls[0][0].orderCode).not.toContain("[object Object]");
    expect(result.items[0]._id).toBe("valid-generated-item");
    expect(inv.reserveForOrderTx.mock.calls[0][0].orderCode).not.toContain(":new");
  });

  it("addCartItem stringifies object-like generated item ids before building orderCode", async () => {
    const generatedItemId = { toHexString: vi.fn(() => "valid-generated-item") };
    mg.Types.ObjectId.mockImplementationOnce(() => generatedItemId);

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
    expect(inv.reserveForOrderTx.mock.calls[0][0].orderCode).not.toContain("[object Object]");
    expect(generatedItemId.toHexString).toHaveBeenCalled();
    expect(result.items[0]._id).toBe(generatedItemId);
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

  it("clearCart releases every item transactionally and emits after commit", async () => {
    const emit = vi.fn();
    const io = { to: vi.fn(() => ({ emit })) };
    const session = {
      withTransaction: vi.fn(async (fn) => {
        await fn();
        expect(emit).not.toHaveBeenCalled();
      }),
      endSession: vi.fn(),
    };
    mg.startSession.mockResolvedValue(session);

    const items = [
      { _id: "valid-i1", menuItemId: "valid-m1", quantity: 2, price: 10, restaurantId: "valid-r1", servingKey: "large" },
      { _id: "valid-i2", menuItemId: "valid-m2", quantity: 1, price: 5, restaurantId: "valid-r1", servingVariantKey: "portion" },
    ];
    const cart = makeCart({ items });
    model.Cart.findOne.mockImplementation(() => sessionQuery(cart));

    const m = (await import("../../graphql/resolvers/cart/mutation.js")).CartMutation;
    await expect(m.clearCart(null, { input: { cartId: "valid-c1" } }, { user: { id: "valid-u1" }, io })).resolves.toBe(true);

    expect(inv.cancelReservationForOrderTx).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        orderCode: "CART:valid-c1:valid-i1",
        session,
        lines: [{ menuItemId: "valid-m1", quantity: 2, servingKey: "large" }],
      })
    );
    expect(inv.cancelReservationForOrderTx).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        orderCode: "CART:valid-c1:valid-i2",
        session,
        lines: [{ menuItemId: "valid-m2", quantity: 1, servingKey: "portion" }],
      })
    );
    expect(cart.items).toEqual([]);
    expect(cart.totalQuantity).toBe(0);
    expect(cart.totalAmount).toBe(0);
    expect(cart.save).toHaveBeenCalledWith({ session });
    expect(emit).toHaveBeenCalledTimes(2);
    expect(emit).toHaveBeenNthCalledWith(
      1,
      "inventoryEvents",
      expect.objectContaining({
        type: "INVENTORY_RELEASED",
        restaurantId: "valid-r1",
        menuItemId: "valid-m1",
        servingVariantKey: "large",
        quantityDelta: 2,
        reason: "clear_cart",
        cartId: "valid-c1",
        cartItemId: "valid-i1",
      })
    );
  });

  it("clearCart keeps cart intact and throws when release fails", async () => {
    const emit = vi.fn();
    const io = { to: vi.fn(() => ({ emit })) };
    const item = { _id: "valid-i1", menuItemId: "valid-m1", quantity: 2, price: 10, restaurantId: "valid-r1", servingKey: "large" };
    const cart = makeCart({ items: [item] });
    model.Cart.findOne.mockImplementation(() => sessionQuery(cart));
    inv.cancelReservationForOrderTx.mockRejectedValueOnce(new Error("release failed"));

    const m = (await import("../../graphql/resolvers/cart/mutation.js")).CartMutation;
    await expect(m.clearCart(null, { input: { cartId: "valid-c1" } }, { user: { id: "valid-u1" }, io })).rejects.toMatchObject({
      message: "Không thể xóa giỏ hàng vì không trả được nguyên liệu đã giữ. Vui lòng thử lại.",
    });

    expect(cart.items).toHaveLength(1);
    expect(cart.totalQuantity).toBe(2);
    expect(cart.totalAmount).toBe(20);
    expect(cart.save).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it("releaseMyCartHolds removes only released active items after exit release and applies abuse logic", async () => {
    const emit = vi.fn();
    const io = { to: vi.fn(() => ({ emit })) };
    const session = {
      withTransaction: vi.fn(async (fn) => {
        await fn();
        expect(emit).not.toHaveBeenCalled();
      }),
      endSession: vi.fn(),
    };
    mg.startSession.mockResolvedValue(session);

    const items = [
      { _id: "valid-i1", menuItemId: "valid-m1", quantity: 2, price: 10, restaurantId: "valid-r1", servingKey: "large", holdStatus: "active" },
      { _id: "valid-i2", menuItemId: "valid-m2", quantity: 1, price: 5, restaurantId: "valid-r1", servingKey: "portion", holdStatus: "released" },
    ];
    const cart = makeCart({ items, abuse: { exitReleaseCount: 2, timeoutReleaseCount: 0, warningCount: 0 } });
    model.Cart.findOne.mockImplementation(() => sessionQuery(cart));

    const m = (await import("../../graphql/resolvers/cart/mutation.js")).CartMutation;
    await expect(m.releaseMyCartHolds(null, { input: { reason: "exit" } }, { user: { id: "valid-u1" }, io })).resolves.toBe(true);

    expect(inv.cancelReservationForOrderTx).toHaveBeenCalledTimes(1);
    expect(inv.cancelReservationForOrderTx).toHaveBeenCalledWith(
      expect.objectContaining({
        orderCode: "CART:valid-c1:valid-i1",
        session,
        lines: [{ menuItemId: "valid-m1", quantity: 2, servingKey: "large" }],
      })
    );
    expect(cart.abuse.exitReleaseCount).toBe(3);
    expect(cart.abuse.warningCount).toBe(1);
    expect(cart.abuse.lastViolationAt).toBeInstanceOf(Date);
    expect(cart.items.map((item) => item._id)).toEqual(["valid-i2"]);
    expect(cart.totalQuantity).toBe(1);
    expect(cart.totalAmount).toBe(5);
    expect(cart.save).toHaveBeenCalledWith({ session });
    expect(emit).toHaveBeenCalledWith(
      "inventoryEvents",
      expect.objectContaining({
        type: "INVENTORY_RELEASED",
        servingVariantKey: "large",
        reason: "exit",
        cartId: "valid-c1",
        cartItemId: "valid-i1",
      })
    );
  });

  it("releaseMyCartHolds timeout only releases expired active items and keeps the rest", async () => {
    const now = new Date();
    const expired = new Date(now.getTime() - 60_000).toISOString();
    const future = new Date(now.getTime() + 60_000).toISOString();
    const emit = vi.fn();
    const io = { to: vi.fn(() => ({ emit })) };
    const item1 = { _id: "valid-i1", menuItemId: "valid-m1", quantity: 2, price: 10, restaurantId: "valid-r1", servingKey: "large", holdStatus: "active", holdExpiresAt: expired };
    const item2 = { _id: "valid-i2", menuItemId: "valid-m2", quantity: 1, price: 5, restaurantId: "valid-r1", servingKey: "portion", holdStatus: "active", holdExpiresAt: future };
    const item3 = { _id: "valid-i3", menuItemId: "valid-m3", quantity: 4, price: 3, restaurantId: "valid-r1", servingKey: "portion", holdStatus: "released", holdExpiresAt: expired };
    const cart = makeCart({ items: [item1, item2, item3], abuse: { exitReleaseCount: 1, timeoutReleaseCount: 1, warningCount: 0 } });
    model.Cart.findOne.mockImplementation(() => sessionQuery(cart));

    const m = (await import("../../graphql/resolvers/cart/mutation.js")).CartMutation;
    await expect(m.releaseMyCartHolds(null, { input: { reason: "timeout" } }, { user: { id: "valid-u1" }, io })).resolves.toBe(true);

    expect(inv.cancelReservationForOrderTx).toHaveBeenCalledTimes(1);
    expect(inv.cancelReservationForOrderTx).toHaveBeenCalledWith(
      expect.objectContaining({
        orderCode: "CART:valid-c1:valid-i1",
        lines: [{ menuItemId: "valid-m1", quantity: 2, servingKey: "large" }],
      })
    );
    expect(cart.abuse.timeoutReleaseCount).toBe(2);
    expect(cart.abuse.warningCount).toBe(1);
    expect(cart.items).toHaveLength(2);
    expect(cart.items.map((item) => item._id)).toEqual(["valid-i2", "valid-i3"]);
    expect(cart.totalQuantity).toBe(5);
    expect(cart.totalAmount).toBe(17);
    expect(cart.save).toHaveBeenCalled();
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith(
      "inventoryEvents",
      expect.objectContaining({
        reason: "timeout",
        cartId: "valid-c1",
        cartItemId: "valid-i1",
      })
    );
  });

  it("releaseMyCartHolds keeps cart intact and skips abuse updates when release fails", async () => {
    const emit = vi.fn();
    const io = { to: vi.fn(() => ({ emit })) };
    const item = { _id: "valid-i1", menuItemId: "valid-m1", quantity: 2, price: 10, restaurantId: "valid-r1", servingKey: "large" };
    const cart = makeCart({ items: [item], abuse: { exitReleaseCount: 2, timeoutReleaseCount: 1, warningCount: 0 } });
    model.Cart.findOne.mockImplementation(() => sessionQuery(cart));
    inv.cancelReservationForOrderTx.mockRejectedValueOnce(new Error("release failed"));

    const m = (await import("../../graphql/resolvers/cart/mutation.js")).CartMutation;
    await expect(m.releaseMyCartHolds(null, { input: { reason: "exit" } }, { user: { id: "valid-u1" }, io })).rejects.toMatchObject({
      message: "Không thể trả món đã giữ trong giỏ. Vui lòng thử lại.",
    });

    expect(cart.items).toHaveLength(1);
    expect(cart.totalQuantity).toBe(2);
    expect(cart.totalAmount).toBe(20);
    expect(cart.abuse.exitReleaseCount).toBe(2);
    expect(cart.abuse.warningCount).toBe(0);
    expect(cart.abuse.lastViolationAt).toBeUndefined();
    expect(cart.save).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });
});