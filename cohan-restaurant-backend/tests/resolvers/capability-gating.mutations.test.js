import { beforeEach, describe, expect, it, vi } from "vitest";

const model = vi.hoisted(() => ({
  Cart: { findOne: vi.fn(), findById: vi.fn(), create: vi.fn() },
  Warehouse: { findOne: vi.fn() },
  MenuItem: { findById: vi.fn() },
  Menu: { findOne: vi.fn() },
  Restaurant: { findById: vi.fn() },
  Order: { create: vi.fn() },
  CheckoutSession: { findOne: vi.fn(), create: vi.fn() },
  User: { findById: vi.fn() },
  Reservation: { create: vi.fn() },
  Table: { findById: vi.fn() },
}));
const mg = vi.hoisted(() => ({ isValidObjectId: vi.fn(() => true), startSession: vi.fn(), Types: { ObjectId: vi.fn(() => "valid-id") } }));
const inv = vi.hoisted(() => ({ reserveForOrderTx: vi.fn(), cancelReservationForOrderTx: vi.fn() }));
const guards = vi.hoisted(() => ({ getPublicRestaurantOrThrow: vi.fn(), assertRestaurantCanOrder: vi.fn(), assertRestaurantCanReserve: vi.fn() }));

vi.mock("../../models/index.js", () => model);
vi.mock("mongoose", () => ({ default: mg }));
vi.mock("../../src/services/inventory.service.js", () => inv);
vi.mock("../../src/services/eventLog.service.js", () => ({ logObjectEvent: vi.fn() }));
vi.mock("../../src/services/menuAvailabilityWatch.service.js", () => ({ notifyAvailabilityWatchersForMenuItem: vi.fn(), publishMenuItemOutOfStock: vi.fn() }));
vi.mock("../../graphql/resolvers/shared/restaurantCapabilityGuards.js", () => guards);

const sessionQuery = (value) => ({ session: vi.fn().mockResolvedValue(value), lean: vi.fn().mockResolvedValue(value), sort: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(value), session: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(value) })) })) });

beforeEach(() => {
  vi.clearAllMocks();
  const session = { withTransaction: vi.fn(async (fn) => fn()), endSession: vi.fn() };
  mg.startSession.mockResolvedValue(session);
  model.Warehouse.findOne.mockReturnValue(sessionQuery({ _id: "wh1" }));
  model.MenuItem.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: "m1", restaurantId: "r1", status: "available", inventoryStatus: "IN_STOCK", menuId: "menu1" }) });
  model.Menu.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: "menu1", isActive: true }) });
  guards.getPublicRestaurantOrThrow.mockResolvedValue({ restaurant: { _id: "r1", name: "Test" }, availability: { canOrder: true } });
  guards.assertRestaurantCanOrder.mockImplementation((a) => { if (!a?.canOrder) throw new Error("blocked"); });
  guards.assertRestaurantCanReserve.mockImplementation((a) => { if (!a?.canReserve) throw new Error("reserve blocked"); });
});

