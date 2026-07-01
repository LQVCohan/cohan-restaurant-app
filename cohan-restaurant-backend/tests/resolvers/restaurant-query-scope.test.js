import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  findFilter: null,
  countFilter: null,
  doc: { _id: "665f665f665f665f665f6611", name: "Private restaurant" },
  publicDoc: { _id: "665f665f665f665f665f6611", name: "Published restaurant" },
}));

const listChain = () => ({
  sort: () => ({
    limit: () => ({ lean: async () => [] }),
  }),
});

vi.mock("../../models/index.js", () => ({
  Restaurant: {
    find: vi.fn((filter) => { state.findFilter = filter; return listChain(); }),
    countDocuments: vi.fn(async (filter) => { state.countFilter = filter; return 0; }),
    findById: vi.fn(() => ({ lean: async () => state.doc })),
    findOne: vi.fn(() => ({ lean: async () => state.publicDoc })),
  },
  User: {},
  RestaurantCategoryIndex: {},
  Menu: {},
  MenuItem: {},
  Order: {},
  Reservation: {},
  TableCustomer: {},
}));

vi.mock("../../src/services/restaurantAvailability.service.js", () => ({
  computeRestaurantAvailability: vi.fn(() => ({ open: true, canReserve: true, canOrder: true })),
}));
vi.mock("../../src/services/distance/roadDistance.service.js", () => ({
  resolveRoadDistances: vi.fn(async () => new Map()),
}));

describe("RestaurantQuery management scope", () => {
  beforeEach(() => {
    vi.resetModules();
    state.findFilter = null;
    state.countFilter = null;
  });

  it("does not return full management restaurants for anonymous users", async () => {
    const { RestaurantQuery } = await import("../../graphql/resolvers/restaurant/query.js");
    const result = await RestaurantQuery.restaurants(null, { limit: 20 }, {});
    expect(result.edges).toEqual([]);
    expect(state.findFilter).toMatchObject({ _id: { $in: [] } });
    expect(state.countFilter).toMatchObject({ _id: { $in: [] } });
  });

  it("does not return management restaurant detail for anonymous users", async () => {
    const { RestaurantQuery } = await import("../../graphql/resolvers/restaurant/query.js");
    await expect(RestaurantQuery.restaurant(null, { id: "665f665f665f665f665f6611" }, {})).resolves.toBeNull();
  });

  it("keeps publicRestaurant available for published restaurants", async () => {
    const { RestaurantQuery } = await import("../../graphql/resolvers/restaurant/query.js");
    await expect(RestaurantQuery.publicRestaurant(null, { id: "665f665f665f665f665f6611" })).resolves.toEqual(state.publicDoc);
  });

  it("scopedRestaurants uses the central scoped restaurant filter", async () => {
    const { RestaurantQuery } = await import("../../graphql/resolvers/restaurant/query.js");
    await RestaurantQuery.scopedRestaurants(null, { limit: 20 }, { user: { id: "admin-1", roleName: "admin" } });
    expect(state.findFilter).toEqual({});
  });

  it("restaurantsByManager is a deprecated alias for scopedRestaurants", async () => {
    const { RestaurantQuery } = await import("../../graphql/resolvers/restaurant/query.js");
    await RestaurantQuery.restaurantsByManager(null, { managerId: "665f665f665f665f665f6611", limit: 20 }, { user: { id: "admin-1", roleName: "admin" } });
    expect(state.findFilter).toEqual({});
  });
});
