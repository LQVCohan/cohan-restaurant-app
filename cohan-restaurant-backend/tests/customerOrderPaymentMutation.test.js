import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  countDocuments: vi.fn(),
  requireRestaurantPermission: vi.fn(),
  createOrderPayment: vi.fn(),
  sanitizePaymentSessionForClient: vi.fn((value) => value),
}));

vi.mock("../models/index.js", () => ({
  Order: { countDocuments: mocks.countDocuments },
}));

vi.mock("../src/services/auth/authorization.service.js", () => ({
  requireRestaurantPermission: mocks.requireRestaurantPermission,
}));

vi.mock("../src/services/payment/paymentSession.service.js", () => ({
  createOrderPayment: mocks.createOrderPayment,
  sanitizePaymentSessionForClient: mocks.sanitizePaymentSessionForClient,
}));

import {
  canCustomerPayOwnOrders,
  createCustomerOwnedOrderPayment,
} from "../graphql/resolvers/payment/customerOrderPaymentMutation.js";

const userId = "64b000000000000000000001";
const restaurantId = "64b000000000000000000002";
const orderId = "64b000000000000000000003";

describe("customer order payment mutation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.countDocuments.mockResolvedValue(1);
    mocks.createOrderPayment.mockResolvedValue({ id: "payment-1", payUrl: "https://pay.test" });
  });

  it("recognizes orders owned by the authenticated customer", async () => {
    await expect(
      canCustomerPayOwnOrders({ userId, restaurantId, orderIds: [orderId] }),
    ).resolves.toBe(true);
  });

  it("allows a customer to create VNPAY for their own order without staff permission", async () => {
    const input = {
      restaurantId,
      orderIds: [orderId],
      provider: "vnpay",
      paymentMethod: "vnpay",
    };

    await expect(
      createCustomerOwnedOrderPayment(null, { input }, { user: { id: userId } }),
    ).resolves.toMatchObject({ id: "payment-1" });

    expect(mocks.requireRestaurantPermission).not.toHaveBeenCalled();
    expect(mocks.createOrderPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        ...input,
        userId,
      }),
    );
  });

  it("keeps the existing permission check for orders not owned by the actor", async () => {
    mocks.countDocuments.mockResolvedValue(0);
    const input = {
      restaurantId,
      orderIds: [orderId],
      provider: "vnpay",
    };

    await createCustomerOwnedOrderPayment(
      null,
      { input },
      { user: { id: userId } },
    );

    expect(mocks.requireRestaurantPermission).toHaveBeenCalledOnce();
  });
});
