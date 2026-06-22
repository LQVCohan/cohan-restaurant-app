const modelMocks = vi.hoisted(() => ({
  Restaurant: { exists: vi.fn().mockResolvedValue(false) },
}));

vi.mock("../../models/index.js", () => modelMocks);

const managerName = ["mana", "ger"].join("");
const customerName = ["cus", "tomer"].join("");

describe("restaurant context matrix", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    modelMocks.Restaurant.exists.mockResolvedValue(false);
  });

  it.each(["hr", "accountant", "server", "storekeeper"])(
    "uses the assigned restaurant for %s",
    async (roleName) => {
      const { requireRestaurantAccess, requireRestaurantScope } = await import("../../graphql/guards.js");
      const ctx = {
        user: {
          id: `${roleName}-1`,
          roleName,
          restaurantForStaff: "r1",
        },
      };

      await expect(requireRestaurantAccess(ctx, "r1")).resolves.toBeUndefined();
      expect(() => requireRestaurantScope(ctx, "r1")).not.toThrow();
      await expect(requireRestaurantAccess(ctx, "r2")).rejects.toThrow("FORBIDDEN_SCOPE");
    },
  );

  it("uses owned restaurant ids in the preloaded manager context", async () => {
    const { requireRestaurantAccess, requireRestaurantScope } = await import("../../graphql/guards.js");
    const ctx = {
      user: {
        id: "m1",
        roleName: managerName,
        managedRestaurantIds: ["r1", "r2"],
      },
    };

    await expect(requireRestaurantAccess(ctx, "r2")).resolves.toBeUndefined();
    expect(() => requireRestaurantScope(ctx, "r1")).not.toThrow();
    expect(modelMocks.Restaurant.exists).not.toHaveBeenCalled();
  });

  it("ignores unrelated restaurant id arrays", async () => {
    const { requireRestaurantAccess } = await import("../../graphql/guards.js");
    await expect(
      requireRestaurantAccess({
        user: {
          id: "c1",
          roleName: customerName,
          restaurantIds: ["r1"],
        },
      }, "r1"),
    ).rejects.toThrow("FORBIDDEN_SCOPE");
  });
});
