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
  BrandMembership: { find: vi.fn() },
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: vi.fn((id) => /^valid-/.test(String(id))),
    Types: { ObjectId: function ObjectId(id) { return { _mockObjectId: String(id) }; } },
  },
}));

const ctxFor = (roleName, id) => ({ user: { roleName, id } });
const membershipFindResult = (rows = []) => ({ lean: vi.fn(async () => rows) });
const restaurantDoc = (overrides = {}) => ({
  _id: "valid-r1",
  brandId: "valid-b1",
  managerId: "valid-manager-1",
  ...overrides,
});

describe("restaurant mutation access hardening", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    modelMocks.BrandMembership.find.mockReturnValue(membershipFindResult([]));
  });

  it("updateRestaurant denies manager for another restaurant before save", async () => {
    const save = vi.fn();
    modelMocks.Restaurant.findById.mockResolvedValue(restaurantDoc({ save, toObject: vi.fn() }));
    modelMocks.BrandMembership.find.mockReturnValue(membershipFindResult([{ userId: "valid-manager-other", brandId: "valid-b1", role: "manager", status: "active", restaurantIds: ["valid-r2"] }]));

    const { RestaurantMutation } = await import("../../graphql/resolvers/restaurant/mutation.js");
    await expect(
      RestaurantMutation.updateRestaurant(null, { id: "valid-r1", input: { name: "New" } }, ctxFor("manager", "valid-manager-other")),
    ).rejects.toThrow("You can only modify restaurants in your BrandMembership scope");

    expect(save).not.toHaveBeenCalled();
  });

  it("updateRestaurant allows manager owner", async () => {
    const save = vi.fn(async () => {});
    const resultObj = { _id: "valid-r1", name: "New Name" };
    modelMocks.Restaurant.findById.mockResolvedValue(restaurantDoc({ save, toObject: vi.fn(() => resultObj) }));
    modelMocks.BrandMembership.find.mockReturnValue(membershipFindResult([{ userId: "valid-manager-1", brandId: "valid-b1", role: "manager", status: "active", restaurantIds: ["valid-r1"] }]));

    const { RestaurantMutation } = await import("../../graphql/resolvers/restaurant/mutation.js");
    const result = await RestaurantMutation.updateRestaurant(
      null,
      { id: "valid-r1", input: { name: "New Name" } },
      ctxFor("manager", "valid-manager-1"),
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

  it("updateRestaurant keeps a valid restaurant coordinate pair", async () => {
    const save = vi.fn(async () => {});
    const doc = {
      managerId: "manager-1",
      save,
      toObject: vi.fn(() => ({ _id: "valid-r1" })),
    };
    modelMocks.Restaurant.findById.mockResolvedValue(doc);

    const { RestaurantMutation } = await import("../../graphql/resolvers/restaurant/mutation.js");
    await RestaurantMutation.updateRestaurant(
      null,
      {
        id: "valid-r1",
        input: {
          address: {
            line1: "123 Existing Street",
            lat: 10.7769,
            lng: 106.7009,
          },
        },
      },
      ctxFor("admin", "admin-1"),
    );

    expect(doc.address).toEqual(
      expect.objectContaining({
        line1: "123 Existing Street",
        lat: 10.7769,
        lng: 106.7009,
      }),
    );
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("updateRestaurant rejects an incomplete coordinate pair before save", async () => {
    const save = vi.fn(async () => {});
    modelMocks.Restaurant.findById.mockResolvedValue({
      managerId: "manager-1",
      save,
      toObject: vi.fn(() => ({ _id: "valid-r1" })),
    });

    const { RestaurantMutation } = await import("../../graphql/resolvers/restaurant/mutation.js");
    await expect(
      RestaurantMutation.updateRestaurant(
        null,
        { id: "valid-r1", input: { address: { lat: 10.7769 } } },
        ctxFor("admin", "admin-1"),
      ),
    ).rejects.toMatchObject({
      message: "Restaurant latitude and longitude must be provided together",
      extensions: { code: "BAD_USER_INPUT" },
    });
    expect(save).not.toHaveBeenCalled();
  });

  it("updateRestaurant rejects out-of-range coordinates before save", async () => {
    const save = vi.fn(async () => {});
    modelMocks.Restaurant.findById.mockResolvedValue({
      managerId: "manager-1",
      save,
      toObject: vi.fn(() => ({ _id: "valid-r1" })),
    });

    const { RestaurantMutation } = await import("../../graphql/resolvers/restaurant/mutation.js");
    await expect(
      RestaurantMutation.updateRestaurant(
        null,
        { id: "valid-r1", input: { address: { lat: 91, lng: 106.7009 } } },
        ctxFor("admin", "admin-1"),
      ),
    ).rejects.toMatchObject({
      message: "Restaurant coordinates are out of range",
      extensions: { code: "BAD_USER_INPUT" },
    });
    expect(save).not.toHaveBeenCalled();
  });

  it("deleteRestaurant denies manager for another restaurant before deleteOne", async () => {
    const { RestaurantMutation } = await import("../../graphql/resolvers/restaurant/mutation.js");

    await expect(
      RestaurantMutation.deleteRestaurant(null, { id: "valid-r1" }, ctxFor("manager", "manager-other")),
    ).rejects.toThrow("Admin only");

    expect(modelMocks.Restaurant.findById).not.toHaveBeenCalled();
    expect(modelMocks.Restaurant.deleteOne).not.toHaveBeenCalled();
  });

  it("deleteRestaurant allows admin", async () => {
    modelMocks.Restaurant.findById.mockResolvedValue({ managerId: "manager-1" });
    modelMocks.Restaurant.deleteOne.mockResolvedValue({ deletedCount: 1 });

    const { RestaurantMutation } = await import("../../graphql/resolvers/restaurant/mutation.js");
    await RestaurantMutation.deleteRestaurant(null, { id: "valid-r1" }, ctxFor("admin", "admin-1"));

    expect(modelMocks.Restaurant.deleteOne).toHaveBeenCalledWith({ _mockObjectId: "valid-r1" });
  });

  it("createRestaurant allows assigning one manager to many restaurants", async () => {
    modelMocks.User.findById.mockReturnValue({ populate: async () => ({ _id: "valid-manager-1", role: { slug: "manager" } }) });
    modelMocks.Restaurant.create
      .mockResolvedValueOnce({ toObject: () => ({ _id: "valid-r1" }) })
      .mockResolvedValueOnce({ toObject: () => ({ _id: "valid-r2" }) });

    const { RestaurantMutation } = await import("../../graphql/resolvers/restaurant/mutation.js");
    await RestaurantMutation.createRestaurant(
      null,
      { input: { name: "R1", phone: "090", managerId: "valid-manager-1" } },
      { user: { id: "valid-admin-1", roleName: "admin" } },
    );
    await RestaurantMutation.createRestaurant(
      null,
      { input: { name: "R2", phone: "091", managerId: "valid-manager-1" } },
      { user: { id: "valid-admin-1", roleName: "admin" } },
    );

    expect(modelMocks.User.findById).toHaveBeenCalledWith({ _mockObjectId: "valid-manager-1" });
    expect(modelMocks.Restaurant.create).toHaveBeenCalledTimes(2);
  });

  it("createRestaurant denies non-admin", async () => {
    const { RestaurantMutation } = await import("../../graphql/resolvers/restaurant/mutation.js");

    await expect(
      RestaurantMutation.createRestaurant(
        null,
        { input: { name: "R1", managerId: "valid-manager-1" } },
        ctxFor("manager", "valid-manager-1"),
      ),
    ).rejects.toThrow("Admin only");

    expect(modelMocks.User.findById).not.toHaveBeenCalled();
    expect(modelMocks.Restaurant.create).not.toHaveBeenCalled();
  });

  it("updateRestaurantManager is admin-only", async () => {
    const { RestaurantMutation } = await import("../../graphql/resolvers/restaurant/mutation.js");
    await expect(
      RestaurantMutation.updateRestaurantManager(
        null,
        { input: { restaurantId: "valid-r1", managerId: "valid-manager-1" } },
        ctxFor("manager", "valid-manager-1"),
      ),
    ).rejects.toThrow("Admin only");

    expect(modelMocks.Restaurant.findById).not.toHaveBeenCalled();
  });

  it("updateRestaurantManager allows manager already assigned elsewhere", async () => {
    const save = vi.fn(async () => {});
    modelMocks.Restaurant.findById.mockResolvedValue({ managerId: "valid-manager-old", save, toObject: vi.fn(() => ({ _id: "valid-r1" })) });
    modelMocks.User.findById.mockReturnValue({ populate: async () => ({ _id: "valid-manager-1", role: { slug: "manager" } }) });

    const { RestaurantMutation } = await import("../../graphql/resolvers/restaurant/mutation.js");
    const res = await RestaurantMutation.updateRestaurantManager(
      null,
      { input: { restaurantId: "valid-r1", managerId: "valid-manager-1" } },
      ctxFor("admin", "admin-1"),
    );

    expect(save).toHaveBeenCalled();
    expect(res).toEqual({ _id: "valid-r1" });
  });

  it("updateRestaurantCategoryIndex denies unrelated manager before upsert", async () => {
    modelMocks.Restaurant.findById.mockResolvedValue(restaurantDoc());
    modelMocks.BrandMembership.find.mockReturnValue(membershipFindResult([{ userId: "valid-manager-other", brandId: "valid-b1", role: "manager", status: "active", restaurantIds: ["valid-r2"] }]));
    const { RestaurantMutation } = await import("../../graphql/resolvers/restaurant/mutation.js");

    await expect(
      RestaurantMutation.updateRestaurantCategoryIndex(
        null,
        { input: { restaurantId: "valid-r1", timeSlot: "MORNING", categoryIds: ["valid-c1"] } },
        ctxFor("manager", "valid-manager-other"),
      ),
    ).rejects.toThrow("You can only modify restaurants in your BrandMembership scope");

    expect(modelMocks.RestaurantCategoryIndex.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("updateRestaurantCategoryIndex allows manager owner", async () => {
    modelMocks.Restaurant.findById.mockResolvedValue(restaurantDoc());
    modelMocks.BrandMembership.find.mockReturnValue(membershipFindResult([{ userId: "valid-manager-1", brandId: "valid-b1", role: "manager", status: "active", restaurantIds: ["valid-r1"] }]));
    modelMocks.RestaurantCategoryIndex.findOneAndUpdate.mockReturnValue({ lean: async () => ({ ok: 1 }) });

    const { RestaurantMutation } = await import("../../graphql/resolvers/restaurant/mutation.js");
    await RestaurantMutation.updateRestaurantCategoryIndex(
      null,
      { input: { restaurantId: "valid-r1", timeSlot: "MORNING", categoryIds: ["valid-c1", "valid-c1"] } },
      ctxFor("manager", "valid-manager-1"),
    );

    expect(modelMocks.RestaurantCategoryIndex.findOneAndUpdate).toHaveBeenCalled();
  });

  it("updateRestaurantCategoryIndex allows admin", async () => {
    modelMocks.Restaurant.findById.mockResolvedValue(restaurantDoc());
    modelMocks.BrandMembership.find.mockReturnValue(membershipFindResult([{ userId: "valid-manager-1", brandId: "valid-b1", role: "manager", status: "active", restaurantIds: ["valid-r1"] }]));
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
