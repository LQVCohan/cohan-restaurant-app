import { describe, expect, it, vi } from "vitest";

import { emitOrderEvent } from "../../graphql/resolvers/order/helper/emitOrderEvent.js";

function createSocketContext() {
  const emit = vi.fn();
  const to = vi.fn(() => ({ emit }));
  return { ctx: { io: { to } }, to, emit };
}

describe("emitOrderEvent", () => {
  it("keeps the standard order payload contract", async () => {
    const { ctx, emit } = createSocketContext();
    const order = { id: "order-1", currentStatus: "pending" };

    await emitOrderEvent(ctx, "restaurant-1", "ORDER_CREATED", order);

    expect(emit).toHaveBeenCalledWith("orderEvents", {
      type: "ORDER_CREATED",
      order,
    });
  });

  it("does not wrap an explicit order payload twice", async () => {
    const { ctx, emit } = createSocketContext();
    const order = { id: "order-1", currentStatus: "confirmed" };
    const meta = { statusFrom: "pending", statusTo: "confirmed" };

    await emitOrderEvent(ctx, "restaurant-1", "ORDER_STATUS_CHANGED", {
      order,
      meta,
    });

    expect(emit).toHaveBeenCalledWith("orderEvents", {
      type: "ORDER_STATUS_CHANGED",
      order,
      meta,
    });
  });
});
