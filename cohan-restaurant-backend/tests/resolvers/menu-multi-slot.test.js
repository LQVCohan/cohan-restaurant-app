import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Menu: {
    find: vi.fn(),
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    create: vi.fn(),
    collection: {},
  },
  MenuItem: { find: vi.fn(), create: vi.fn(), findById: vi.fn() },
  Recipe: { create: vi.fn() },
  Restaurant: { exists: vi.fn() },
  AuditLog: { create: vi.fn() },
}));

const permissionMocks = vi.hoisted(() => ({
  requireMenuPermission: vi.fn(),
  hasPermission: vi.fn(),
  requireRestaurantPermission: vi.fn(),
}));

const sessionMocks = vi.hoisted(() => ({
  withTransaction: vi.fn(async (callback) => callback()),
  endSession: vi.fn(),
}));

const mongooseMock = vi.hoisted(() => ({
  isValidObjectId: vi.fn((value) => String(value || "").startsWith("valid-")),
  startSession: vi.fn(async () => sessionMocks),
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../graphql/resolvers/menu/menuPermission.js", () => ({
  MENU_PERMISSION: {
    CREATE_MENU: ["menu.create"],
    UPDATE_MENU: ["menu.update"],
    CREATE_ITEM: ["menu.item.create"],
  },
  requireMenuPermission: permissionMocks.requireMenuPermission,
}));
vi.mock("../../graphql/resolvers/menu/mutation.js", () => ({
  MenuMutation: { createMenuItem: vi.fn() },
}));
vi.mock("../../graphql/resolvers/menu/query.js", () => ({
  MenuQuery: { menuItemsConnection: vi.fn() },
}));
vi.mock("../../src/services/auth/authorization.service.js", () => ({
  hasPermission: permissionMocks.hasPermission,
  requireRestaurantPermission: permissionMocks.requireRestaurantPermission,
}));
vi.mock("mongoose", () => ({ default: mongooseMock }));

