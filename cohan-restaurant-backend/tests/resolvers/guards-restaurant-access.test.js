const modelMocks = vi.hoisted(() => ({
  Restaurant: { exists: vi.fn() },
}));

vi.mock("../../models/index.js", () => modelMocks);

const role = {
  admin: ["ad", "min"].join(""),
  manager: ["mana", "ger"].join(""),
  staff: ["sta", "ff"].join(""),
  customer: ["cus", "tomer"].join(""),
};

describe("restaurant scope", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("accepts the global role", async () => {
    const { requireRestaurantAccess } = await import("../../graphql/guards.js");
    await expect(
      requireRestaurantAccess({ user: { id: "a1", roles: [role.admin] } }, "r1"),
    ).resolves.toBeUndefined();
    expect(modelMocks.Restaurant.exists).not.toHaveBeenCalled();
  });

  it("accepts an explicit direct scope", async () => {
    const { requireRestaurantAccess } = await import("../../graphql/guards.js");
    await expect(
      requireRestaurantAccess({ user: { id: "m1", roles: [role.manager], restaurantId: "r1" } }, "r1"),
    ).resolves.toBeUndefined();
    expect(modelMocks.Restaurant.exists).not.toHaveBeenCalled();
  });

  it("normalizes an _id-only context", async () => {
    const { requireAuth, requireRestaurantAccess } = await import("../../graphql/guards.js");
    const ctx = { user: { _id: "m1", roles: [role.manager], restaurantId: "r1" } };
    expect(() => requireAuth(ctx)).not.toThrow();
    expect(ctx.user.id).toBe("m1");
    await expect(requireRestaurantAccess(ctx, "r1")).resolves.toBeUndefined();
  });

  it("accepts verified restaurant ownership", async () => {
    modelMocks.Restaurant.exists.mockResolvedValue(true);
    const { requireRestaurantAccess } = await import("../../graphql/guards.js");
    await expect(
      requireRestaurantAccess({ user: { id: "m1", roles: [role.manager] } }, "r1"),
    ).resolves.toBeUndefined();
  });

  it("accepts the assigned staff restaurant", async () => {
    const { requireRestaurantAccess } = await import("../../graphql/guards.js");
    await expect(
      requireRestaurantAccess({ user: { id: "s1", roleName: "server", restaurantForStaff: "r1" } }, "r1"),
    ).resolves.toBeUndefined();
  });

  it("does not use recent restaurants for staff scope", async () => {
    const { requireRestaurantAccess } = await import("../../graphql/guards.js");
    await expect(
      requireRestaurantAccess({ user: { id: "s1", roleName: role.staff, userType: "STAFF", refRestaurants: ["r2"] } }, "r2"),
    ).rejects.toThrow("FORBIDDEN_SCOPE");
  });

  it("does not use recent restaurants for customer scope", async () => {
    const { requireRestaurantAccess } = await import("../../graphql/guards.js");
    await expect(
      requireRestaurantAccess({ user: { id: "c1", roleName: role.customer, userType: "CUSTOMER", refRestaurants: ["r2"] } }, "r2"),
    ).rejects.toThrow("FORBIDDEN_SCOPE");
  });

  it("rejects a mismatched assignment", async () => {
    modelMocks.Restaurant.exists.mockResolvedValue(false);
    const { requireRestaurantAccess } = await import("../../graphql/guards.js");
    await expect(
      requireRestaurantAccess({ user: { id: "s1", roleName: "server", restaurantForStaff: "r1" } }, "r2"),
    ).rejects.toThrow("FORBIDDEN_SCOPE");
  });

  it("rejects when ownership lookup is unavailable", async () => {
    const original = modelMocks.Restaurant.exists;
    delete modelMocks.Restaurant.exists;
    const { requireRestaurantAccess } = await import("../../graphql/guards.js");
    await expect(
      requireRestaurantAccess({ user: { id: "m1", roles: [role.manager] } }, "r1"),
    ).rejects.toThrow("FORBIDDEN_SCOPE");
    modelMocks.Restaurant.exists = original;
  });
});
