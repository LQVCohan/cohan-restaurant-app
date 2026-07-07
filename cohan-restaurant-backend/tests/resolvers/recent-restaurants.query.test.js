import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Customer: { findOne: vi.fn() },
  Restaurant: { find: vi.fn() },
  RestaurantCategoryIndex: {}, Menu: {}, MenuItem: {}, Order: {}, Reservation: {}, TableCustomer: {},
}));
vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/restaurantAvailability.service.js", () => ({ computeRestaurantAvailability: vi.fn() }));
vi.mock("../../src/services/distance/roadDistance.service.js", () => ({ resolveRoadDistances: vi.fn() }));
vi.mock("../../src/services/auth/restaurantScope.service.js", () => ({ canAccessRestaurant: vi.fn(), getScopedRestaurantFilter: vi.fn(), isSystemAdmin: vi.fn() }));

const chain = (value) => ({ select: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue(value) });
const ids = ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012", "507f1f77bcf86cd799439013"];

describe("myRecentRestaurants", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("keeps refRestaurants order and skips non-public/deleted restaurants", async () => {
    modelMocks.Customer.findOne.mockReturnValue(chain({ _id: "u1", refRestaurants: ids }));
    modelMocks.Restaurant.find.mockReturnValue(chain([{ _id: ids[2], name: "third" }, { _id: ids[0], name: "first" }]));
    const { RestaurantQuery } = await import("../../graphql/resolvers/restaurant/query.js");
    const rows = await RestaurantQuery.myRecentRestaurants(null, { limit: 12 }, { user: { id: "u1" } });
    expect(rows.map((r) => String(r._id))).toEqual([ids[0], ids[2]]);
    expect(modelMocks.Restaurant.find.mock.calls[0][0]).toMatchObject({ businessStatus: "active", publicationStatus: "published" });
  });

  it("does not expose the legacy refRestaurants query", async () => {
    const { RestaurantQuery } = await import("../../graphql/resolvers/restaurant/query.js");
    expect(RestaurantQuery.refRestaurants).toBeUndefined();
  });
});