describe("multiple menus per service slot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    modelMocks.Restaurant.exists.mockResolvedValue(true);
    permissionMocks.requireMenuPermission.mockResolvedValue(true);
    permissionMocks.hasPermission.mockResolvedValue(true);
    permissionMocks.requireRestaurantPermission.mockResolvedValue(true);
    modelMocks.AuditLog.create.mockResolvedValue({});
    modelMocks.Menu.create.mockImplementation(async (values) => ({
      _id: `valid-menu-${values.name}`,
      ...values,
      toObject: () => ({ _id: `valid-menu-${values.name}`, ...values }),
    }));
  });

  it("creates two independent menus in the same time slot", async () => {
    const { MenuMultiSlotMutation } = await import(
      "../../graphql/resolvers/menu/multiSlotMutation.js"
    );

    const common = {
      restaurantId: "valid-restaurant",
      timeSlot: "dinner",
      isActive: true,
    };
    const first = await MenuMultiSlotMutation.ensureMenu(
      null,
      { input: { ...common, name: "Menu VIP" } },
      { user: { id: "valid-user" } },
    );
    const second = await MenuMultiSlotMutation.ensureMenu(
      null,
      { input: { ...common, name: "Menu ăn chơi" } },
      { user: { id: "valid-user" } },
    );

    expect(first._id).not.toBe(second._id);
    expect(modelMocks.Menu.create).toHaveBeenCalledTimes(2);
    expect(modelMocks.Menu.findOneAndUpdate).not.toHaveBeenCalled();
    expect(modelMocks.Menu.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ timeSlot: "dinner", name: "Menu VIP" }),
    );
    expect(modelMocks.Menu.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ timeSlot: "dinner", name: "Menu ăn chơi" }),
    );
  });

  it("updates only the menu id selected by the manager", async () => {
    const { MenuMultiSlotMutation } = await import(
      "../../graphql/resolvers/menu/multiSlotMutation.js"
    );
    modelMocks.Menu.findOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: "valid-menu-vip",
        restaurantId: "valid-restaurant",
        timeSlot: "dinner",
        name: "Menu VIP",
      }),
    });
    modelMocks.Menu.findOneAndUpdate.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: "valid-menu-vip",
        name: "Menu VIP mới",
      }),
    });

    await MenuMultiSlotMutation.ensureMenu(
      null,
      {
        input: {
          id: "valid-menu-vip",
          restaurantId: "valid-restaurant",
          timeSlot: "dinner",
          name: "Menu VIP mới",
          isActive: true,
        },
      },
      { user: { id: "valid-user" } },
    );

    expect(modelMocks.Menu.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: "valid-menu-vip", restaurantId: "valid-restaurant" },
      expect.any(Object),
      expect.objectContaining({ new: true, runValidators: true }),
    );
  });

  it("requires menuId when a time slot contains multiple menus", async () => {
    const { MenuMultiSlotMutation } = await import(
      "../../graphql/resolvers/menu/multiSlotMutation.js"
    );
    modelMocks.Menu.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([
            { _id: "valid-menu-vip" },
            { _id: "valid-menu-casual" },
          ]),
        }),
      }),
    });

    await expect(
      MenuMultiSlotMutation.createMenuItem(
        null,
        {
          input: {
            restaurantId: "valid-restaurant",
            timeSlot: "dinner",
            categoryId: "valid-category",
            name: "Bò sốt vang",
          },
        },
        { user: { id: "valid-user" } },
      ),
    ).rejects.toThrow("Vui lòng chọn menuId");
  });

  it("returns active named menus to customers without permission checks", async () => {
    const { MenuMultiSlotQuery } = await import(
      "../../graphql/resolvers/menu/multiSlotQuery.js"
    );
    const lean = vi.fn().mockResolvedValue([
      { _id: "valid-menu-vip", name: "Menu VIP", isActive: true },
      { _id: "valid-menu-casual", name: "Menu ăn chơi", isActive: true },
    ]);
    const sort = vi.fn().mockReturnValue({ lean });
    modelMocks.Menu.find.mockReturnValue({ sort });

    const rows = await MenuMultiSlotQuery.customerMenus(
      null,
      { restaurantId: "valid-restaurant" },
      { user: { id: "valid-manager" } },
    );

    expect(modelMocks.Menu.find).toHaveBeenCalledWith({
      restaurantId: "valid-restaurant",
      isActive: true,
    });
    expect(sort).toHaveBeenCalledWith({ timeSlot: 1, name: 1, _id: 1 });
    expect(permissionMocks.hasPermission).not.toHaveBeenCalled();
    expect(permissionMocks.requireRestaurantPermission).not.toHaveBeenCalled();
    expect(rows.map((menu) => menu.name)).toEqual(["Menu VIP", "Menu ăn chơi"]);
  });

  it("loads every menu in a slot but an exact menu when menuId is supplied", async () => {
    const { MenuMultiSlotQuery } = await import(
      "../../graphql/resolvers/menu/multiSlotQuery.js"
    );
    const menuLean = vi.fn().mockResolvedValue([
      { _id: "valid-menu-vip" },
      { _id: "valid-menu-casual" },
    ]);
    modelMocks.Menu.find.mockReturnValue({
      select: vi.fn().mockReturnValue({ lean: menuLean }),
    });
    const itemLean = vi.fn().mockResolvedValue([]);
    modelMocks.MenuItem.find.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({ lean: itemLean }),
      }),
    });

    await MenuMultiSlotQuery.menuItemsConnection(
      null,
      {
        filter: {
          restaurantId: "valid-restaurant",
          timeSlot: "dinner",
        },
      },
      { user: { id: "valid-user" } },
    );

    expect(modelMocks.Menu.find).toHaveBeenCalledWith({
      restaurantId: "valid-restaurant",
      timeSlot: "dinner",
    });
    expect(modelMocks.MenuItem.find).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: "valid-restaurant",
        menuId: { $in: ["valid-menu-vip", "valid-menu-casual"] },
      }),
    );
  });
});
