import { beforeEach, describe, expect, it, vi } from "vitest";

const model = vi.hoisted(() => ({
  Cart: { findOne: vi.fn(), find: vi.fn() },
  Warehouse: { findOne: vi.fn() },
}));
const inventory = vi.hoisted(() => ({
  checkAvailabilityForLinesTx: vi.fn(),
}));
const mongooseMock = vi.hoisted(() => ({
  isValidObjectId: vi.fn(() => true),
}));

vi.mock("../../models/index.js", () => model);
vi.mock("../../src/services/inventory.service.js", () => inventory);
vi.mock("mongoose", () => ({ default: mongooseMock }));

const { CartQuery } = await import("../../graphql/resolvers/cart/query.js");

const restaurantId = "507f1f77bcf86cd799439011";
const menuItemId = "507f1f77bcf86cd799439012";
const userId = "507f1f77bcf86cd799439013";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function selectLean(value) {
  return {
    select: vi.fn(() => ({ lean: vi.fn(() => value) })),
  };
}

function warehouseLean(value) {
  return {
    sort: vi.fn(() => ({ lean: vi.fn(() => value) })),
  };
}

describe("menuItemLiveState read optimization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    model.Cart.findOne.mockReturnValue(selectLean(Promise.resolve(null)));
    model.Cart.find.mockReturnValue(selectLean(Promise.resolve([])));
    model.Warehouse.findOne.mockReturnValue(
      warehouseLean(Promise.resolve({ _id: "507f1f77bcf86cd799439014" })),
    );
    inventory.checkAvailabilityForLinesTx.mockResolvedValue({
      isAvailable: true,
      maxAvailable: 8,
    });
  });

  it("shares the heavy availability and reserved-hold reads for concurrent viewers", async () => {
    const reserved = deferred();
    const availability = deferred();
    model.Cart.find.mockReturnValue(selectLean(reserved.promise));
    inventory.checkAvailabilityForLinesTx.mockReturnValue(availability.promise);

    const input = { restaurantId, menuItemId, servingVariantKey: "portion" };
    const first = CartQuery.menuItemLiveState(null, { input }, {});
    const second = CartQuery.menuItemLiveState(null, { input }, {});

    await vi.waitFor(() => {
      expect(model.Cart.find).toHaveBeenCalledTimes(1);
      expect(model.Warehouse.findOne).toHaveBeenCalledTimes(1);
      expect(inventory.checkAvailabilityForLinesTx).toHaveBeenCalledTimes(1);
    });

    reserved.resolve([]);
    availability.resolve({ isAvailable: true, maxAvailable: 8 });

    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(firstResult.maxAvailableQty).toBe(8);
    expect(secondResult.maxAvailableQty).toBe(8);
  });

  it("starts user cart, shared holds and availability work without waiting sequentially", async () => {
    const userCart = deferred();
    const reserved = deferred();
    const availability = deferred();
    model.Cart.findOne.mockReturnValue(selectLean(userCart.promise));
    model.Cart.find.mockReturnValue(selectLean(reserved.promise));
    inventory.checkAvailabilityForLinesTx.mockReturnValue(availability.promise);

    const pending = CartQuery.menuItemLiveState(
      null,
      {
        input: {
          restaurantId,
          menuItemId,
          servingVariantKey: "portion",
          userId,
        },
      },
      { user: { id: userId } },
    );

    await vi.waitFor(() => {
      expect(model.Cart.findOne).toHaveBeenCalledTimes(1);
      expect(model.Cart.find).toHaveBeenCalledTimes(1);
      expect(model.Warehouse.findOne).toHaveBeenCalledTimes(1);
      expect(inventory.checkAvailabilityForLinesTx).toHaveBeenCalledTimes(1);
    });

    userCart.resolve({ abuse: null, items: [] });
    reserved.resolve([]);
    availability.resolve({ isAvailable: true, maxAvailable: 5 });

    await expect(pending).resolves.toMatchObject({
      maxAvailableQty: 5,
      reservedCartQty: 0,
      myCartQty: 0,
    });
  });
});
