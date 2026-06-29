import { beforeEach, describe, expect, it, vi } from "vitest";

const scopeMocks = vi.hoisted(() => ({ canAccessRestaurant: vi.fn() }));
vi.mock("../../src/services/auth/restaurantScope.service.js", () => scopeMocks);

const RESTAURANT_ID = "665f665f665f665f665f6611";

describe("requireRestaurantAccess", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    scopeMocks.canAccessRestaurant.mockResolvedValue(false);
  });

  it("delegates restaurant scope to restaurantScope.service", async () => {
    scopeMocks.canAccessRestaurant.mockResolvedValue(true);
    const { requireRestaurantAccess } = await import("../../graphql/guards.js");
    const ctx = { user: { id: "u1", roleName: "manager" } };
    await expect(requireRestaurantAccess(ctx, RESTAURANT_ID)).resolves.toBeUndefined();
    expect(scopeMocks.canAccessRestaurant).toHaveBeenCalledWith(ctx.user, RESTAURANT_ID);
  });

  it("throws FORBIDDEN_SCOPE when service denies", async () => {
    const { requireRestaurantAccess } = await import("../../graphql/guards.js");
    await expect(requireRestaurantAccess({ user: { id: "u1" } }, RESTAURANT_ID)).rejects.toThrow("FORBIDDEN_SCOPE");
  });

  it("normalizes _id-only authenticated contexts", async () => {
    const { requireAuth } = await import("../../graphql/guards.js");
    const ctx = { user: { _id: "u1" } };
    expect(() => requireAuth(ctx)).not.toThrow();
    expect(ctx.user.id).toBe("u1");
  });
});
