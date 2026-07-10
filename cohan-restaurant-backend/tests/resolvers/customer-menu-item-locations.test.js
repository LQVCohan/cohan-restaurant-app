import { beforeEach, describe, expect, it, vi } from "vitest";

const models = vi.hoisted(() => ({
  Menu: { find: vi.fn() },
  MenuItem: { findOne: vi.fn(), find: vi.fn() },
  Restaurant: { find: vi.fn() },
}));
const availability = vi.hoisted(() => ({ computeRestaurantAvailability: vi.fn() }));
const inventory = vi.hoisted(() => ({ getMenuItemInventoryAvailability: vi.fn() }));

vi.mock("../../models/index.js", () => models);
vi.mock("../../src/services/restaurantAvailability.service.js", () => availability);
vi.mock("../../src/services/menuItemAvailability.service.js", () => inventory);

const sourceId = "507f1f77bcf86cd799439011";
const stockedId = "507f1f77bcf86cd799439012";
const restaurantA = "507f1f77bcf86cd799439021";
const restaurantB = "507f1f77bcf86cd799439022";
const menuA = "507f1f77bcf86cd799439031";
const menuB = "507f1f77bcf86cd799439032";

const lean = (value) => ({ lean: vi.fn().mockResolvedValue(value) });
const limited = (value) => ({
  limit: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(value) })),
});
const selected = (value) => ({
  select: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(value) })),
});

const { CustomerMenuLocationQuery } = await import(
  "../../graphql/resolvers/menu/customerLocationQuery.js"
);

describe("customerMenuItemLocations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    models.MenuItem.findOne.mockReturnValue(
      lean({
        _id: sourceId,
        restaurantId: restaurantA,
        menuId: menuA,
        code: "PHO-BO",
        name: "Phở bò",
        status: "available",
      }),
    );
    models.MenuItem.find.mockReturnValue(
      limited([
        {
          _id: sourceId,
          restaurantId: restaurantA,
          menuId: menuA,
          code: "PHO-BO",
          name: "Phở bò",
          status: "available",
        },
        {
          _id: stockedId,
          restaurantId: restaurantB,
          menuId: menuB,
          code: "PHO-BO",
          name: "Phở bò",
          status: "available",
        },
      ]),
    );
    models.Menu.find.mockReturnValue(selected([{ _id: menuA }, { _id: menuB }]));
    models.Restaurant.find.mockReturnValue(
      selected([
        { _id: restaurantA, name: "Nhà hàng A" },
        { _id: restaurantB, name: "Nhà hàng B" },
      ]),
    );
    availability.computeRestaurantAvailability.mockImplementation((restaurant) => ({
      businessStatus: "active",
      publicationStatus: "published",
      canOrder: String(restaurant._id) === restaurantB,
    }));
    inventory.getMenuItemInventoryAvailability.mockImplementation(
      async ({ menuItemId }) =>
        String(menuItemId) === stockedId
          ? { inventoryStatus: "IN_STOCK", maxAvailable: 20, stockWarnings: [] }
          : { inventoryStatus: "OUT_OF_STOCK", maxAvailable: 0, stockWarnings: [] },
    );
  });

  it("prioritizes the restaurant that accepts orders and has stock", async () => {
    const result = await CustomerMenuLocationQuery.customerMenuItemLocations(
      null,
      { menuItemId: sourceId },
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      restaurantId: restaurantB,
      menuItemId: stockedId,
      maxAvailable: 20,
      isAvailable: true,
    });
    expect(result[1]).toMatchObject({
      restaurantId: restaurantA,
      menuItemId: sourceId,
      maxAvailable: 0,
      isAvailable: false,
    });
  });

  it("uses exact name and shared code as the cross-restaurant identity", async () => {
    await CustomerMenuLocationQuery.customerMenuItemLocations(null, {
      menuItemId: sourceId,
    });

    expect(models.MenuItem.find).toHaveBeenCalledWith(
      expect.objectContaining({
        $or: expect.arrayContaining([
          { code: "PHO-BO" },
          expect.objectContaining({ name: expect.any(RegExp) }),
        ]),
      }),
    );
  });
});
