const modelMocks = vi.hoisted(() => ({
  Restaurant: {
    findById: vi.fn(),
    deleteOne: vi.fn(),
    create: vi.fn(),
  },
  RestaurantCategoryIndex: { findOneAndUpdate: vi.fn() },
  BrandMembership: { find: vi.fn() },
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: vi.fn((id) => /^valid-/.test(String(id))),
    Types: {
      ObjectId: function ObjectId(id) {
        this._mockObjectId = String(id);
        this.toString = () => String(id);
      },
    },
  },
}));

const ctxFor = (roleName, id) => ({ user: { roleName, id } });
const membershipFindResult = (rows = []) => ({ lean: vi.fn(async () => rows) });
const restaurantDoc = (overrides = {}) => ({
  _id: "valid-r1",
  brandId: "valid-b1",
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
    modelMocks.BrandMembership.find.mockReturnValue(membershipFindResult([
      {
        userId: "valid-manager-other",
        brandId: "valid-b1",
        role: "manager",
        status: "active",
        restaurantIds: ["valid-r2"],
      },
    ]));

    const { RestaurantMutation } = await import("../../graphql/resolvers/restaurant/mutation.js");
    await expect(
      RestaurantMutation.updateRestaurant(
        null,
        { id: "valid-r1", input: { name: "New" } },
        ctxFor("manager", "valid-manager-other"),
      ),
    ).rejects.toThrow("You can only modify restaurants in your BrandMembership scope");

    expect(save).not.toHaveBeenCalled();
  });

  it("updateRestaurant allows an assigned Brand manager", async () => {
    const save = vi.fn(async () => {});
    const resultObj = { _id: "valid-r1", name: "New Name" };
    modelMocks.Restaurant.findById.mockResolvedValue(
      restaurantDoc({ save, toObject: vi.fn(() => resultObj) }),
    );
    modelMocks.BrandMembership.find.mockReturnValue(membershipFindResult([
      {
        userId: "valid-manager-1",
        brandId: "valid-b1",
        role: "manager",
        status: "active",
        restaurantIds: ["valid-r1"],
      },
    ]));

    const { RestaurantMutation } = await import("../../graphql/resolvers/restaurant/mutation.js");
    const result = await RestaurantMutation.updateRestaurant(
      null,
      { id: "valid-r1", input: { name: "New Name" } },
      ctxFor("manager", "valid-manager-1"),
    );

    expect(save).toHaveBeenCalled();
    expect(result).toEqual(resultObj);
  });

  it("updateRestaurant allows system admin without membership", async () => {
    const save = vi.fn(async () => {});
    modelMocks.Restaurant.findById.mockResolvedValue(
      restaurantDoc({ save, toObject: vi.fn(() => ({ _id: "valid-r1" })) }),
    );

    const { RestaurantMutation } = await import("../../graphql/resolvers/restaurant/mutation.js");
    await RestaurantMutation.updateRestaurant(
      null,
      { id: "valid-r1", input: { name: "N" } },
      ctxFor("admin", "valid-admin-1"),
    );

    expect(save).toHaveBeenCalled();
  });

  it("denies moving a restaurant when the caller owns only the source Brand", async () => {
    const save = vi.fn(async () => {});
    modelMocks.Restaurant.findById.mockResolvedValue(
      restaurantDoc({ save, toObject: vi.fn(() => ({ _id: "valid-r1" })) }),
    );
    modelMocks.BrandMembership.find.mockReturnValue(membershipFindResult([
      { brandId: "valid-b1", role: "owner", status: "active", restaurantIds: [] },
    ]));

    const { RestaurantMutation } = await import("../../graphql/resolvers/restaurant/mutation.js");
    await expect(
      RestaurantMutation.updateRestaurant(
        null,
        { id: "valid-r1", input: { brandId: "valid-b2" } },
        ctxFor("manager", "valid-owner-1"),
      ),
    ).rejects.toThrow("owner of both brands");
    expect(save).not.toHaveBeenCalled();
  });

  it("allows moving a restaurant when the caller owns source and target Brands", async () => {
    const save = vi.fn(async () => {});
    const doc = restaurantDoc({ save, toObject: vi.fn(() => ({ _id: "valid-r1" })) });
    modelMocks.Restaurant.findById.mockResolvedValue(doc);
    modelMocks.BrandMembership.find.mockReturnValue(membershipFindResult([
      { brandId: "valid-b1", role: "owner", status: "active", restaurantIds: [] },
      { brandId: "valid-b2", role: "owner", status: "active", restaurantIds: [] },
    ]));

    const { RestaurantMutation } = await import("../../graphql/resolvers/restaurant/mutation.js");
    await RestaurantMutation.updateRestaurant(
      null,
      { id: "valid-r1", input: { brandId: "valid-b2" } },
      ctxFor("manager", "valid-owner-1"),
    );

    expect(String(doc.brandId)).toBe("valid-b2");
    expect(save).toHaveBeenCalled();
  });

  it("updateRestaurant keeps a valid restaurant coordinate pair", async () => {
    const save = vi.fn(async () => {});
    const doc = restaurantDoc({
      save,
      toObject: vi.fn(() => ({ _id: "valid-r1" })),
    });
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
      ctxFor("admin", "valid-admin-1"),
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
    modelMocks.Restaurant.findById.mockResolvedValue(
      restaurantDoc({ save, toObject: vi.fn(() => ({ _id: "valid-r1" })) }),
    );

    const { RestaurantMutation } = await import("../../graphql/resolvers/restaurant/mutation.js");
    await expect(
      RestaurantMutation.updateRestaurant(
        null,
        { id: "valid-r1", input: { address: { lat: 10.7769 } } },
        ctxFor("admin", "valid-admin-1"),
      ),
    ).rejects.toMatchObject({
      message: "Restaurant latitude and longitude must be provided together",
      extensions: { code: "BAD_USER_INPUT" },
    });
    expect(save).not.toHaveBeenCalled();
  });

  it("updateRestaurant rejects out-of-range coordinates before save", async () => {
    const save = vi.fn(async () => {});
    modelMocks.Restaurant.findById.mockResolvedValue(
      restaurantDoc({ save, toObject: vi.fn(() => ({ _id: "valid-r1" })) }),
    );

    const { RestaurantMutation } = await import("../../graphql/resolvers/restaurant/mutation.js");
    await expect(
      RestaurantMutation.updateRestaurant(
        null,
        { id: "valid-r1", input: { address: { lat: 91, lng: 106.7009 } } },
        ctxFor("admin", "valid-admin-1"),
      ),
    ).rejects.toMatchObject({
      message: "Restaurant coordinates are out of range",
      extensions: { code: "BAD_USER_INPUT" },
    });
    expect(save).not.toHaveBeenCalled();
  });

  it("deleteRestaurant denies non-admin before database reads", async () => {
    const { RestaurantMutation } = await import("../../graphql/resolvers/restaurant/mutation.js");

    await expect(
      RestaurantMutation.deleteRestaurant(
        null,
        { id: "valid-r1" },
        ctxFor("manager", "valid-manager-other"),
      ),
    ).rejects.toThrow("Admin only");

    expect(modelMocks.Restaurant.findById).not.toHaveBeenCalled();
    expect(modelMocks.Restaurant.deleteOne).not.toHaveBeenCalled();
  });

  it("deleteRestaurant allows system admin", async () => {
    modelMocks.Restaurant.findById.mockResolvedValue(restaurantDoc());
    modelMocks.Restaurant.deleteOne.mockResolvedValue({ deletedCount: 1 });

    const { RestaurantMutation } = await import("../../graphql/resolvers/restaurant/mutation.js");
    await RestaurantMutation.deleteRestaurant(
      null,
      { id: "valid-r1" },
      ctxFor("admin", "valid-admin-1"),
    );

    expect(modelMocks.Restaurant.deleteOne).toHaveBeenCalledWith({
      _id: expect.objectContaining({ _mockObjectId: "valid-r1" }),
    });
  });

  it("createRestaurant allows a Brand owner and never writes managerId", async () => {
    modelMocks.BrandMembership.find.mockReturnValue(membershipFindResult([
      { brandId: "valid-b1", role: "owner", status: "active", restaurantIds: [] },
    ]));
    modelMocks.Restaurant.create.mockResolvedValue({
      toObject: () => ({ _id: "valid-r1" }),
    });

    const { RestaurantMutation } = await import("../../graphql/resolvers/restaurant/mutation.js");
    await RestaurantMutation.createRestaurant(
      null,
      { input: { name: "R1", phone: "090", brandId: "valid-b1" } },
      ctxFor("manager", "valid-owner-1"),
    );

    expect(modelMocks.Restaurant.create).toHaveBeenCalledWith(
      expect.not.objectContaining({ managerId: expect.anything() }),
    );
  });

  it("createRestaurant denies a non-admin without a manageable Brand", async () => {
    const { RestaurantMutation } = await import("../../graphql/resolvers/restaurant/mutation.js");

    await expect(
      RestaurantMutation.createRestaurant(
        null,
        { input: { name: "R1" } },
        ctxFor("manager", "valid-manager-1"),
      ),
    ).rejects.toThrow("Admin only");

    expect(modelMocks.Restaurant.create).not.toHaveBeenCalled();
  });

  it("does not export the legacy updateRestaurantManager mutation", async () => {
    const { RestaurantMutation } = await import("../../graphql/resolvers/restaurant/mutation.js");
    expect(RestaurantMutation).not.toHaveProperty("updateRestaurantManager");
  });

  it("updateRestaurantCategoryIndex denies unrelated manager before upsert", async () => {
    modelMocks.Restaurant.findById.mockResolvedValue(restaurantDoc());
    modelMocks.BrandMembership.find.mockReturnValue(membershipFindResult([
      {
        userId: "valid-manager-other",
        brandId: "valid-b1",
        role: "manager",
        status: "active",
        restaurantIds: ["valid-r2"],
      },
    ]));
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

  it("updateRestaurantCategoryIndex allows an assigned manager", async () => {
    modelMocks.Restaurant.findById.mockResolvedValue(restaurantDoc());
    modelMocks.BrandMembership.find.mockReturnValue(membershipFindResult([
      {
        userId: "valid-manager-1",
        brandId: "valid-b1",
        role: "manager",
        status: "active",
        restaurantIds: ["valid-r1"],
      },
    ]));
    modelMocks.RestaurantCategoryIndex.findOneAndUpdate.mockReturnValue({
      lean: async () => ({ ok: 1 }),
    });

    const { RestaurantMutation } = await import("../../graphql/resolvers/restaurant/mutation.js");
    await RestaurantMutation.updateRestaurantCategoryIndex(
      null,
      { input: { restaurantId: "valid-r1", timeSlot: "MORNING", categoryIds: ["valid-c1", "valid-c1"] } },
      ctxFor("manager", "valid-manager-1"),
    );

    expect(modelMocks.RestaurantCategoryIndex.findOneAndUpdate).toHaveBeenCalled();
  });

  it("updateRestaurantCategoryIndex allows system admin", async () => {
    modelMocks.Restaurant.findById.mockResolvedValue(restaurantDoc());
    modelMocks.RestaurantCategoryIndex.findOneAndUpdate.mockReturnValue({
      lean: async () => ({ ok: 1 }),
    });

    const { RestaurantMutation } = await import("../../graphql/resolvers/restaurant/mutation.js");
    await RestaurantMutation.updateRestaurantCategoryIndex(
      null,
      { input: { restaurantId: "valid-r1", timeSlot: "EVENING", categoryIds: ["valid-c2"] } },
      ctxFor("admin", "valid-admin-1"),
    );

    expect(modelMocks.RestaurantCategoryIndex.findOneAndUpdate).toHaveBeenCalled();
  });
});