describe("capability gating regressions", () => {
  it("addCartItem blocks inactive/publication/operational/closed-no-policy", async () => {
    const { CartMutation } = await import("../../graphql/resolvers/cart/mutation.js");
    for (const availability of [
      { canOrder: false, businessStatus: "inactive" },
      { canOrder: false, publicationStatus: "hidden" },
      { canOrder: false, publicationStatus: "draft" },
      { canOrder: false, operationalStatus: "paused" },
      { canOrder: false, operationalStatus: "maintenance" },
      { canOrder: false, operationalStatus: "holiday" },
      { canOrder: false, operationalStatus: "closed", orderPolicy: { allowWhenClosed: false } },
    ]) {
      guards.getPublicRestaurantOrThrow.mockResolvedValueOnce({ restaurant: { _id: "r1" }, availability });
      await expect(CartMutation.addCartItem(null, { input: { restaurantId: "r1", menuItemId: "m1", quantity: 1, name: "A", price: 1 } }, { user: { id: "u1" } })).rejects.toBeTruthy();
    }
  });

  it("addCartItem passes when closed + allowWhenClosed=true and blocks menu constraints", async () => {
    const { CartMutation } = await import("../../graphql/resolvers/cart/mutation.js");
    guards.getPublicRestaurantOrThrow.mockResolvedValueOnce({ restaurant: { _id: "r1" }, availability: { canOrder: true, operationalStatus: "closed", orderPolicy: { allowWhenClosed: true } } });
    model.Cart.findOne.mockReturnValue(sessionQuery({ _id: "c1", userId: "u1", status: "active", items: [], toObject: () => ({}), save: vi.fn() }));
    await CartMutation.addCartItem(null, { input: { restaurantId: "r1", menuItemId: "m1", quantity: 1, name: "A", price: 1 } }, { user: { id: "u1" } });

    model.MenuItem.findById.mockReturnValueOnce({ lean: vi.fn().mockResolvedValue({ _id: "m1", restaurantId: "other", status: "available", inventoryStatus: "IN_STOCK" }) });
    await expect(CartMutation.addCartItem(null, { input: { restaurantId: "r1", menuItemId: "m1", quantity: 1, name: "A", price: 1 } }, { user: { id: "u1" } })).rejects.toBeTruthy();
  });

  it("updateCartItem delta>0 blocked when canOrder=false, delta<0 still passes", async () => {
    const { CartMutation } = await import("../../graphql/resolvers/cart/mutation.js");
    const item = { _id: "i1", menuItemId: "m1", quantity: 2, restaurantId: "r1", servingVariantKey: "portion" };
    const cart = { _id: "c1", userId: "u1", status: "active", items: Object.assign([item], { id: vi.fn(() => item) }), save: vi.fn(), toObject: () => ({ items: [item] }) };
    model.Cart.findById.mockReturnValue(sessionQuery(cart));
    guards.getPublicRestaurantOrThrow.mockResolvedValueOnce({ restaurant: { _id: "r1" }, availability: { canOrder: false } });
    await expect(CartMutation.updateCartItem(null, { input: { cartId: "c1", itemId: "i1", quantity: 5 } }, { user: { id: "u1" } })).rejects.toBeTruthy();
    await expect(CartMutation.updateCartItem(null, { input: { cartId: "c1", itemId: "i1", quantity: 1 } }, { user: { id: "u1" } })).resolves.toBeTruthy();
    model.Cart.findById.mockResolvedValue(cart);
    item.remove = vi.fn();
    await expect(CartMutation.removeCartItem(null, { input: { cartId: "c1", itemId: "i1" } }, { user: { id: "u1" } })).resolves.toBeTruthy();
    model.Cart.findOne.mockReturnValue(sessionQuery(cart));
    await expect(CartMutation.clearCart(null, { input: { cartId: "c1" } }, { user: { id: "u1" } })).resolves.toBe(true);
  });


  it("addCartItem fails when menuItem status not available", async () => {
    const { CartMutation } = await import("../../graphql/resolvers/cart/mutation.js");
    model.MenuItem.findById.mockReturnValueOnce({ lean: vi.fn().mockResolvedValue({ _id: "m1", restaurantId: "r1", status: "unavailable", inventoryStatus: "IN_STOCK", menuId: "menu1" }) });
    await expect(CartMutation.addCartItem(null, { input: { restaurantId: "r1", menuItemId: "m1", quantity: 1, name: "A", price: 1 } }, { user: { id: "u1" } })).rejects.toBeTruthy();
  });

  it("addCartItem fails when inventoryStatus is OUT_OF_STOCK", async () => {
    const { CartMutation } = await import("../../graphql/resolvers/cart/mutation.js");
    model.MenuItem.findById.mockReturnValueOnce({ lean: vi.fn().mockResolvedValue({ _id: "m1", restaurantId: "r1", status: "available", inventoryStatus: "OUT_OF_STOCK", menuId: "menu1" }) });
    await expect(CartMutation.addCartItem(null, { input: { restaurantId: "r1", menuItemId: "m1", quantity: 1, name: "A", price: 1 } }, { user: { id: "u1" } })).rejects.toBeTruthy();
  });

  it("tính cọc bằng cọc bàn cộng đúng 50% tiền món", async () => {
    const { computeDeposit } = await import(
      "../../graphql/resolvers/reservation/mutation.js"
    );
    expect(
      computeDeposit({
        baseDeposit: 100000,
        linkedMenuSubtotal: 250000,
        menuDepositPercent: 50,
      }),
    ).toBe(225000);
    expect(
      computeDeposit({
        baseDeposit: 100000,
        linkedMenuSubtotal: 250000,
      }),
    ).toBe(225000);
  });

  it("addCartItem fails when menuId is not active", async () => {
    const { CartMutation } = await import("../../graphql/resolvers/cart/mutation.js");
    model.Menu.findOne.mockReturnValueOnce({ lean: vi.fn().mockResolvedValue(null) });
    await expect(CartMutation.addCartItem(null, { input: { restaurantId: "r1", menuItemId: "m1", quantity: 1, name: "A", price: 1 } }, { user: { id: "u1" } })).rejects.toBeTruthy();
  });

});
