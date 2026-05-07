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

  it("allows manager when Restaurant.managerId matches", async () => {
    modelMocks.Restaurant.exists.mockResolvedValue(true);
    const { requireRestaurantAccess } = await import("../../graphql/guards.js");
    await expect(requireRestaurantAccess({ user: { id: "manager-a", roles: ["manager"] } }, "r1")).resolves.toBeUndefined();
  });

  it("allows staff when restaurantForStaff matches", async () => {
    const { requireRestaurantAccess } = await import("../../graphql/guards.js");
    await expect(requireRestaurantAccess({ user: { id: "s1", roleName: "server", restaurantForStaff: "r1" } }, "r1")).resolves.toBeUndefined();
  });

  it("denies staff when restaurantForStaff mismatches", async () => {
    const { requireRestaurantAccess } = await import("../../graphql/guards.js");
    await expect(requireRestaurantAccess({ user: { id: "s1", roleName: "server", restaurantForStaff: "r1" } }, "r2")).rejects.toThrow("FORBIDDEN_SCOPE");
  });

  it("does not grant staff access from refRestaurants", async () => {
    const { requireRestaurantAccess } = await import("../../graphql/guards.js");
    await expect(
      requireRestaurantAccess({ user: { id: "s1", roleName: "staff", restaurantForStaff: "r1", refRestaurants: ["r2"] } }, "r2"),
    ).rejects.toThrow("FORBIDDEN_SCOPE");
  });
});
