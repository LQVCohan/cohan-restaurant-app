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
  Types: { ObjectId: vi.fn((v) => v) },
}));

vi.mock("../../models/index.js", () => model);
vi.mock("../../src/services/inventory.service.js", () => inv);
vi.mock("../../src/services/eventLog.service.js", () => event);
vi.mock("mongoose", () => ({ default: mg }));

const leanChain = (val) => ({ lean: vi.fn().mockResolvedValue(val) });
const whChain = (val) => ({ sort: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(val) })) });

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
    model.Cart.findById.mockResolvedValue(cart);
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
});
