import { beforeEach, describe, expect, it, vi } from "vitest";

const guardMocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  requireRestaurantAccess: vi.fn(),
}));
const serviceMocks = vi.hoisted(() => ({
  getStaffPerformancePolicy: vi.fn(),
  updateStaffPerformancePolicy: vi.fn(),
  applyPerformancePolicyToRecalculationResult: vi.fn(),
}));

vi.mock("../../graphql/guards.js", () => guardMocks);
vi.mock(
  "../../src/services/staffPerformance/staffPerformancePolicy.service.js",
  () => serviceMocks,
);

describe("staff performance policy resolvers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guardMocks.requireRestaurantAccess.mockResolvedValue();
    serviceMocks.getStaffPerformancePolicy.mockResolvedValue({
      restaurantId: "restaurant-1",
    });
    serviceMocks.updateStaffPerformancePolicy.mockResolvedValue({
      restaurantId: "restaurant-1",
    });
    serviceMocks.applyPerformancePolicyToRecalculationResult.mockImplementation(
      async ({ result }) => result,
    );
  });

  it("checks authentication and restaurant scope before reading policy", async () => {
    const resolvers = (
      await import(
        "../../graphql/resolvers/staffPerformancePolicy/index.js"
      )
    ).default;
    const ctx = { user: { id: "manager-1" } };

    await resolvers.Query.staffPerformancePolicy(
      null,
      { restaurantId: "restaurant-1" },
      ctx,
    );

    expect(guardMocks.requireAuth).toHaveBeenCalledWith(ctx);
    expect(guardMocks.requireRestaurantAccess).toHaveBeenCalledWith(
      ctx,
      "restaurant-1",
    );
    expect(serviceMocks.getStaffPerformancePolicy).toHaveBeenCalledWith({
      restaurantId: "restaurant-1",
      ctx,
    });
  });

  it("checks restaurant scope before updating policy", async () => {
    const resolvers = (
      await import(
        "../../graphql/resolvers/staffPerformancePolicy/index.js"
      )
    ).default;
    const ctx = { user: { id: "manager-1" } };
    const input = {
      restaurantId: "restaurant-1",
      levelThresholds: {
        excellentMin: 92,
        goodMin: 82,
        averageMin: 68,
        needsAttentionMin: 52,
      },
    };

    await resolvers.Mutation.updateStaffPerformancePolicy(
      null,
      { input },
      ctx,
    );

    expect(guardMocks.requireRestaurantAccess).toHaveBeenCalledWith(
      ctx,
      "restaurant-1",
    );
    expect(serviceMocks.updateStaffPerformancePolicy).toHaveBeenCalledWith({
      input,
      ctx,
    });
  });

  it("guards recalculation before delegating and reapplies saved thresholds", async () => {
    const baseResolver = vi.fn().mockResolvedValue([
      { id: "snapshot-1", finalPerformanceScore: 84 },
    ]);
    const { wrapPerformanceRecalculation } = await import(
      "../../graphql/resolvers/staffPerformancePolicy/index.js"
    );
    const resolver = wrapPerformanceRecalculation(baseResolver);
    const ctx = { user: { id: "manager-1" } };
    const args = {
      input: {
        restaurantId: "restaurant-1",
        periodStart: "2026-07-01",
        periodEnd: "2026-07-31",
      },
    };

    await resolver(null, args, ctx, undefined);

    expect(guardMocks.requireAuth).toHaveBeenCalledWith(ctx);
    expect(guardMocks.requireRestaurantAccess).toHaveBeenCalledWith(
      ctx,
      "restaurant-1",
    );
    expect(baseResolver).toHaveBeenCalledWith(null, args, ctx, undefined);
    expect(
      serviceMocks.applyPerformancePolicyToRecalculationResult,
    ).toHaveBeenCalledWith({
      result: [{ id: "snapshot-1", finalPerformanceScore: 84 }],
      restaurantId: "restaurant-1",
    });
  });

  it("does not delegate recalculation without a restaurant", async () => {
    const baseResolver = vi.fn();
    const { wrapPerformanceRecalculation } = await import(
      "../../graphql/resolvers/staffPerformancePolicy/index.js"
    );
    const resolver = wrapPerformanceRecalculation(baseResolver);

    await expect(
      resolver(null, { input: {} }, { user: { id: "manager-1" } }),
    ).rejects.toThrow("restaurantId không hợp lệ");
    expect(baseResolver).not.toHaveBeenCalled();
  });
});
