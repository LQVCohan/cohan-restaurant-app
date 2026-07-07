import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  User: { find: vi.fn() },
  Staff: { aggregate: vi.fn() },
  MenuItem: { aggregate: vi.fn() },
  Restaurant: { find: vi.fn(), aggregate: vi.fn() },
}));

vi.mock("../../models/index.js", () => modelMocks);

function createFindChain(result = []) {
  return {
    limit: vi.fn(function limit() { return this; }),
    sort: vi.fn(function sort() { return this; }),
    skip: vi.fn(function skip() { return this; }),
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
    modelMocks.Staff.aggregate.mockResolvedValue([]);
    modelMocks.User.find.mockReturnValue(createFindChain([]));
  });

  it("searchSuggestions for public user does not call User.find and returns owners []", async () => {
    const { default: searchQueryResolvers } = await import(
      "../../graphql/resolvers/search/query.js"
    );
    const result = await searchQueryResolvers.searchSuggestions(
      null,
      { query: "pizza", timeSlot: null, limitPerType: 5 },
      {},
    );

    expect(modelMocks.User.find).not.toHaveBeenCalled();
    expect(result.owners).toEqual([]);
  });

  it("searchSuggestions for admin may call User.find", async () => {
    const owners = [
      {
        _id: "u1",
        fullName: "Admin Owner",
        phone: "0909",
        email: "owner@example.com",
        refRestaurants: ["r1"],
      },
    ];
    modelMocks.User.find.mockReturnValue(createFindChain(owners));

    const { default: searchQueryResolvers } = await import(
      "../../graphql/resolvers/search/query.js"
    );
    const result = await searchQueryResolvers.searchSuggestions(
      null,
      { query: "admin", limitPerType: 5 },
      { user: { roleName: "ADMIN" } },
    );

    expect(modelMocks.User.find).toHaveBeenCalled();
    expect(result.owners[0]).toMatchObject({
      id: "u1",
      fullName: "Admin Owner",
      phone: "0909",
      email: "owner@example.com",
      managedRestaurantCount: 1,
    });
  });

  it("search default public excludes OWNER", async () => {
    const { default: searchQueryResolvers } = await import(
      "../../graphql/resolvers/search/query.js"
    );
    const result = await searchQueryResolvers.search(
      null,
      { query: "pho", filter: {}, limit: 20, offset: 0 },
      {},
    );

    expect(modelMocks.User.find).not.toHaveBeenCalled();
    expect(result.items.every((item) => item.type !== "OWNER")).toBe(true);
  });

  it("search public ignores requested OWNER type", async () => {
    const { default: searchQueryResolvers } = await import(
      "../../graphql/resolvers/search/query.js"
    );
    const result = await searchQueryResolvers.search(
      null,
      {
        query: "owner",
        filter: { types: ["OWNER"] },
        limit: 20,
        offset: 0,
      },
      {},
    );

    expect(modelMocks.User.find).not.toHaveBeenCalled();
    expect(result.items).toEqual([]);
    expect(result.totalCount).toBe(0);
  });

  it("search admin with filter.types OWNER calls User.find", async () => {
    const users = [
      {
        _id: "u2",
        fullName: "Boss",
        phone: "0123",
        email: "boss@example.com",
        refRestaurants: [],
      },
    ];
    modelMocks.User.find.mockReturnValue(createFindChain(users));

    const { default: searchQueryResolvers } = await import(
      "../../graphql/resolvers/search/query.js"
    );
    const result = await searchQueryResolvers.search(
      null,
      {
        query: "boss",
        filter: { types: ["OWNER"] },
        limit: 20,
        offset: 0,
      },
      { user: { roleName: "ADMIN" } },
    );

    expect(modelMocks.User.find).toHaveBeenCalled();
    expect(result.items[0]).toMatchObject({
      type: "OWNER",
      owner: { id: "u2", phone: "0123", email: "boss@example.com" },
    });
  });

  it("restaurant/menu item/location public search still works", async () => {
    const { default: searchQueryResolvers } = await import(
      "../../graphql/resolvers/search/query.js"
    );
    await searchQueryResolvers.search(
      null,
      {
        query: "hanoi",
        filter: { types: ["RESTAURANT", "MENU_ITEM", "LOCATION"] },
        limit: 20,
        offset: 0,
      },
      {},
    );

    expect(modelMocks.Restaurant.find).toHaveBeenCalled();
    expect(modelMocks.MenuItem.aggregate).toHaveBeenCalled();
    expect(modelMocks.Restaurant.aggregate).toHaveBeenCalled();
    expect(modelMocks.User.find).not.toHaveBeenCalled();
  });

  it("escapes special characters before building menu search regexes", async () => {
    const { default: searchQueryResolvers } = await import(
      "../../graphql/resolvers/search/query.js"
    );

    await searchQueryResolvers.search(
      null,
      {
        query: "[",
        filter: { types: ["MENU_ITEM"] },
        limit: 20,
        offset: 0,
      },
      {},
    );

    const pipeline = modelMocks.MenuItem.aggregate.mock.calls[0][0];
    const searchMatch = pipeline
      .find((stage) => stage.$match?.$and)
      .$match.$and.find(
        (condition) =>
          Array.isArray(condition.$or) &&
          condition.$or.some((entry) => entry.name instanceof RegExp),
      );
    const nameRegex = searchMatch.$or.find(
      (entry) => entry.name instanceof RegExp,
    ).name;

    expect(nameRegex.source).toBe("\\[");
  });

  it("returns category, serving, cooking method, and associated restaurant for dishes", async () => {
    modelMocks.MenuItem.aggregate.mockResolvedValue([
      {
        _id: "m1",
        name: "Cá nướng",
        description: "Cá tươi nướng lửa vừa",
        thumbImage: null,
        basePrice: 180000,
        rate: 4.5,
        servingPortion: 2,
        servingUnit: "người",
        menu: { timeSlot: "dinner" },
        category: { name: "Hải sản" },
        recipe: {
          notes: "Chế biến: Nướng cá trên lửa vừa.",
          servingVariants: [
            {
              key: "portion-2",
              name: "Phần 2 người",
              sellQty: 1,
              sellUnit: "portion",
              isDefault: true,
            },
          ],
        },
        restaurant: {
          _id: "r1",
          name: "Cohan Restaurant",
          avgRating: 4.8,
          address: { district: "Quận 1", city: "TP.HCM" },
        },
      },
    ]);

    const { default: searchQueryResolvers } = await import(
      "../../graphql/resolvers/search/query.js"
    );
    const result = await searchQueryResolvers.search(
      null,
      {
        query: "nướng",
        filter: { types: ["MENU_ITEM"] },
        limit: 20,
        offset: 0,
      },
      {},
    );

    expect(result.items[0]).toMatchObject({
      type: "MENU_ITEM",
      restaurant: { id: "r1", name: "Cohan Restaurant" },
      menuItem: { id: "m1", name: "Cá nướng", basePrice: 180000 },
      categoryName: "Hải sản",
      servingLabel: "Phần 2 người",
      cookingMethods: ["Nướng"],
    });
    expect(result.items[0].menuItem).not.toHaveProperty("restaurant");
  });

  it("returns a public chef profile without staff personal contact fields", async () => {
    modelMocks.Staff.aggregate.mockResolvedValue([
      {
        _id: "chef1",
        fullName: "Nguyễn Văn An",
        positionTitle: "Bếp trưởng",
        avatarUrl: null,
        roleName: "Chef",
        restaurant: {
          _id: "r1",
          name: "Cohan Restaurant",
          phone: "0909000111",
          avgRating: 4.8,
          address: { district: "Quận 1", city: "TP.HCM" },
        },
      },
    ]);

    const { default: searchQueryResolvers } = await import(
      "../../graphql/resolvers/search/query.js"
    );
    const result = await searchQueryResolvers.search(
      null,
      {
        query: "090900",
        filter: { types: ["CHEF"] },
        limit: 20,
        offset: 0,
      },
      {},
    );

    expect(result.items[0]).toMatchObject({
      type: "CHEF",
      chef: {
        id: "chef1",
        fullName: "Nguyễn Văn An",
        positionTitle: "Bếp trưởng",
        restaurantId: "r1",
        restaurantName: "Cohan Restaurant",
        contactPhone: "0909000111",
      },
    });
    expect(result.items[0].chef).not.toHaveProperty("phone");
    expect(result.items[0].chef).not.toHaveProperty("email");
  });
});
