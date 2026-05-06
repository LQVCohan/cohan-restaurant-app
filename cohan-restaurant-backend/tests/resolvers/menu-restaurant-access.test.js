import { describe, it, expect, beforeEach, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Menu: { find: vi.fn(), findOne: vi.fn(), findOneAndUpdate: vi.fn() },
  MenuItem: {
    find: vi.fn(),
    countDocuments: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    findOneAndUpdate: vi.fn(),
    deleteOne: vi.fn(),
    bulkWrite: vi.fn(),
  },
  Category: { find: vi.fn() },
  Restaurant: { exists: vi.fn() },
  Recipe: { find: vi.fn(), deleteOne: vi.fn(), bulkWrite: vi.fn(), create: vi.fn() },
}));

const guardMocks = vi.hoisted(() => ({
  requireRestaurantAccess: vi.fn(),
  requireRoles: vi.fn(),
}));

const sessionMocks = vi.hoisted(() => ({
  endSession: vi.fn(),
  withTransaction: vi.fn(async (fn) => fn()),
}));

const mongooseMocks = vi.hoisted(() => ({
  isValidObjectId: vi.fn((v) => String(v).startsWith("valid-")),
  startSession: vi.fn(async () => sessionMocks),
  Types: { ObjectId: vi.fn((v) => v) },
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../graphql/guards.js", () => guardMocks);
vi.mock("mongoose", () => ({ default: mongooseMocks }));

describe("menu restaurant access guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guardMocks.requireRestaurantAccess.mockResolvedValue();
    modelMocks.Menu.find.mockReturnValue({ sort: () => ({ lean: vi.fn().mockResolvedValue([]) }), select: () => ({ lean: vi.fn().mockResolvedValue([]) }) });
    modelMocks.Menu.findOne.mockReturnValue({ select: () => ({ lean: vi.fn().mockResolvedValue({ _id: "valid-m1" }) }), lean: vi.fn().mockResolvedValue({ _id: "valid-m1" }) });
    modelMocks.Menu.findOneAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: "valid-m1" }) });
    modelMocks.MenuItem.find.mockReturnValue({ sort: () => ({ limit: () => ({ lean: vi.fn().mockResolvedValue([]) }) }), limit: () => ({ lean: vi.fn().mockResolvedValue([]) }), lean: vi.fn().mockResolvedValue([]), select: () => ({ lean: vi.fn().mockResolvedValue([]) }) });
    modelMocks.MenuItem.findById.mockReturnValue({ select: () => ({ lean: vi.fn().mockResolvedValue({ _id: "valid-mi1", restaurantId: "valid-r1" }) }), session: vi.fn() });
    modelMocks.MenuItem.findOneAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: "valid-mi1" }) });
    modelMocks.MenuItem.findByIdAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: "valid-mi1" }) });
    modelMocks.Restaurant.exists.mockResolvedValue(true);
    modelMocks.Recipe.find.mockResolvedValue([]);
  });

  it("menus denied does not call Menu.find", async () => {
    const query = (await import("../../graphql/resolvers/menu/query.js")).MenuQuery;
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
    await expect(query.menus(null, { restaurantId: "valid-r1" }, {})).rejects.toThrow();
    expect(modelMocks.Menu.find).not.toHaveBeenCalled();
  });

  it("menuItems denied does not call Menu.findOne or MenuItem.find", async () => {
    const query = (await import("../../graphql/resolvers/menu/query.js")).MenuQuery;
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
    await expect(query.menuItems(null, { restaurantId: "valid-r1", timeSlot: "lunch" }, {})).rejects.toThrow();
    expect(modelMocks.Menu.findOne).not.toHaveBeenCalled();
    expect(modelMocks.MenuItem.find).not.toHaveBeenCalled();
  });

  it("menuItemsConnection denied does not call Menu/MenuItem queries", async () => {
    const query = (await import("../../graphql/resolvers/menu/query.js")).MenuQuery;
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
    await expect(query.menuItemsConnection(null, { filter: { restaurantId: "valid-r1" } }, {})).rejects.toThrow();
    expect(modelMocks.Menu.findOne).not.toHaveBeenCalled();
    expect(modelMocks.MenuItem.find).not.toHaveBeenCalled();
  });

  it("topMenuItems without restaurantId calls requireRoles([ADMIN])", async () => {
    const query = (await import("../../graphql/resolvers/menu/query.js")).MenuQuery;
    await query.topMenuItems(null, { limit: 5 }, {});
    expect(guardMocks.requireRoles).toHaveBeenCalledWith({}, ["ADMIN"]);
  });

  it("ensureMenu denied does not call Restaurant.exists or Menu.findOneAndUpdate", async () => {
    const mutation = (await import("../../graphql/resolvers/menu/mutation.js")).MenuMutation;
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
    await expect(mutation.ensureMenu(null, { input: { restaurantId: "valid-r1", timeSlot: "lunch" } }, {})).rejects.toThrow();
    expect(modelMocks.Restaurant.exists).not.toHaveBeenCalled();
    expect(modelMocks.Menu.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("createMenuItem denied before startSession/writes", async () => {
    const mutation = (await import("../../graphql/resolvers/menu/mutation.js")).MenuMutation;
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
    await expect(mutation.createMenuItem(null, { input: { restaurantId: "valid-r1", categoryId: "valid-c1", timeSlot: "lunch", name: "A" } }, {})).rejects.toThrow();
    expect(mongooseMocks.startSession).not.toHaveBeenCalled();
    expect(modelMocks.Menu.findOneAndUpdate).not.toHaveBeenCalled();
    expect(modelMocks.Recipe.create).not.toHaveBeenCalled();
  });

  it("updateMenuItem denied after loading existing does not startSession", async () => {
    const mutation = (await import("../../graphql/resolvers/menu/mutation.js")).MenuMutation;
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
    await expect(mutation.updateMenuItem(null, { input: { id: "valid-mi1" } }, {})).rejects.toThrow();
    expect(modelMocks.MenuItem.findById).toHaveBeenCalledWith("valid-mi1");
    expect(mongooseMocks.startSession).not.toHaveBeenCalled();
  });

  it("deleteMenuItem denied after loading existing does not startSession", async () => {
    const mutation = (await import("../../graphql/resolvers/menu/mutation.js")).MenuMutation;
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
    await expect(mutation.deleteMenuItem(null, { id: "valid-mi1" }, {})).rejects.toThrow();
    expect(modelMocks.MenuItem.findById).toHaveBeenCalledWith("valid-mi1");
    expect(mongooseMocks.startSession).not.toHaveBeenCalled();
  });

  it("updateMenuItemBasic denied does not call MenuItem.findOneAndUpdate", async () => {
    const mutation = (await import("../../graphql/resolvers/menu/mutation.js")).MenuMutation;
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
    await expect(mutation.updateMenuItemBasic(null, { input: { restaurantId: "valid-r1", menuItemId: "valid-mi1" } }, {})).rejects.toThrow();
    expect(modelMocks.MenuItem.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("toggleMenuItemStatus denied does not call findByIdAndUpdate", async () => {
    const mutation = (await import("../../graphql/resolvers/menu/mutation.js")).MenuMutation;
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
    await expect(mutation.toggleMenuItemStatus(null, { id: "valid-mi1", status: "available" }, {})).rejects.toThrow();
    expect(modelMocks.MenuItem.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it("bulkUpdateMenuItemPrices denied does not call Menu/MenuItem/Recipe queries", async () => {
    const mutation = (await import("../../graphql/resolvers/menu/mutation.js")).MenuMutation;
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
    await expect(mutation.bulkUpdateMenuItemPrices(null, { input: { restaurantId: "valid-r1", target: { categoryId: "valid-c1" }, mode: "AMOUNT", value: 1 } }, {})).rejects.toThrow();
    expect(modelMocks.Menu.findOne).not.toHaveBeenCalled();
    expect(modelMocks.MenuItem.find).not.toHaveBeenCalled();
    expect(modelMocks.Recipe.find).not.toHaveBeenCalled();
  });
});
