import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const paymentQuery = {
    select: vi.fn(),
    sort: vi.fn(),
  };
  paymentQuery.select.mockReturnValue(paymentQuery);

  return {
    countDocuments: vi.fn(),
    requireRestaurantPermission: vi.fn(),
    createOrderPayment: vi.fn(),
    sanitizePaymentSessionForClient: vi.fn((value) => value),
    findPaymentSessions: vi.fn(() => paymentQuery),
    paymentQuery,
  };
});

vi.mock("../models/index.js", () => ({
  Order: { countDocuments: mocks.countDocuments },
  PaymentSession: { find: mocks.findPaymentSessions },
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
  cancelLegacyExternalOrderPaymentSessions,
  createCustomerOwnedOrderPayment,
} from "../graphql/resolvers/payment/customerOrderPaymentMutation.js";

const userId = "64b000000000000000000001";
const restaurantId = "64b000000000000000000002";
const orderId = "64b000000000000000000003";

describe("customer order payment mutation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.paymentQuery.select.mockReturnValue(mocks.paymentQuery);
    mocks.paymentQuery.sort.mockResolvedValue([]);
    mocks.findPaymentSessions.mockReturnValue(mocks.paymentQuery);
    mocks.countDocuments.mockResolvedValue(1);
    mocks.createOrderPayment.mockResolvedValue({
      id: "payment-1",
      payUrl: "https://pay.test",
    });
  });

  it("recognizes orders owned by the authenticated customer", async () => {
    await expect(
      canCustomerPayOwnOrders({ userId, restaurantId, orderIds: [orderId] }),
    ).resolves.toBe(true);
  });

  it("cancels a matching legacy POS gateway session before it can be reused", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const legacyPayment = {
      metadata: { source: "order_payment", orderIds: [orderId] },
      callbackCredentialCiphertext: undefined,
      payUrl: "https://sandbox.vnpayment.vn/old-payment",
      status: "pending",
      callbackStatus: "none",
      events: [],
      $locals: {},
      save,
    };
    mocks.paymentQuery.sort.mockResolvedValue([legacyPayment]);

    await expect(
      cancelLegacyExternalOrderPaymentSessions({
        restaurantId,
        orderIds: [orderId],
        provider: "vnpay",
        paymentMethod: "vnpay",
        now: new Date("2026-07-14T02:15:00.000Z"),
      }),
    ).resolves.toBe(1);

    expect(mocks.paymentQuery.select).toHaveBeenCalledWith(
      "+callbackCredentialCiphertext",
    );
    expect(legacyPayment.status).toBe("cancelled");
    expect(legacyPayment.cancelReason).toBe(
      "legacy_session_missing_callback_credential_snapshot",
    );
    expect(legacyPayment.events).toContainEqual({
      type: "payment_cancelled",
      payload: {
        reason: "legacy_session_missing_callback_credential_snapshot",
        source: "pos_retry_guard",
        credentialResolutionError: undefined,
      },
    });
    expect(save).toHaveBeenCalledOnce();
  });

  it("keeps a reusable POS gateway session after its callback credential is restored", async () => {
    const save = vi.fn();
    mocks.paymentQuery.sort.mockResolvedValue([
      {
        metadata: { source: "order_payment", orderIds: [orderId] },
        callbackCredentialCiphertext: "encrypted-session-credential",
        payUrl: "https://sandbox.vnpayment.vn/current-payment",
        status: "pending",
        callbackStatus: "none",
        events: [],
        $locals: { paymentProviderCredentials: { hashSecret: "secret" } },
        save,
      },
    ]);

    await expect(
      cancelLegacyExternalOrderPaymentSessions({
        restaurantId,
        orderIds: [orderId],
        provider: "vnpay",
        paymentMethod: "vnpay",
      }),
    ).resolves.toBe(0);

    expect(save).not.toHaveBeenCalled();
  });

  it("replaces a POS session whose encrypted callback credential cannot be restored", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const brokenPayment = {
      metadata: { source: "order_payment", orderIds: [orderId] },
      callbackCredentialCiphertext: "encrypted-session-credential",
      payUrl: "https://sandbox.vnpayment.vn/stale-payment",
      status: "pending",
      callbackStatus: "none",
      events: [],
      $locals: {
        paymentCredentialResolutionError:
          "PAYMENT_CALLBACK_CREDENTIAL_SNAPSHOT_INCOMPLETE",
      },
      save,
    };
    mocks.paymentQuery.sort.mockResolvedValue([brokenPayment]);

    await expect(
      cancelLegacyExternalOrderPaymentSessions({
        restaurantId,
        orderIds: [orderId],
        provider: "vnpay",
        paymentMethod: "vnpay",
      }),
    ).resolves.toBe(1);

    expect(brokenPayment.cancelReason).toBe(
      "callback_credential_snapshot_unreadable",
    );
    expect(brokenPayment.events.at(-1)).toMatchObject({
      type: "payment_cancelled",
      payload: {
        source: "pos_retry_guard",
        credentialResolutionError:
          "PAYMENT_CALLBACK_CREDENTIAL_SNAPSHOT_INCOMPLETE",
      },
    });
    expect(save).toHaveBeenCalledOnce();
  });

  it("replaces a POS session after a provider callback signature was rejected", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const rejectedPayment = {
      metadata: { source: "order_payment", orderIds: [orderId] },
      callbackCredentialCiphertext: "encrypted-session-credential",
      payUrl: "https://sandbox.vnpayment.vn/rejected-payment",
      status: "pending",
      callbackStatus: "rejected",
      events: [],
      $locals: {},
      save,
    };
    mocks.paymentQuery.sort.mockResolvedValue([rejectedPayment]);

    await expect(
      cancelLegacyExternalOrderPaymentSessions({
        restaurantId,
        orderIds: [orderId],
        provider: "vnpay",
        paymentMethod: "vnpay",
      }),
    ).resolves.toBe(1);

    expect(rejectedPayment.cancelReason).toBe(
      "previous_callback_signature_rejected",
    );
    expect(save).toHaveBeenCalledOnce();
  });

  it("does not touch bank-transfer sessions", async () => {
    await expect(
      cancelLegacyExternalOrderPaymentSessions({
        restaurantId,
        orderIds: [orderId],
        provider: "bank_transfer",
        paymentMethod: "bank_transfer",
      }),
    ).resolves.toBe(0);

    expect(mocks.findPaymentSessions).not.toHaveBeenCalled();
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
    expect(mocks.findPaymentSessions).toHaveBeenCalledOnce();
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
