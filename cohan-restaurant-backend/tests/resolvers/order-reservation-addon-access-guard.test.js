import { beforeEach, describe, expect, it, vi } from "vitest";

const guardMocks = vi.hoisted(() => ({
  requireRestaurantAccess: vi.fn(),
}));

vi.mock("../../models/index.js", () => ({
  Order: {},
}));
vi.mock("../../graphql/guards.js", () => guardMocks);
vi.mock("../../src/services/auth/authorization.service.js", () => ({
  requireRestaurantPermission: vi.fn(),
}));
vi.mock("../../graphql/resolvers/order/confirmedOrderPrintMutation.js", () => ({
  ConfirmedOrderPrintMutation: {},
}));
vi.mock("../../graphql/resolvers/order/helper/emitOrderEvent.js", () => ({
  emitOrderEvent: vi.fn(),
}));
vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: vi.fn(() => true),
    Types: {
      ObjectId: function ObjectId(value) {
        this.value = value;
      },
    },
  },
}));

describe("reservation addon restaurant guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guardMocks.requireRestaurantAccess.mockResolvedValue(undefined);
  });

  it("delegates a customer reservation addon to the canonical resolver", async () => {
    const createOrderForTable = vi.fn().mockResolvedValue({ ok: true });
    const { withOrderRestaurantAccessGuards } = await import(
      "../../graphql/resolvers/order/accessGuard.js"
    );
    const guarded = withOrderRestaurantAccessGuards({ createOrderForTable });
    const args = {
      input: {
        restaurantId: "restaurant-1",
        reservationId: "reservation-1",
        clientMeta: { source: "reservation_cart_addon" },
      },
    };
    const ctx = { user: { id: "customer-1", roleName: "customer" } };

    await guarded.createOrderForTable(null, args, ctx);

    expect(guardMocks.requireRestaurantAccess).not.toHaveBeenCalled();
    expect(createOrderForTable).toHaveBeenCalledWith(null, args, ctx, undefined);
  });

  it("keeps restaurant scope for ordinary table orders", async () => {
    const createOrderForTable = vi.fn().mockResolvedValue({ ok: true });
    const { withOrderRestaurantAccessGuards } = await import(
      "../../graphql/resolvers/order/accessGuard.js"
    );
    const guarded = withOrderRestaurantAccessGuards({ createOrderForTable });
    const args = { input: { restaurantId: "restaurant-1" } };
    const ctx = { user: { id: "staff-1" } };

    await guarded.createOrderForTable(null, args, ctx);

    expect(guardMocks.requireRestaurantAccess).toHaveBeenCalledTimes(1);
    expect(createOrderForTable).toHaveBeenCalledWith(null, args, ctx, undefined);
  });
});
