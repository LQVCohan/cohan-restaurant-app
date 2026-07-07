import mongoose from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CartModel from "../../models/cart.model.js";

const model = vi.hoisted(() => ({
  Cart: { findOne: vi.fn(), create: vi.fn(), findById: vi.fn() },
  Warehouse: { findOne: vi.fn() },
  MenuItem: { findById: vi.fn() },
  Menu: { findOne: vi.fn() },
  Combo: { findOne: vi.fn() },
}));
const inventory = vi.hoisted(() => ({
  reserveForOrderTx: vi.fn(),
  cancelReservationForOrderTx: vi.fn(),
}));
const availabilityWatch = vi.hoisted(() => ({
  publishMenuItemOutOfStock: vi.fn(),
  notifyAvailabilityWatchersForMenuItem: vi.fn(),
}));
const guards = vi.hoisted(() => ({
  getPublicRestaurantOrThrow: vi.fn(),
  assertRestaurantCanOrder: vi.fn(),
}));
const eventLog = vi.hoisted(() => ({ logObjectEvent: vi.fn() }));

vi.mock("../../models/index.js", () => model);
vi.mock("../../src/services/inventory.service.js", () => inventory);
vi.mock("../../src/services/menuAvailabilityWatch.service.js", () => availabilityWatch);
vi.mock("../../graphql/resolvers/shared/restaurantCapabilityGuards.js", () => guards);
vi.mock("../../src/services/eventLog.service.js", () => eventLog);

const { CartMutation } = await import("../../graphql/resolvers/cart/mutation.js");

const userId = "507f1f77bcf86cd799439011";
const secondUserId = "507f1f77bcf86cd799439012";
const restaurantId = "507f1f77bcf86cd799439013";
const menuItemId = "507f1f77bcf86cd799439014";
const menuId = "507f1f77bcf86cd799439015";
const warehouseId = "507f1f77bcf86cd799439016";

function queryLean(value) {
  return { lean: vi.fn().mockResolvedValue(value) };
}

function warehouseQuery(value) {
  return {
    sort: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(value) })),
  };
}

function makeCart(ownerId = userId) {
  const items = [];
  return {
    _id: new mongoose.Types.ObjectId(),
    userId: ownerId,
    status: "active",
    items,
    abuse: {},
    totalQuantity: 0,
    totalAmount: 0,
    restaurantId: null,
    lastActivityAt: null,
    save: vi.fn(async function save() {
      return this;
    }),
    toObject: vi.fn(function toObject() {
      return {
        _id: this._id,
        userId: this.userId,
        status: this.status,
        totalQuantity: this.totalQuantity,
        totalAmount: this.totalAmount,
        restaurantId: this.restaurantId,
        lastActivityAt: this.lastActivityAt,
        items: this.items.map((item) => ({ ...item })),
      };
    }),
  };
}

function sessionFor(workError = null) {
  return {
    withTransaction: vi.fn(async (work) => {
      if (workError) throw workError;
      return work();
    }),
    endSession: vi.fn().mockResolvedValue(undefined),
  };
}

function addInput(targetUserId = userId) {
  return {
    userId: targetUserId,
    restaurantId,
    menuItemId,
    quantity: 1,
    price: 10000,
    name: "Phở bò tái",
    servingVariantKey: "portion",
  };
}

