import { GraphQLError } from "graphql";

const modelMocks = vi.hoisted(() => ({
  User: { findById: vi.fn() },
  Role: { findById: vi.fn() },
  Restaurant: {
    findById: vi.fn(),
    deleteOne: vi.fn(),
    exists: vi.fn(),
    create: vi.fn(),
  },
  RestaurantCategoryIndex: { findOneAndUpdate: vi.fn() },
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: vi.fn((id) => /^valid-/.test(String(id))),
    Types: { ObjectId: vi.fn((id) => ({ _mockObjectId: String(id) })) },
  },
}));

const ctxFor = (roleName, id) => ({ user: { roleName, id } });

describe("restaurant mutation access hardening", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("updateRestaurant denies manager for another restaurant before save", async () => {
    const save = vi.fn();
    modelMocks.Restaurant.findById.mockResolvedValue({ managerId: "manager-owner", save, toObject: vi.fn() });

    const { RestaurantMutation } = await import("../../graphql/resolvers/restaurant/mutation.js");
    await expect(
      RestaurantMutation.updateRestaurant(null, { id: "valid-r1", input: { name: "New" } }, ctxFor("manager", "manager-other")),
    ).rejects.toThrow("You can only modify your own restaurant");

    expect(save).not.toHaveBeenCalled();
  });

  it("updateRestaurant allows manager owner", async () => {
    const save = vi.fn(async () => {});
    const resultObj = { _id: "valid-r1", name: "New Name" };
    modelMocks.Restaurant.findById.mockResolvedValue({ managerId: "manager-1", save, toObject: vi.fn(() => resultObj) });

    const { RestaurantMutation } = await import("../../graphql/resolvers/restaurant/mutation.js");
    const result = await RestaurantMutation.updateRestaurant(
      null,
      { id: "valid-r1", input: { name: "New Name" } },
      ctxFor("manager", "manager-1"),
    );

    expect(save).toHaveBeenCalled();
    expect(result).toEqual(resultObj);
  });

  it("updateRestaurant allows admin regardless of managerId", async () => {
    const save = vi.fn(async () => {});
    modelMocks.Restaurant.findById.mockResolvedValue({ managerId: "manager-1", save, toObject: vi.fn(() => ({ _id: "valid-r1" })) });

    const { RestaurantMutation } = await import("../../graphql/resolvers/restaurant/mutation.js");
    await RestaurantMutation.updateRestaurant(null, { id: "valid-r1", input: { name: "N" } }, ctxFor("admin", "admin-1"));

    expect(save).toHaveBeenCalled();
  });

  it("deleteRestaurant denies manager for another restaurant before deleteOne", async () => {
    modelMocks.Restaurant.findById.mockResolvedValue({ managerId: "manager-owner" });
    const { RestaurantMutation } = await import("../../graphql/resolvers/restaurant/mutation.js");

    await expect(
      RestaurantMutation.deleteRestaurant(null, { id: "valid-r1" }, ctxFor("manager", "manager-other")),
    ).rejects.toThrow("You can only modify your own restaurant");

    expect(modelMocks.Restaurant.deleteOne).not.toHaveBeenCalled();
  });

  it("deleteRestaurant allows manager owner", async () => {
    modelMocks.Restaurant.findById.mockResolvedValue({ managerId: "manager-1" });
    modelMocks.Restaurant.deleteOne.mockResolvedValue({ deletedCount: 1 });

    const { RestaurantMutation } = await import("../../graphql/resolvers/restaurant/mutation.js");
    await RestaurantMutation.deleteRestaurant(null, { id: "valid-r1" }, ctxFor("manager", "manager-1"));

    expect(modelMocks.Restaurant.deleteOne).toHaveBeenCalledWith({ _id: { _mockObjectId: "valid-r1" } });
  });

  it("createRestaurant manager self-create uses user.id fallback", async () => {
    modelMocks.User.findById.mockReturnValue({ populate: async () => ({ _id: "valid-manager-1", role: { slug: "manager" } }) });
    modelMocks.Restaurant.exists.mockResolvedValue(false);
    modelMocks.Restaurant.create.mockResolvedValue({ toObject: () => ({ _id: "valid-r1" }) });

    const { RestaurantMutation } = await import("../../graphql/resolvers/restaurant/mutation.js");
    await RestaurantMutation.createRestaurant(
      null,
      { input: { name: "R1", phone: "090" } },
      { user: { id: "valid-manager-1", roleName: "manager" } },
    );

    expect(modelMocks.User.findById).toHaveBeenCalledWith({ _mockObjectId: "valid-manager-1" });
    expect(modelMocks.Restaurant.create).toHaveBeenCalledWith(
      expect.objectContaining({ managerId: { _mockObjectId: "valid-manager-1" } }),
    );
  });

  it("createRestaurant denies non-admin/non-manager", async () => {
    const { RestaurantMutation } = await import("../../graphql/resolvers/restaurant/mutation.js");

    await expect(
      RestaurantMutation.createRestaurant(null, { input: { name: "R1" } }, ctxFor("staff", "valid-staff-1")),
    ).rejects.toThrow("Insufficient permission");

    expect(modelMocks.User.findById).not.toHaveBeenCalled();
    expect(modelMocks.Restaurant.create).not.toHaveBeenCalled();
  });

  it("updateRestaurantManager is admin-only", async () => {
    const { RestaurantMutation } = await import("../../graphql/resolvers/restaurant/mutation.js");
    await expect(
      RestaurantMutation.updateRestaurantManager(
        null,
        { input: { restaurantId: "valid-r1", managerId: "valid-manager-1" } },
        ctxFor("manager", "manager-1"),
      ),
    ).rejects.toThrow("Admin only");

    expect(modelMocks.Restaurant.findById).not.toHaveBeenCalled();
  });

  it("updateRestaurantCategoryIndex denies unrelated manager before upsert", async () => {
    modelMocks.Restaurant.findById.mockResolvedValue({ managerId: "manager-owner" });
    const { RestaurantMutation } = await import("../../graphql/resolvers/restaurant/mutation.js");

    await expect(
      RestaurantMutation.updateRestaurantCategoryIndex(
        null,
        { input: { restaurantId: "valid-r1", timeSlot: "MORNING", categoryIds: ["valid-c1"] } },
        ctxFor("manager", "manager-other"),
      ),
    ).rejects.toThrow("You can only modify your own restaurant");

    expect(modelMocks.RestaurantCategoryIndex.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("updateRestaurantCategoryIndex allows manager owner", async () => {
    modelMocks.Restaurant.findById.mockResolvedValue({ managerId: "manager-1" });
    modelMocks.RestaurantCategoryIndex.findOneAndUpdate.mockReturnValue({ lean: async () => ({ ok: 1 }) });

    const { RestaurantMutation } = await import("../../graphql/resolvers/restaurant/mutation.js");
    await RestaurantMutation.updateRestaurantCategoryIndex(
      null,
      { input: { restaurantId: "valid-r1", timeSlot: "MORNING", categoryIds: ["valid-c1", "valid-c1"] } },
      ctxFor("manager", "manager-1"),
    );

    expect(modelMocks.RestaurantCategoryIndex.findOneAndUpdate).toHaveBeenCalled();
  });

  it("updateRestaurantCategoryIndex allows admin", async () => {
    modelMocks.Restaurant.findById.mockResolvedValue({ managerId: "manager-1" });
    modelMocks.RestaurantCategoryIndex.findOneAndUpdate.mockReturnValue({ lean: async () => ({ ok: 1 }) });

    const { RestaurantMutation } = await import("../../graphql/resolvers/restaurant/mutation.js");
    await RestaurantMutation.updateRestaurantCategoryIndex(
      null,
      { input: { restaurantId: "valid-r1", timeSlot: "EVENING", categoryIds: ["valid-c2"] } },
      ctxFor("admin", "admin-1"),
    );

    expect(modelMocks.RestaurantCategoryIndex.findOneAndUpdate).toHaveBeenCalled();
  });

  it("source no longer contains updateRestaurant debug console log", async () => {
    const mod = await import("../../graphql/resolvers/restaurant/mutation.js");
    expect(mod.RestaurantMutation.updateRestaurant.toString()).not.toContain("console.log(doc)");
  });
});
