import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Customer: { findOne: vi.fn() },
  Restaurant: { find: vi.fn(), exists: vi.fn() },
  RestaurantCategoryIndex: {}, Menu: {}, MenuItem: {}, Order: {}, Reservation: {}, TableCustomer: {},
}));
vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/restaurantAvailability.service.js", () => ({ computeRestaurantAvailability: vi.fn() }));
vi.mock("../../src/services/distance/roadDistance.service.js", () => ({ resolveRoadDistances: vi.fn() }));
vi.mock("../../src/services/auth/restaurantScope.service.js", () => ({ canAccessRestaurant: vi.fn(), getScopedRestaurantFilter: vi.fn(), isSystemAdmin: vi.fn() }));
vi.mock("../../src/constants/permissions.js", () => ({ PERMISSIONS: {} }));
vi.mock("../../src/services/auth/authorization.service.js", () => ({ requirePermission: vi.fn() }));
vi.mock("../../src/services/ai/restaurantProfileRewrite.service.js", () => ({ rewriteRestaurantProfileDescription: vi.fn() }));

const chain = (value) => ({ select: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue(value) });
const ids = ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012", "507f1f77bcf86cd799439013"];

describe("myRecentRestaurants and recordRecentRestaurant", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("keeps refRestaurants order and uses the shared public filter including legacy public restaurants", async () => {
    modelMocks.Customer.findOne.mockReturnValue(chain({ _id: "u1", refRestaurants: ids }));
    modelMocks.Restaurant.find.mockReturnValue(chain([{ _id: ids[2], name: "third" }, { _id: ids[0], name: "first" }]));
    const { RestaurantQuery } = await import("../../graphql/resolvers/restaurant/query.js");
    const rows = await RestaurantQuery.myRecentRestaurants(null, { limit: 12 }, { user: { id: "u1" } });
    expect(rows.map((r) => String(r._id))).toEqual([ids[0], ids[2]]);
    expect(modelMocks.Restaurant.find.mock.calls[0][0]).toMatchObject({
      _id: expect.any(Object),
      $or: expect.arrayContaining([
        { businessStatus: "active", publicationStatus: "published" },
        expect.objectContaining({ status: "active" }),
      ]),
    });
  });

  it("recordRecentRestaurant accepts public restaurants from new or legacy publication schema", async () => {
    modelMocks.Restaurant.exists.mockResolvedValue({ _id: ids[0] });
    const customer = { _id: "u1", refRestaurants: [], save: vi.fn().mockResolvedValue(undefined) };
    modelMocks.Customer.findOne.mockResolvedValue(customer);
    const { RestaurantMutation } = await import("../../graphql/resolvers/restaurant/mutation.js");
    await expect(RestaurantMutation.recordRecentRestaurant(null, { restaurantId: ids[0] }, { user: { id: "u1", userType: "CUSTOMER" } })).resolves.toBe(true);
    expect(modelMocks.Restaurant.exists.mock.calls[0][0].$or).toEqual(expect.arrayContaining([
      { businessStatus: "active", publicationStatus: "published" },
      expect.objectContaining({ status: "active" }),
    ]));
    expect(customer.save).toHaveBeenCalledTimes(1);
  });

  it("does not expose the legacy refRestaurants query", async () => {
    const { RestaurantQuery } = await import("../../graphql/resolvers/restaurant/query.js");
    expect(RestaurantQuery.refRestaurants).toBeUndefined();
  });
});
