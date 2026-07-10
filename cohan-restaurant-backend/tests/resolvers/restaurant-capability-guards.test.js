import { beforeEach, describe, expect, it, vi } from "vitest";

const model = vi.hoisted(() => ({
  Restaurant: { findById: vi.fn() },
}));

vi.mock("../../models/index.js", () => model);

describe("restaurantCapabilityGuards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getPublicRestaurantOrThrow throws for inactive restaurant", async () => {
    const guards = await import("../../graphql/resolvers/shared/restaurantCapabilityGuards.js");
    model.Restaurant.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: "r1", status: "inactive", publicationStatus: "published" }) });
    await expect(guards.getPublicRestaurantOrThrow("r1")).rejects.toBeTruthy();
  });

  it("getPublicRestaurantOrThrow throws for hidden publication", async () => {
    const guards = await import("../../graphql/resolvers/shared/restaurantCapabilityGuards.js");
    model.Restaurant.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: "r1", status: "active", publicationStatus: "hidden" }) });
    await expect(guards.getPublicRestaurantOrThrow("r1")).rejects.toBeTruthy();
  });

  it("getPublicRestaurantOrThrow returns restaurant + availability for active+published", async () => {
    const guards = await import("../../graphql/resolvers/shared/restaurantCapabilityGuards.js");
    model.Restaurant.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: "r1", status: "active", publicationStatus: "published", operationalStatus: "open", capabilities: { acceptsOrders: true } }) });
    const result = await guards.getPublicRestaurantOrThrow("r1");
    expect(result.restaurant._id).toBe("r1");
    expect(result.availability).toBeTruthy();
  });

  it("evaluates order capability at the requested booking time", async () => {
    const guards = await import("../../graphql/resolvers/shared/restaurantCapabilityGuards.js");
    model.Restaurant.findById.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: "r1",
        status: "active",
        publicationStatus: "published",
        operationalStatus: "normal",
        timezone: "Asia/Ho_Chi_Minh",
        capabilities: { acceptsOrders: true },
        weeklyOpeningHours: {
          saturday: [{ open: "08:00", close: "09:00" }],
        },
      }),
    });

    const result = await guards.getPublicRestaurantOrThrow(
      "r1",
      undefined,
      { now: new Date("2026-07-11T08:30:00+07:00") },
    );

    expect(result.availability.openingStatus).toBe("open");
    expect(result.availability.canOrder).toBe(true);
  });

  it("assertRestaurantCanOrder throws when canOrder=false", async () => {
    const guards = await import("../../graphql/resolvers/shared/restaurantCapabilityGuards.js");
    expect(() => guards.assertRestaurantCanOrder({ canOrder: false })).toThrow();
  });

  it("assertRestaurantCanReserve throws when canReserve=false", async () => {
    const guards = await import("../../graphql/resolvers/shared/restaurantCapabilityGuards.js");
    expect(() => guards.assertRestaurantCanReserve({ canReserve: false })).toThrow();
  });

  it("assertRestaurantCanReserve passes when canReserve=true", async () => {
    const guards = await import("../../graphql/resolvers/shared/restaurantCapabilityGuards.js");
    expect(() => guards.assertRestaurantCanReserve({ canReserve: true })).not.toThrow();
  });

  // TODO: add integration-level createCheckoutOrders/createReservation capability-gating tests with light fixtures.
});
