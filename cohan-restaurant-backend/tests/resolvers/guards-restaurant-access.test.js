const modelMocks = vi.hoisted(() => ({
  Restaurant: { exists: vi.fn() },
}));

vi.mock("../../models/index.js", () => modelMocks);

describe("requireRestaurantAccess", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("admin bypasses restaurant access", async () => {
    const { requireRestaurantAccess } = await import("../../graphql/guards.js");
    await expect(requireRestaurantAccess({ user: { id: "a1", roles: ["admin"] } }, "r1")).resolves.toBeUndefined();
    expect(modelMocks.Restaurant.exists).not.toHaveBeenCalled();
  });

  it("allows direct scope via restaurantId for manager without Restaurant.exists call", async () => {
    const { requireRestaurantAccess } = await import("../../graphql/guards.js");
    await expect(
      requireRestaurantAccess({ user: { id: "manager-a", roles: ["manager"], restaurantId: "r1" } }, "r1"),
    ).resolves.toBeUndefined();
    expect(modelMocks.Restaurant.exists).not.toHaveBeenCalled();
  });

  it("allows manager when Restaurant.managerId matches", async () => {
    modelMocks.Restaurant.exists.mockResolvedValue(true);
    const { requireRestaurantAccess } = await import("../../graphql/guards.js");
    await expect(requireRestaurantAccess({ user: { id: "manager-a", roles: ["manager"] } }, "r1")).resolves.toBeUndefined();
  });

  it("allows restaurantForStaff direct scope", async () => {
    const { requireRestaurantAccess } = await import("../../graphql/guards.js");
    await expect(
      requireRestaurantAccess({ user: { id: "s1", roleName: "server", restaurantForStaff: "r1" } }, "r1"),
    ).resolves.toBeUndefined();
  });

  it("denies staff-like role when only refRestaurants matches", async () => {
    const { requireRestaurantAccess } = await import("../../graphql/guards.js");
    await expect(
      requireRestaurantAccess({ user: { id: "s1", roleName: "staff", userType: "STAFF", refRestaurants: ["r2"] } }, "r2"),
    ).rejects.toThrow("FORBIDDEN_SCOPE");
  });

  it("allows non-staff direct scope via refRestaurants", async () => {
    const { requireRestaurantAccess } = await import("../../graphql/guards.js");
    await expect(
      requireRestaurantAccess({ user: { id: "c1", roleName: "customer", userType: "CUSTOMER", refRestaurants: ["r2"] } }, "r2"),
    ).resolves.toBeUndefined();
  });

  it("denies when direct scope mismatches and manager fallback is false", async () => {
    modelMocks.Restaurant.exists.mockResolvedValue(false);
    const { requireRestaurantAccess } = await import("../../graphql/guards.js");
    await expect(
      requireRestaurantAccess({ user: { id: "s1", roleName: "server", restaurantForStaff: "r1" } }, "r2"),
    ).rejects.toThrow("FORBIDDEN_SCOPE");
  });

  it("denies with FORBIDDEN_SCOPE when Restaurant.exists is missing", async () => {
    const original = modelMocks.Restaurant.exists;
    delete modelMocks.Restaurant.exists;

    const { requireRestaurantAccess } = await import("../../graphql/guards.js");
    await expect(requireRestaurantAccess({ user: { id: "m1", roles: ["manager"] } }, "r1")).rejects.toThrow("FORBIDDEN_SCOPE");

    modelMocks.Restaurant.exists = original;
  });
});
