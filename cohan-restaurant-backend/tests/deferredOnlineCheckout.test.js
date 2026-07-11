import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  orderUpdateMany: vi.fn(),
  checkoutUpdateOne: vi.fn(),
  payOrdersWithWallet: vi.fn(),
  emitPaymentRealtime: vi.fn(),
}));

vi.mock("../models/index.js", () => ({
  Order: { updateMany: mocks.orderUpdateMany },
  CheckoutSession: { updateOne: mocks.checkoutUpdateOne },
}));

vi.mock("../src/services/wallet/wallet.service.js", () => ({
  payOrdersWithWallet: mocks.payOrdersWithWallet,
}));

vi.mock("../src/services/payment/paymentRealtime.service.js", () => ({
  emitPaymentRealtime: mocks.emitPaymentRealtime,
}));

import { withDeferredOnlineCheckout } from "../graphql/resolvers/order/deferredOnlineCheckout.js";

describe("deferred online checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.orderUpdateMany.mockResolvedValue({ modifiedCount: 1 });
    mocks.checkoutUpdateOne.mockResolvedValue({ modifiedCount: 1 });
    mocks.emitPaymentRealtime.mockResolvedValue(undefined);
    mocks.payOrdersWithWallet.mockResolvedValue({
      ok: true,
      paymentTransactionId: "payment-transaction-1",
      paymentSession: {
        id: "payment-session-1",
        provider: "cohan_wallet",
        metadata: { orderIds: ["order-1"] },
      },
      amount: 125000,
    });
  });

  it("reuses deferred checkout for card/VNPAY and restores the online method", async () => {
    const createCheckoutOrders = vi.fn(async () => ({
      checkout: { checkoutCode: "CHK-1", orderIds: ["order-1"] },
      orders: [
        {
          id: "order-1",
          currentStatus: "draft",
          payment: { method: "transfer" },
        },
      ],
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
    expect(mocks.payOrdersWithWallet).not.toHaveBeenCalled();
  });

  it("debits Cohan wallet before returning checkout success", async () => {
    const createCheckoutOrders = vi.fn(async () => ({
      checkout: { checkoutCode: "CHK-WALLET", orderIds: ["order-1"] },
      orders: [
        {
          id: "order-1",
          restaurantId: "restaurant-1",
          currentStatus: "draft",
          totals: { grandTotal: 125000 },
          payment: { method: "transfer", status: "pending" },
        },
      ],
    }));
    const mutation = withDeferredOnlineCheckout({ createCheckoutOrders });

    const result = await mutation.createCheckoutOrders(
      null,
      {
        input: {
          paymentMethod: "wallet",
          idempotencyKey: "checkout-wallet-key",
          items: [{ id: "item-1", restaurantId: "restaurant-1" }],
        },
      },
      { user: { id: "user-1" }, io: {} },
      null,
    );

    expect(createCheckoutOrders).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        input: expect.objectContaining({ paymentMethod: "transfer" }),
      }),
      expect.any(Object),
      null,
    );
    expect(mocks.payOrdersWithWallet).toHaveBeenCalledWith({
      userId: "user-1",
      restaurantId: "restaurant-1",
      orderIds: ["order-1"],
      idempotencyKey: "checkout-wallet-key:wallet",
    });
    expect(mocks.checkoutUpdateOne).toHaveBeenLastCalledWith(
      { checkoutCode: "CHK-WALLET" },
      expect.objectContaining({
        $set: expect.objectContaining({
          "payment.method": "wallet",
          "payment.status": "paid",
          "payment.transactionId": "payment-transaction-1",
        }),
      }),
    );
    expect(result.orders[0]).toMatchObject({
      currentStatus: "pending",
      payment: {
        method: "e_wallet",
        provider: "cohan_wallet",
        status: "paid",
        paidAmount: 125000,
        transactionId: "payment-transaction-1",
      },
    });
    expect(mocks.emitPaymentRealtime).toHaveBeenCalledWith({
      io: {},
      payment: expect.objectContaining({ provider: "cohan_wallet" }),
      eventType: "PAYMENT_VERIFIED",
    });
  });

  it("rejects multi-restaurant wallet checkout before orders are created", async () => {
    const createCheckoutOrders = vi.fn();
    const mutation = withDeferredOnlineCheckout({ createCheckoutOrders });

    await expect(
      mutation.createCheckoutOrders(
        null,
        {
          input: {
            paymentMethod: "wallet",
            items: [
              { restaurantId: "restaurant-1" },
              { restaurantId: "restaurant-2" },
            ],
          },
        },
        { user: { id: "user-1" } },
        null,
      ),
    ).rejects.toThrow("one restaurant");
    expect(createCheckoutOrders).not.toHaveBeenCalled();
    expect(mocks.payOrdersWithWallet).not.toHaveBeenCalled();
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
    expect(mocks.payOrdersWithWallet).not.toHaveBeenCalled();
  });
});
