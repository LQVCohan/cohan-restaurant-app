import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Restaurant: { exists: vi.fn() },
}));

vi.mock("../../models/index.js", () => modelMocks);

const RESTAURANT_ID = "r1";

describe("requireRestaurantAccess role matrix", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    modelMocks.Restaurant.exists.mockResolvedValue(false);
  });

  it("allows admin across all restaurants", async () => {
    const { requireRestaurantAccess } = await import("../../graphql/guards.js");
    await expect(requireRestaurantAccess({ user: { id: "a1", roleName: "admin" } }, RESTAURANT_ID)).resolves.toBeUndefined();
    expect(modelMocks.Restaurant.exists).not.toHaveBeenCalled();
  });

  it("allows manager only when Restaurant.managerId matches", async () => {
    modelMocks.Restaurant.exists.mockResolvedValue(true);
    const { requireRestaurantAccess } = await import("../../graphql/guards.js");
    await expect(requireRestaurantAccess({ user: { id: "m1", roleName: "manager" } }, RESTAURANT_ID)).resolves.toBeUndefined();
    expect(modelMocks.Restaurant.exists).toHaveBeenCalledWith({ _id: RESTAURANT_ID, managerId: "m1" });
  });

  it("does not treat manager refRestaurants as authorization", async () => {
    const { requireRestaurantAccess } = await import("../../graphql/guards.js");
    await expect(requireRestaurantAccess({ user: { id: "m1", roleName: "manager", refRestaurants: [RESTAURANT_ID] } }, RESTAURANT_ID)).rejects.toThrow("FORBIDDEN_SCOPE");
  });

  it.each(["hr", "accountant", "staff", "server", "supervisor", "cashier", "chef", "storekeeper"])(
    "allows %s through restaurantForStaff",
    async (roleName) => {
      const { requireRestaurantAccess } = await import("../../graphql/guards.js");
      await expect(requireRestaurantAccess({ user: { id: roleName + "-1", roleName, restaurantForStaff: RESTAURANT_ID } }, RESTAURANT_ID)).resolves.toBeUndefined();
    },
  );

  it("denies restaurant-scoped roles outside their assigned restaurant", async () => {
    const { requireRestaurantAccess } = await import("../../graphql/guards.js");
    await expect(requireRestaurantAccess({ user: { id: "hr1", roleName: "hr", restaurantForStaff: "other" } }, RESTAURANT_ID)).rejects.toThrow("FORBIDDEN_SCOPE");
  });

  it("denies customer access from refRestaurants", async () => {
    const { requireRestaurantAccess } = await import("../../graphql/guards.js");
    await expect(requireRestaurantAccess({ user: { id: "c1", roleName: "customer", refRestaurants: [RESTAURANT_ID] } }, RESTAURANT_ID)).rejects.toThrow("FORBIDDEN_SCOPE");
  });

  it("denies customer access from restaurantId or restaurantIds fields", async () => {
    const { requireRestaurantAccess } = await import("../../graphql/guards.js");
    await expect(requireRestaurantAccess({ user: { id: "c1", roleName: "customer", restaurantId: RESTAURANT_ID, restaurantIds: [RESTAURANT_ID] } }, RESTAURANT_ID)).rejects.toThrow("FORBIDDEN_SCOPE");
  });

  it("normalizes _id-only authenticated contexts", async () => {
    const { requireAuth } = await import("../../graphql/guards.js");
    const ctx = { user: { _id: "u1" } };
    expect(() => requireAuth(ctx)).not.toThrow();
    expect(ctx.user.id).toBe("u1");
  });
});
