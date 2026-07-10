import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Category: { find: vi.fn(), findOne: vi.fn() },
  Menu: { find: vi.fn(), findOne: vi.fn() },
  MenuItem: { find: vi.fn(), findOne: vi.fn() },
  Restaurant: { find: vi.fn(), findById: vi.fn() },
}));

const authorizationMocks = vi.hoisted(() => ({
  hasPermission: vi.fn(),
  requireRestaurantPermission: vi.fn(),
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/auth/authorization.service.js", () => authorizationMocks);
vi.mock("../../src/services/restaurantAvailability.service.js", () => ({
  computeRestaurantAvailability: vi.fn(() => ({ canOrder: true })),
}));
vi.mock("../../src/constants/permissions.js", () => ({
  PERMISSIONS: { MENU_READ: "menu.read" },
}));
vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: vi.fn((value) => String(value).startsWith("valid-")),
    Types: { ObjectId: vi.fn((value) => value) },
  },
}));

const buildMenuItemFindChain = (documents = []) => ({
  sort: vi.fn(() => ({
    limit: vi.fn(() => ({
      lean: vi.fn().mockResolvedValue(documents),
    })),
  })),
});

describe("manager menu item list visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    modelMocks.Menu.findOne.mockReturnValue({
      select: vi.fn(() => ({
        lean: vi.fn().mockResolvedValue({ _id: "valid-menu-1" }),
      })),
    });
    modelMocks.MenuItem.find.mockReturnValue(buildMenuItemFindChain([]));
    authorizationMocks.requireRestaurantPermission.mockResolvedValue(true);
  });

  it("returns all statuses for an authorized manager when no status filter is selected", async () => {
    authorizationMocks.hasPermission.mockResolvedValue(true);
    const { MenuQuery } = await import("../../graphql/resolvers/menu/query.js");

    await MenuQuery.menuItemsConnection(
      null,
      {
        filter: {
          restaurantId: "valid-r1",
          timeSlot: "breakfast",
          status: null,
          sort: "default",
        },
      },
      { user: { id: "valid-user-1" } },
    );

    expect(authorizationMocks.hasPermission).toHaveBeenCalledWith(
      { id: "valid-user-1" },
      "menu.read",
    );
    expect(authorizationMocks.requireRestaurantPermission).toHaveBeenCalledWith(
      { user: { id: "valid-user-1" } },
      "valid-r1",
      "menu.read",
    );
    expect(modelMocks.MenuItem.find).toHaveBeenCalledWith({
      restaurantId: "valid-r1",
      menuId: "valid-menu-1",
    });
  });

  it("keeps the public status restriction for unauthenticated browsing", async () => {
    const { MenuQuery } = await import("../../graphql/resolvers/menu/query.js");

    await MenuQuery.menuItemsConnection(
      null,
      {
        filter: {
          restaurantId: "valid-r1",
          timeSlot: "breakfast",
          status: null,
          sort: "default",
        },
      },
      {},
    );

    expect(authorizationMocks.hasPermission).not.toHaveBeenCalled();
    expect(authorizationMocks.requireRestaurantPermission).not.toHaveBeenCalled();
    expect(modelMocks.MenuItem.find).toHaveBeenCalledWith({
      restaurantId: "valid-r1",
      status: { $in: ["available", "out_of_stock"] },
      menuId: "valid-menu-1",
    });
  });
});
