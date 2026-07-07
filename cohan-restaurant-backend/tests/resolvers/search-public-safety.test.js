import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  User: { find: vi.fn() },
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

describe("search public safety", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    modelMocks.Restaurant.find.mockReturnValue(createFindChain([]));
    modelMocks.Restaurant.aggregate.mockResolvedValue([]);
    modelMocks.MenuItem.aggregate.mockResolvedValue([]);
    modelMocks.User.find.mockReturnValue(createFindChain([]));
    modelMocks.BrandMembership.find.mockReturnValue(createFindChain([]));
  });

  it("searchSuggestions for public user does not call User.find and returns owners []", async () => {
    const { default: searchQueryResolvers } = await import("../../graphql/resolvers/search/query.js");
    const result = await searchQueryResolvers.searchSuggestions(null, { query: "pizza", timeSlot: null, limitPerType: 5 }, {});

    expect(modelMocks.User.find).not.toHaveBeenCalled();
    expect(result.owners).toEqual([]);
  });

  it("searchSuggestions for admin may call User.find", async () => {
    const owners = [{ _id: "u1", fullName: "Admin Owner", phone: "0909", email: "owner@example.com" }];
    modelMocks.User.find.mockReturnValue(createFindChain(owners));
    modelMocks.BrandMembership.find.mockReturnValue(createFindChain([{ userId: "u1", role: "manager", restaurantIds: ["r1", "r1", "r2"] }]));

    const { default: searchQueryResolvers } = await import("../../graphql/resolvers/search/query.js");
    const result = await searchQueryResolvers.searchSuggestions(null, { query: "admin", limitPerType: 5 }, { user: { roleName: "ADMIN" } });

    expect(modelMocks.User.find).toHaveBeenCalled();
    expect(result.owners[0]).toMatchObject({
      id: "u1",
      fullName: "Admin Owner",
      phone: "0909",
      email: "owner@example.com",
      managedRestaurantCount: 2,
    });
  });

  it("search default public excludes OWNER", async () => {
    const { default: searchQueryResolvers } = await import("../../graphql/resolvers/search/query.js");
    const result = await searchQueryResolvers.search(null, { query: "pho", filter: {}, limit: 20, offset: 0 }, {});

    expect(modelMocks.User.find).not.toHaveBeenCalled();
    expect(result.items.every((item) => item.type !== "OWNER")).toBe(true);
  });

  it("search public ignores requested OWNER type", async () => {
    const { default: searchQueryResolvers } = await import("../../graphql/resolvers/search/query.js");
    const result = await searchQueryResolvers.search(null, { query: "owner", filter: { types: ["OWNER"] }, limit: 20, offset: 0 }, {});

    expect(modelMocks.User.find).not.toHaveBeenCalled();
    expect(result.items).toEqual([]);
    expect(result.totalCount).toBe(0);
  });

  it("search admin with filter.types OWNER calls User.find", async () => {
    const users = [{ _id: "u2", fullName: "Boss", phone: "0123", email: "boss@example.com" }];
    modelMocks.User.find.mockReturnValue(createFindChain(users));
    modelMocks.BrandMembership.find.mockReturnValue(createFindChain([]));

    const { default: searchQueryResolvers } = await import("../../graphql/resolvers/search/query.js");
    const result = await searchQueryResolvers.search(null, { query: "boss", filter: { types: ["OWNER"] }, limit: 20, offset: 0 }, { user: { roleName: "ADMIN" } });

    expect(modelMocks.User.find).toHaveBeenCalled();
    expect(result.items[0]).toMatchObject({ type: "OWNER", owner: { id: "u2", phone: "0123", email: "boss@example.com" } });
  });

  it("restaurant/menu item/location public search still works", async () => {
    const { default: searchQueryResolvers } = await import("../../graphql/resolvers/search/query.js");
    await searchQueryResolvers.search(null, { query: "hanoi", filter: { types: ["RESTAURANT", "MENU_ITEM", "LOCATION"] }, limit: 20, offset: 0 }, {});

    expect(modelMocks.Restaurant.find).toHaveBeenCalled();
    expect(modelMocks.MenuItem.aggregate).toHaveBeenCalled();
    expect(modelMocks.Restaurant.aggregate).toHaveBeenCalled();
    expect(modelMocks.User.find).not.toHaveBeenCalled();
  });

  it("full search keeps CHEF results and does not duplicate restaurant/menu results", async () => {
    modelMocks.Restaurant.find.mockReturnValue(createFindChain([{ _id: "r1", name: "Pho", avgRating: 4.5 }]));
    modelMocks.MenuItem.aggregate.mockResolvedValue([{ _id: "m1", name: "Pho bo", basePrice: 1, restaurant: { _id: "r1", name: "Pho" } }]);
    modelMocks.User.find.mockReturnValue(createFindChain([{ _id: "chef-1", fullName: "Chef One" }]));

    const { default: searchQueryResolvers } = await import("../../graphql/resolvers/search/query.js");
    const result = await searchQueryResolvers.search(null, { query: "pho.*", filter: { types: ["RESTAURANT", "MENU_ITEM", "CHEF"] }, limit: 20, offset: 0 }, {});

    expect(result.items.filter((item) => item.type === "RESTAURANT")).toHaveLength(1);
    expect(result.items.filter((item) => item.type === "MENU_ITEM")).toHaveLength(1);
    expect(result.items.filter((item) => item.type === "CHEF")).toHaveLength(1);
  });
});
