import { beforeEach, describe, expect, it, vi } from "vitest";

const ids = {
  user: "665f665f665f665f665f6601",
  otherUser: "665f665f665f665f665f6602",
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
    exists: vi.fn(async ({ brandId, status, role }) =>
      state.memberships.some(
        (membership) =>
          String(membership.brandId) === String(brandId) &&
          String(membership.status || "active") === String(status) &&
          (role?.$in || []).includes(membership.role),
      ),
    ),
  },
  Brand: {
    exists: vi.fn(async ({ _id, ownerId }) =>
      [...state.brands.values()].some(
        (brand) =>
          String(brand._id) === String(_id) &&
          String(brand.ownerId) === String(ownerId) &&
          brand.status !== "inactive",
      ),
    ),
    find: vi.fn(({ ownerId }) =>
      chain(
        [...state.brands.values()].filter(
          (brand) => String(brand.ownerId) === String(ownerId) && brand.status !== "inactive",
        ),
      ),
    ),
  },
  Restaurant: {
    findById: vi.fn((id) => chain(state.restaurants.get(String(id)) || null)),
    exists: vi.fn(async ({ _id, managerId }) =>
      [...state.restaurants.values()].some(
        (restaurant) =>
          String(restaurant._id) === String(_id) &&
          String(restaurant.managerId) === String(managerId),
      ),
    ),
    countDocuments: vi.fn(async ({ _id, brandId }) => {
      const allowed = new Set((_id?.$in || []).map(String));
      return [...state.restaurants.values()].filter(
        (restaurant) =>
          allowed.has(String(restaurant._id)) && String(restaurant.brandId) === String(brandId),
      ).length;
    }),
  },
}));