describe("cart concurrency hardening", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();

    guards.getPublicRestaurantOrThrow.mockResolvedValue({
      availability: { canOrder: true },
    });
    guards.assertRestaurantCanOrder.mockReturnValue(undefined);
    model.Warehouse.findOne.mockReturnValue(
      warehouseQuery({ _id: warehouseId }),
    );
    model.MenuItem.findById.mockReturnValue(
      queryLean({
        _id: menuItemId,
        restaurantId,
        menuId,
        name: "Phở bò tái",
        basePrice: 10000,
        thumbImage: "/pho.jpg",
        status: "available",
        inventoryStatus: "IN_STOCK",
        servingVariants: [{ key: "portion", price: 10000 }],
      }),
    );
    model.Menu.findOne.mockReturnValue(
      queryLean({ _id: menuId, restaurantId, isActive: true }),
    );
    availabilityWatch.publishMenuItemOutOfStock.mockResolvedValue(null);
    availabilityWatch.notifyAvailabilityWatchersForMenuItem.mockResolvedValue(null);
    eventLog.logObjectEvent.mockResolvedValue(null);
    inventory.reserveForOrderTx.mockResolvedValue({ success: true });
    inventory.cancelReservationForOrderTx.mockResolvedValue({ success: true });

    vi.spyOn(mongoose, "startSession").mockImplementation(async () => sessionFor());
    model.Cart.findOne.mockImplementation(({ userId: ownerId }) => ({
      session: vi.fn().mockResolvedValue(makeCart(String(ownerId))),
    }));
  });

  it("defines one unique active cart per user while allowing historical carts", () => {
    const activeCartIndex = CartModel.schema
      .indexes()
      .find(([, options]) => options?.name === "uniq_active_cart_per_user");

    expect(activeCartIndex).toBeTruthy();
    expect(activeCartIndex[0]).toEqual({ userId: 1, status: 1 });
    expect(activeCartIndex[1]).toMatchObject({
      unique: true,
      partialFilterExpression: { status: "active" },
    });
  });

  it("maps only a real stock shortage to OUT_OF_STOCK and publishes the event", async () => {
    inventory.reserveForOrderTx.mockRejectedValueOnce(
      new Error("Insufficient available stock to reserve ingredient 507f1f77bcf86cd799439099"),
    );

    await expect(
      CartMutation.addCartItem(
        null,
        { input: addInput() },
        { user: { id: userId } },
      ),
    ).rejects.toMatchObject({ extensions: { code: "OUT_OF_STOCK" } });

    expect(availabilityWatch.publishMenuItemOutOfStock).toHaveBeenCalledTimes(1);
  });

  it("does not turn a technical reservation failure into a false stock-out", async () => {
    const technicalError = Object.assign(new Error("connection reset"), {
      code: 91,
    });
    inventory.reserveForOrderTx.mockRejectedValueOnce(technicalError);

    await expect(
      CartMutation.addCartItem(
        null,
        { input: addInput() },
        { user: { id: userId } },
      ),
    ).rejects.toBe(technicalError);

    expect(availabilityWatch.publishMenuItemOutOfStock).not.toHaveBeenCalled();
  });

  it("returns a retryable cart conflict for an escaped MongoDB write conflict", async () => {
    inventory.reserveForOrderTx.mockRejectedValueOnce(
      Object.assign(new Error("WriteConflict"), {
        code: 112,
        codeName: "WriteConflict",
      }),
    );

    await expect(
      CartMutation.addCartItem(
        null,
        { input: addInput() },
        { user: { id: userId } },
      ),
    ).rejects.toMatchObject({
      extensions: { code: "CART_CONFLICT_RETRY" },
    });

    expect(availabilityWatch.publishMenuItemOutOfStock).not.toHaveBeenCalled();
  });

  it("maps a simultaneous active-cart create collision to a retryable conflict", async () => {
    model.Cart.findOne.mockReturnValue({
      session: vi.fn().mockResolvedValue(null),
    });
    model.Cart.create.mockRejectedValueOnce(
      Object.assign(new Error("duplicate key"), {
        code: 11000,
        keyPattern: { userId: 1, status: 1 },
      }),
    );

    await expect(
      CartMutation.addCartItem(
        null,
        { input: addInput() },
        { user: { id: userId } },
      ),
    ).rejects.toMatchObject({
      extensions: { code: "CART_CONFLICT_RETRY" },
    });

    expect(inventory.reserveForOrderTx).not.toHaveBeenCalled();
    expect(availabilityWatch.publishMenuItemOutOfStock).not.toHaveBeenCalled();
  });

  it("allows only one winner when two users compete for the last unit", async () => {
    let reservationAttempt = 0;
    inventory.reserveForOrderTx.mockImplementation(async () => {
      reservationAttempt += 1;
      if (reservationAttempt === 1) return { success: true };
      throw new Error(
        "Insufficient available stock to reserve ingredient 507f1f77bcf86cd799439099",
      );
    });

    const results = await Promise.allSettled([
      CartMutation.addCartItem(
        null,
        { input: addInput(userId) },
        { user: { id: userId } },
      ),
      CartMutation.addCartItem(
        null,
        { input: addInput(secondUserId) },
        { user: { id: secondUserId } },
      ),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected?.reason?.extensions?.code).toBe("OUT_OF_STOCK");
    expect(availabilityWatch.publishMenuItemOutOfStock).toHaveBeenCalledTimes(1);
  });
});
