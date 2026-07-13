import { beforeEach, describe, expect, it, vi } from "vitest";

const model = vi.hoisted(() => ({
  Cart: { findOne: vi.fn(), find: vi.fn() },
}));
const modifierSelection = vi.hoisted(() => ({
  resolveCustomerModifierSelection: vi.fn(),
}));
const availability = vi.hoisted(() => ({
  getMenuItemVariantAvailability: vi.fn(),
}));
const mongooseMock = vi.hoisted(() => ({
  isValidObjectId: vi.fn(() => true),
}));

vi.mock("../../models/index.js", () => model);
vi.mock(
  "../../src/services/customerModifierSelection.service.js",
  () => modifierSelection,
);
vi.mock(
  "../../src/services/menuItemAvailability.service.js",
  () => availability,
);
vi.mock("mongoose", () => ({ default: mongooseMock }));

const { CustomerCartQuery } = await import(
  "../../graphql/resolvers/cart/customerQuery.js"
);

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

describe("active menuItemLiveState read optimization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    model.Cart.findOne.mockReturnValue(selectLean(Promise.resolve(null)));
    model.Cart.find.mockReturnValue(selectLean(Promise.resolve([])));
    modifierSelection.resolveCustomerModifierSelection.mockResolvedValue({
      selectionKey: "",
    });
    availability.getMenuItemVariantAvailability.mockResolvedValue({
      isAvailable: true,
      maxAvailable: 8,
    });
  });

  it("shares availability and reserved-hold reads for concurrent identical viewers", async () => {
    const reserved = deferred();
    const stock = deferred();
    model.Cart.find.mockReturnValue(selectLean(reserved.promise));
    availability.getMenuItemVariantAvailability.mockReturnValue(stock.promise);

    const input = {
      restaurantId,
      menuItemId,
      servingVariantKey: "portion",
      selectedModifiers: [],
    };
    const first = CustomerCartQuery.menuItemLiveState(null, { input }, {});
    const second = CustomerCartQuery.menuItemLiveState(null, { input }, {});

    await vi.waitFor(() => {
      expect(model.Cart.find).toHaveBeenCalledTimes(1);
      expect(
        availability.getMenuItemVariantAvailability,
      ).toHaveBeenCalledTimes(1);
    });

    reserved.resolve([]);
    stock.resolve({ isAvailable: true, maxAvailable: 8 });

    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(firstResult).toMatchObject({
      itemType: "MENU_ITEM",
      maxAvailableQty: 8,
      reservedCartQty: 0,
    });
    expect(secondResult).toMatchObject({
      itemType: "MENU_ITEM",
      maxAvailableQty: 8,
      reservedCartQty: 0,
    });
  });

  it("starts user cart, modifier and availability work without waiting sequentially", async () => {
    const userCart = deferred();
    const modifiers = deferred();
    const stock = deferred();
    model.Cart.findOne.mockReturnValue(selectLean(userCart.promise));
    modifierSelection.resolveCustomerModifierSelection.mockReturnValue(
      modifiers.promise,
    );
    availability.getMenuItemVariantAvailability.mockReturnValue(stock.promise);

    const pending = CustomerCartQuery.menuItemLiveState(
      null,
      {
        input: {
          restaurantId,
          menuItemId,
          servingVariantKey: "portion",
          selectedModifiers: [],
          userId,
        },
      },
      { user: { id: userId } },
    );

    await vi.waitFor(() => {
      expect(model.Cart.findOne).toHaveBeenCalledTimes(1);
      expect(
        modifierSelection.resolveCustomerModifierSelection,
      ).toHaveBeenCalledTimes(1);
      expect(
        availability.getMenuItemVariantAvailability,
      ).toHaveBeenCalledTimes(1);
      expect(model.Cart.find).not.toHaveBeenCalled();
    });

    modifiers.resolve({ selectionKey: "" });
    await vi.waitFor(() => expect(model.Cart.find).toHaveBeenCalledTimes(1));

    userCart.resolve({ abuse: null, items: [] });
    stock.resolve({ isAvailable: true, maxAvailable: 5 });

    await expect(pending).resolves.toMatchObject({
      itemType: "MENU_ITEM",
      maxAvailableQty: 5,
      reservedCartQty: 0,
      myCartQty: 0,
    });
  });

  it("does not share reserved-hold reads across different modifier selections", async () => {
    const firstReserved = deferred();
    const secondReserved = deferred();
    model.Cart.find
      .mockReturnValueOnce(selectLean(firstReserved.promise))
      .mockReturnValueOnce(selectLean(secondReserved.promise));
    modifierSelection.resolveCustomerModifierSelection.mockImplementation(
      async ({ selectedModifiers }) => ({
        selectionKey: selectedModifiers[0]?.optionId || "",
      }),
    );

    const first = CustomerCartQuery.menuItemLiveState(
      null,
      {
        input: {
          restaurantId,
          menuItemId,
          servingVariantKey: "portion",
          selectedModifiers: [{ groupId: "g1", optionId: "mild" }],
        },
      },
      {},
    );
    const second = CustomerCartQuery.menuItemLiveState(
      null,
      {
        input: {
          restaurantId,
          menuItemId,
          servingVariantKey: "portion",
          selectedModifiers: [{ groupId: "g1", optionId: "spicy" }],
        },
      },
      {},
    );

    await vi.waitFor(() => {
      expect(model.Cart.find).toHaveBeenCalledTimes(2);
      expect(
        availability.getMenuItemVariantAvailability,
      ).toHaveBeenCalledTimes(1);
    });

    firstReserved.resolve([]);
    secondReserved.resolve([]);
    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
  });

  it("performs a fresh read after an in-flight request completes", async () => {
    const input = {
      restaurantId,
      menuItemId,
      servingVariantKey: "portion",
      selectedModifiers: [],
    };

    await CustomerCartQuery.menuItemLiveState(null, { input }, {});
    await CustomerCartQuery.menuItemLiveState(null, { input }, {});

    expect(model.Cart.find).toHaveBeenCalledTimes(2);
    expect(availability.getMenuItemVariantAvailability).toHaveBeenCalledTimes(2);
  });

  it("rejects unsupported item types before starting stock reads", async () => {
    await expect(
      CustomerCartQuery.menuItemLiveState(
        null,
        {
          input: {
            itemType: "COMBO",
            restaurantId,
            menuItemId,
            servingVariantKey: "portion",
          },
        },
        {},
      ),
    ).rejects.toThrow("Unsupported itemType");

    expect(model.Cart.find).not.toHaveBeenCalled();
    expect(
      availability.getMenuItemVariantAvailability,
    ).not.toHaveBeenCalled();
  });
});