describe("restaurantScope.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.memberships = [];
    state.brands = new Map([
      [ids.brandA, { _id: ids.brandA, ownerId: ids.otherUser, status: "active" }],
      [ids.brandB, { _id: ids.brandB, ownerId: ids.otherUser, status: "active" }],
    ]);
    state.restaurants = new Map([
      [ids.a1, { _id: ids.a1, brandId: ids.brandA, managerId: ids.user }],
      [ids.a2, { _id: ids.a2, brandId: ids.brandA, managerId: ids.user }],
      [ids.b1, { _id: ids.b1, brandId: ids.brandB, managerId: ids.otherUser }],
    ]);
  });

  it("allows System Admin across restaurants", async () => {
    const { canAccessRestaurant } = await import("../../src/services/auth/restaurantScope.service.js");
    await expect(
      canAccessRestaurant({ id: ids.user, userType: "ADMIN" }, ids.b1),
    ).resolves.toBe(true);
  });

  it("does not use Brand ownerId as an authorization source", async () => {
    state.brands.set(ids.brandA, {
      _id: ids.brandA,
      ownerId: ids.user,
      status: "active",
    });
    const {
      canAccessRestaurant,
      canManageBrand,
      canReadBrand,
      isBrandOwner,
    } = await import("../../src/services/auth/restaurantScope.service.js");

    await expect(canAccessRestaurant({ id: ids.user }, ids.a2)).resolves.toBe(false);
    await expect(canReadBrand({ id: ids.user }, ids.brandA)).resolves.toBe(false);
    await expect(canManageBrand({ id: ids.user }, ids.brandA)).resolves.toBe(false);
    await expect(isBrandOwner({ id: ids.user }, ids.brandA)).resolves.toBe(false);
  });

  it("returns an empty scoped filter without active BrandMembership or operational scope", async () => {
    state.brands.set(ids.brandA, {
      _id: ids.brandA,
      ownerId: ids.user,
      status: "active",
    });
    const { getScopedRestaurantFilter } = await import("../../src/services/auth/restaurantScope.service.js");

    await expect(getScopedRestaurantFilter({ id: ids.user })).resolves.toEqual({
      _id: { $in: [] },
    });
  });

  it.each(["owner", "admin"])(
    "allows Brand %s all restaurants in its Brand",
    async (role) => {
      state.memberships = [
        { brandId: ids.brandA, role, status: "active", restaurantIds: [] },
      ];
      const {
        canAccessRestaurant,
        canManageBrand,
        canReadBrand,
      } = await import("../../src/services/auth/restaurantScope.service.js");

      await expect(canAccessRestaurant({ id: ids.user }, ids.a2)).resolves.toBe(true);
      await expect(canAccessRestaurant({ id: ids.user }, ids.b1)).resolves.toBe(false);
      await expect(canReadBrand({ id: ids.user }, ids.brandA)).resolves.toBe(true);
      await expect(canManageBrand({ id: ids.user }, ids.brandA)).resolves.toBe(true);
    },
  );

  it.each(["manager", "staff"])(
    "limits Brand %s to assigned restaurantIds",
    async (role) => {
      state.memberships = [
        {
          brandId: ids.brandA,
          role,
          status: "active",
          restaurantIds: [ids.a1],
        },
      ];
      const {
        canAccessRestaurant,
        getScopedRestaurantFilter,
      } = await import("../../src/services/auth/restaurantScope.service.js");

      await expect(canAccessRestaurant({ id: ids.user }, ids.a1)).resolves.toBe(true);
      await expect(canAccessRestaurant({ id: ids.user }, ids.a2)).resolves.toBe(false);

      const filter = await getScopedRestaurantFilter({ id: ids.user });
      expect(filter.$or).toHaveLength(1);
      expect(String(filter.$or[0]._id.$in[0])).toBe(ids.a1);
    },
  );

  it("uses legacy managerId only when no active BrandMembership exists", async () => {
    const { canAccessRestaurant } = await import("../../src/services/auth/restaurantScope.service.js");
    const manager = { id: ids.user, roleName: "manager" };

    await expect(canAccessRestaurant(manager, ids.a2)).resolves.toBe(true);

    state.memberships = [
      {
        brandId: ids.brandA,
        role: "manager",
        status: "active",
        restaurantIds: [ids.a1],
      },
    ];
    await expect(canAccessRestaurant(manager, ids.a2)).resolves.toBe(false);
  });

  it("uses explicit staff restaurant scope only when no active BrandMembership exists", async () => {
    const {
      canAccessRestaurant,
      getScopedRestaurantFilter,
    } = await import("../../src/services/auth/restaurantScope.service.js");
    const staff = {
      id: ids.user,
      roleName: "staff",
      restaurantForStaff: ids.a1,
    };

    await expect(canAccessRestaurant(staff, ids.a1)).resolves.toBe(true);
    const legacyFilter = await getScopedRestaurantFilter(staff);
    expect(legacyFilter.$or).toHaveLength(1);
    expect(String(legacyFilter.$or[0]._id.$in[0])).toBe(ids.a1);

    state.memberships = [
      {
        brandId: ids.brandA,
        role: "staff",
        status: "active",
        restaurantIds: [ids.a2],
      },
    ];
    await expect(canAccessRestaurant(staff, ids.a1)).resolves.toBe(false);
    await expect(canAccessRestaurant(staff, ids.a2)).resolves.toBe(true);
  });

  it("does not grant customers restaurant access through refRestaurants", async () => {
    const { canAccessRestaurant } = await import("../../src/services/auth/restaurantScope.service.js");

    await expect(
      canAccessRestaurant(
        { id: ids.user, roleName: "customer", refRestaurants: [ids.a1] },
        ids.a1,
      ),
    ).resolves.toBe(false);
  });

  it("uses active BrandMembership for Brand operator checks", async () => {
    state.memberships = [
      {
        brandId: ids.brandA,
        role: "owner",
        status: "active",
        restaurantIds: [],
      },
    ];
    const { isActiveBrandOperator } = await import("../../src/services/auth/restaurantScope.service.js");

    await expect(isActiveBrandOperator(ids.user, ids.brandA)).resolves.toBe(true);
    await expect(isActiveBrandOperator(ids.user, ids.brandB)).resolves.toBe(false);
  });
});
