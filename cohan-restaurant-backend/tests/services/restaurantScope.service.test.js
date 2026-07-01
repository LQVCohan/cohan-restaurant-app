import { beforeEach, describe, expect, it, vi } from "vitest";

const ids = {
  user: "665f665f665f665f665f6601",
  brandA: "665f665f665f665f665f6610",
  brandB: "665f665f665f665f665f6620",
  a1: "665f665f665f665f665f6611",
  a2: "665f665f665f665f665f6612",
  b1: "665f665f665f665f665f6621",
};

const state = vi.hoisted(() => ({
  memberships: [],
  brands: new Map(),
  restaurants: new Map(),
}));

const chain = (value) => ({ select: () => ({ lean: async () => value }) });

vi.mock("../../models/index.js", () => ({
  BrandMembership: {
    find: vi.fn(() => ({ lean: async () => state.memberships })),
    exists: vi.fn(async () => false),
  },
  Brand: {
    exists: vi.fn(async ({ _id, ownerId }) => !![...state.brands.values()].find((b) => String(b._id) === String(_id) && String(b.ownerId) === String(ownerId) && b.status !== "inactive")),
    find: vi.fn(({ ownerId }) => chain([...state.brands.values()].filter((b) => String(b.ownerId) === String(ownerId) && b.status !== "inactive"))),
  },
  Restaurant: {
    findById: vi.fn((id) => chain(state.restaurants.get(String(id)) || null)),
    exists: vi.fn(async ({ _id, managerId }) => !![...state.restaurants.values()].find((r) => String(r._id) === String(_id) && String(r.managerId) === String(managerId))),
    countDocuments: vi.fn(async ({ _id, brandId }) => {
      const allowed = new Set((_id?.$in || []).map(String));
      return [...state.restaurants.values()].filter((r) => allowed.has(String(r._id)) && String(r.brandId) === String(brandId)).length;
    }),
  },
}));

describe("restaurantScope.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.memberships = [];
    state.brands = new Map([
      [ids.brandA, { _id: ids.brandA, ownerId: ids.b1, status: "active" }],
      [ids.brandB, { _id: ids.brandB, ownerId: ids.b1, status: "active" }],
    ]);
    state.restaurants = new Map([
      [ids.a1, { _id: ids.a1, brandId: ids.brandA, managerId: ids.user }],
      [ids.a2, { _id: ids.a2, brandId: ids.brandA, managerId: ids.user }],
      [ids.b1, { _id: ids.b1, brandId: ids.brandB, managerId: ids.user }],
    ]);
  });

  it("allows System Admin across restaurants", async () => {
    const { canAccessRestaurant } = await import("../../src/services/auth/restaurantScope.service.js");
    await expect(canAccessRestaurant({ id: ids.user, userType: "ADMIN" }, ids.b1)).resolves.toBe(true);
  });

  it("allows Brand ownerId all restaurants in its Brand without BrandMembership", async () => {
    state.brands.set(ids.brandA, { _id: ids.brandA, ownerId: ids.user, status: "active" });
    const { canAccessRestaurant } = await import("../../src/services/auth/restaurantScope.service.js");
    await expect(canAccessRestaurant({ id: ids.user }, ids.a2)).resolves.toBe(true);
    await expect(canAccessRestaurant({ id: ids.user }, ids.b1)).resolves.toBe(false);
  });

  it("includes Brand ownerId brands in scoped restaurant filters", async () => {
    state.brands.set(ids.brandA, { _id: ids.brandA, ownerId: ids.user, status: "active" });
    const { getScopedRestaurantFilter } = await import("../../src/services/auth/restaurantScope.service.js");
    await expect(getScopedRestaurantFilter({ id: ids.user })).resolves.toEqual({ $or: [{ brandId: { $in: [ids.brandA] } }] });
  });

  it("treats Brand ownerId as an active Brand operator", async () => {
    state.brands.set(ids.brandA, { _id: ids.brandA, ownerId: ids.user, status: "active" });
    const { isActiveBrandOperator } = await import("../../src/services/auth/restaurantScope.service.js");
    await expect(isActiveBrandOperator(ids.user, ids.brandA)).resolves.toBe(true);
    await expect(isActiveBrandOperator(ids.user, ids.brandB)).resolves.toBe(false);
  });

  it.each(["owner", "admin"])("allows Brand %s all restaurants in its Brand", async (role) => {
    state.memberships = [{ brandId: ids.brandA, role, restaurantIds: [] }];
    const { canAccessRestaurant } = await import("../../src/services/auth/restaurantScope.service.js");
    await expect(canAccessRestaurant({ id: ids.user }, ids.a2)).resolves.toBe(true);
    await expect(canAccessRestaurant({ id: ids.user }, ids.b1)).resolves.toBe(false);
  });

  it.each(["manager", "staff"])("limits Brand %s to assigned restaurantIds", async (role) => {
    state.memberships = [{ brandId: ids.brandA, role, restaurantIds: [ids.a1] }];
    const { canAccessRestaurant } = await import("../../src/services/auth/restaurantScope.service.js");
    await expect(canAccessRestaurant({ id: ids.user }, ids.a1)).resolves.toBe(true);
    await expect(canAccessRestaurant({ id: ids.user }, ids.a2)).resolves.toBe(false);
  });

  it("denies Brand A user for Brand B restaurant", async () => {
    state.memberships = [{ brandId: ids.brandA, role: "manager", restaurantIds: [ids.a1, ids.a2] }];
    const { canAccessRestaurant } = await import("../../src/services/auth/restaurantScope.service.js");
    await expect(canAccessRestaurant({ id: ids.user }, ids.b1)).resolves.toBe(false);
  });

  it("uses legacy managerId fallback only without active BrandMembership", async () => {
    const { canAccessRestaurant } = await import("../../src/services/auth/restaurantScope.service.js");
    await expect(canAccessRestaurant({ id: ids.user, roleName: "manager" }, ids.a2)).resolves.toBe(true);
    state.memberships = [{ brandId: ids.brandA, role: "manager", restaurantIds: [ids.a1] }];
    await expect(canAccessRestaurant({ id: ids.user, roleName: "manager", restaurantForStaff: ids.a2, refRestaurants: [ids.a2] }, ids.a2)).resolves.toBe(false);
  });

  it("does not grant customers restaurant access through refRestaurants", async () => {
    const { canAccessRestaurant } = await import("../../src/services/auth/restaurantScope.service.js");
    await expect(canAccessRestaurant({ id: ids.user, roleName: "customer", refRestaurants: [ids.a1] }, ids.a1)).resolves.toBe(false);
  });

  it("allows operational legacy restaurantForStaff without active BrandMembership", async () => {
    const { canAccessRestaurant } = await import("../../src/services/auth/restaurantScope.service.js");
    await expect(canAccessRestaurant({ id: ids.user, roleName: "staff", restaurantForStaff: ids.a1 }, ids.a1)).resolves.toBe(true);
  });
});
