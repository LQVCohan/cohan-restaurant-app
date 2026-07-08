import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  User: { find: vi.fn() },
  Staff: { aggregate: vi.fn() },
  BrandMembership: { find: vi.fn() },
  MenuItem: { aggregate: vi.fn() },
  Restaurant: { find: vi.fn(), aggregate: vi.fn() },
}));

vi.mock("../../models/index.js", () => modelMocks);

function createFindChain(result = []) {
  return {
    limit: vi.fn(function limit() { return this; }),
    sort: vi.fn(function sort() { return this; }),
    skip: vi.fn(function skip() { return this; }),
    select: vi.fn(function select() { return this; }),
    lean: vi.fn().mockResolvedValue(result),
  };
}

function ids(values) {
  return values.map((value) => ({ toString: () => value }));
}

const adminCtx = { user: { roleName: "ADMIN" } };

describe("search public safety", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    modelMocks.Restaurant.find.mockReturnValue(createFindChain([]));
    modelMocks.Restaurant.aggregate.mockResolvedValue([]);
    modelMocks.MenuItem.aggregate.mockResolvedValue([]);
    modelMocks.Staff.aggregate.mockResolvedValue([]);
    modelMocks.User.find.mockReturnValue(createFindChain([]));
    modelMocks.BrandMembership.find.mockReturnValue(createFindChain([]));
  });

  it("public searchSuggestions does not call User.find for OWNER", async () => {
    const { default: searchQueryResolvers } = await import("../../graphql/resolvers/search/query.js");

    const result = await searchQueryResolvers.searchSuggestions(null, { query: "pizza", limitPerType: 5 }, {});

    expect(modelMocks.User.find).not.toHaveBeenCalled();
    expect(result.owners).toEqual([]);
  });

  it("public full search ignores requested OWNER type", async () => {
    const { default: searchQueryResolvers } = await import("../../graphql/resolvers/search/query.js");

    const result = await searchQueryResolvers.search(null, {
      query: "owner",
      filter: { types: ["OWNER"] },
      limit: 20,
      offset: 0,
    }, {});

    expect(modelMocks.User.find).not.toHaveBeenCalled();
    expect(result).toEqual({ items: [], totalCount: 0 });
  });

  it("admin searchSuggestions can find OWNER with manager count from active BrandMembership", async () => {
    modelMocks.User.find.mockReturnValue(createFindChain([{ _id: "u1", fullName: "Admin Owner", phone: "0909", email: "owner@example.com" }]));
    modelMocks.BrandMembership.find.mockReturnValue(createFindChain([
      { userId: "u1", role: "manager", restaurantIds: ["r1", "r1", "r2"], status: "active" },
    ]));

    const { default: searchQueryResolvers } = await import("../../graphql/resolvers/search/query.js");
    const result = await searchQueryResolvers.searchSuggestions(null, { query: "admin", limitPerType: 5 }, adminCtx);

    expect(modelMocks.User.find).toHaveBeenCalledWith(
      expect.any(Object),
      expect.not.objectContaining({ refRestaurants: expect.anything() }),
    );
    expect(modelMocks.BrandMembership.find).toHaveBeenCalledWith({ userId: { $in: ["u1"] }, status: "active" });
    expect(result.owners[0]).toMatchObject({
      id: "u1",
      fullName: "Admin Owner",
      managedRestaurantCount: 2,
    });
  });

  it("owner/admin active memberships count unique restaurants in their brands", async () => {
    modelMocks.User.find.mockReturnValue(createFindChain([{ _id: "u2", fullName: "Boss" }]));
    modelMocks.BrandMembership.find.mockReturnValue(createFindChain([
      { userId: "u2", role: "owner", brandId: "b1" },
      { userId: "u2", role: "admin", brandId: "b2" },
    ]));
    modelMocks.Restaurant.find.mockReturnValue(createFindChain([
      { _id: "r1", brandId: "b1" },
      { _id: "r1", brandId: "b2" },
      { _id: "r2", brandId: "b2" },
    ]));

    const { default: searchQueryResolvers } = await import("../../graphql/resolvers/search/query.js");
    const result = await searchQueryResolvers.search(null, { query: "boss", filter: { types: ["OWNER"] }, limit: 20, offset: 0 }, adminCtx);

    expect(modelMocks.Restaurant.find).toHaveBeenCalledWith({ brandId: { $in: ["b1", "b2"] } }, { _id: 1, brandId: 1 });
    expect(result.items[0]).toMatchObject({ type: "OWNER", score: 3, owner: { id: "u2" } });
  });

  it("no membership produces managedRestaurantCount 0 without reading refRestaurants", async () => {
    modelMocks.User.find.mockReturnValue(createFindChain([{ _id: "u3", fullName: "No Scope", refRestaurants: ids(["legacy"]) }]));
    modelMocks.BrandMembership.find.mockReturnValue(createFindChain([]));

    const { default: searchQueryResolvers } = await import("../../graphql/resolvers/search/query.js");
    const result = await searchQueryResolvers.searchSuggestions(null, { query: "scope", limitPerType: 5 }, adminCtx);

    expect(modelMocks.User.find.mock.calls[0][1]).not.toHaveProperty("refRestaurants");
    expect(result.owners[0].managedRestaurantCount).toBe(0);
  });

  it("CHEF search uses Staff.aggregate and does not use User.find", async () => {
    modelMocks.Staff.aggregate.mockResolvedValue([{ _id: "c1", fullName: "Chef One", restaurant: { _id: "r1", name: "Pho", phone: "090" } }]);

    const { default: searchQueryResolvers } = await import("../../graphql/resolvers/search/query.js");
    const result = await searchQueryResolvers.search(null, { query: "chef", filter: { types: ["CHEF"] }, limit: 20, offset: 0 }, {});

    expect(modelMocks.Staff.aggregate).toHaveBeenCalled();
    expect(modelMocks.User.find).not.toHaveBeenCalled();
    expect(result.items[0].chef).toMatchObject({ id: "c1", fullName: "Chef One", contactPhone: "090" });
    expect(result.items[0].chef).not.toHaveProperty("email");
    expect(result.items[0].chef).not.toHaveProperty("phone");
  });

  it("CHEF pipeline requires active working staff with chef role and public restaurant", async () => {
    const { default: searchQueryResolvers } = await import("../../graphql/resolvers/search/query.js");
    await searchQueryResolvers.search(null, { query: "chef", filter: { types: ["CHEF"] }, limit: 20, offset: 0 }, {});

    const pipeline = modelMocks.Staff.aggregate.mock.calls[0][0];
    expect(pipeline).toEqual(expect.arrayContaining([
      expect.objectContaining({ $match: expect.objectContaining({ userType: "STAFF", status: "active", employmentStatus: "working", restaurantForStaff: { $ne: null } }) }),
    ]));
    expect(JSON.stringify(pipeline)).toContain('"role.slug":"chef"');
    expect(JSON.stringify(pipeline)).toContain("businessStatus");
    expect(JSON.stringify(pipeline)).toContain("publicationStatus");
  });

  it("restaurant/menu item/chef/location search keeps public contracts, safe regex, and no duplicate pushes", async () => {
    modelMocks.Restaurant.find.mockReturnValue(createFindChain([{ _id: "r1", name: "Pho", avgRating: 4.5 }]));
    modelMocks.MenuItem.aggregate.mockResolvedValue([{ _id: "m1", name: "Pho bo", basePrice: 1, restaurant: { _id: "r1", name: "Pho" }, category: { name: "Noodle" }, recipe: { notes: "nướng", servingVariants: [{ name: "Tô lớn", isDefault: true }] } }]);
    modelMocks.Staff.aggregate.mockResolvedValue([{ _id: "c1", fullName: "Chef One", restaurant: { _id: "r1", name: "Pho" } }]);
    modelMocks.Restaurant.aggregate.mockResolvedValue([{ _id: { city: "Hà Nội", district: "Ba Đình" }, count: 1 }]);

    const { default: searchQueryResolvers } = await import("../../graphql/resolvers/search/query.js");
    const result = await searchQueryResolvers.search(null, { query: "pho.*", filter: { types: ["RESTAURANT", "MENU_ITEM", "CHEF", "LOCATION"] }, limit: 20, offset: 0 }, {});

    expect(result.items.filter((item) => item.type === "RESTAURANT")).toHaveLength(1);
    expect(result.items.filter((item) => item.type === "MENU_ITEM")).toHaveLength(1);
    expect(result.items.filter((item) => item.type === "CHEF")).toHaveLength(1);
    expect(result.items.filter((item) => item.type === "LOCATION")).toHaveLength(1);
    expect(result.items.find((item) => item.type === "MENU_ITEM")).toMatchObject({
      restaurant: { id: "r1" },
      categoryName: "Noodle",
      servingLabel: "Tô lớn",
      cookingMethods: ["Nướng"],
    });

    const restaurantQuery = modelMocks.Restaurant.find.mock.calls[0][0];
    expect(restaurantQuery.$and[1].$or[0].name.source).toBe("pho\\.\\*");
    expect(JSON.stringify(modelMocks.MenuItem.aggregate.mock.calls[0][0])).toContain("publicationStatus");
    expect(JSON.stringify(modelMocks.Restaurant.aggregate.mock.calls[0][0])).toContain("publicationStatus");
  });

  it("escapes malformed regex characters", async () => {
    const { default: searchQueryResolvers } = await import("../../graphql/resolvers/search/query.js");

    await expect(searchQueryResolvers.search(null, { query: "[", filter: { types: ["RESTAURANT"] }, limit: 20, offset: 0 }, {})).resolves.toMatchObject({ totalCount: 0 });
    expect(modelMocks.Restaurant.find.mock.calls[0][0].$and[1].$or[0].name.source).toBe("\\[");
  });
});
