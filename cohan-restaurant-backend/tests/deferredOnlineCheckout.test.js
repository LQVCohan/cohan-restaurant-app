import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  orderUpdateMany: vi.fn(),
  checkoutUpdateOne: vi.fn(),
}));

vi.mock("../models/index.js", () => ({
  Order: { updateMany: mocks.orderUpdateMany },
  CheckoutSession: { updateOne: mocks.checkoutUpdateOne },
}));

import { withDeferredOnlineCheckout } from "../graphql/resolvers/order/deferredOnlineCheckout.js";

describe("deferred online checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.orderUpdateMany.mockResolvedValue({ modifiedCount: 1 });
    mocks.checkoutUpdateOne.mockResolvedValue({ modifiedCount: 1 });
  });

  it("reuses deferred checkout for card/VNPAY and restores the online method", async () => {
    const createCheckoutOrders = vi.fn(async () => ({
      checkout: { checkoutCode: "CHK-1", orderIds: ["order-1"] },
      orders: [{ id: "order-1", currentStatus: "draft", payment: { method: "transfer" } }],
    }));
    const mutation = withDeferredOnlineCheckout({ createCheckoutOrders });

    const result = await mutation.createCheckoutOrders(
      null,
      { input: { paymentMethod: "card", items: [{ id: "item-1" }] } },
      {},
      null,
    );

    expect(createCheckoutOrders).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        input: expect.objectContaining({ paymentMethod: "transfer" }),
      }),
      {},
      null,
    );
    expect(mocks.orderUpdateMany).toHaveBeenCalledWith(
      { _id: { $in: ["order-1"] } },
      expect.objectContaining({
        $set: expect.objectContaining({
          "payment.method": "card",
          "payment.status": "pending",
        }),
      }),
    );
    expect(mocks.checkoutUpdateOne).toHaveBeenCalledWith(
      { checkoutCode: "CHK-1" },
      expect.objectContaining({
        $set: expect.objectContaining({ "payment.method": "card" }),
      }),
    );
    expect(result.orders[0]).toMatchObject({
      currentStatus: "draft",
      payment: { method: "card", status: "pending" },
    });
  });

  it("does not alter cash checkout", async () => {
    const expected = { checkout: { checkoutCode: "CHK-2" }, orders: [] };
    const createCheckoutOrders = vi.fn(async () => expected);
    const mutation = withDeferredOnlineCheckout({ createCheckoutOrders });

    await expect(
      mutation.createCheckoutOrders(
        null,
        { input: { paymentMethod: "cash" } },
        {},
        null,
      ),
    ).resolves.toBe(expected);
    expect(createCheckoutOrders).toHaveBeenCalledWith(
      null,
      { input: { paymentMethod: "cash" } },
      {},
      null,
    );
    expect(mocks.orderUpdateMany).not.toHaveBeenCalled();
  });
});
