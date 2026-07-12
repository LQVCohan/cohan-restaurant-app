import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createReservationPayment: vi.fn(),
  sanitizePaymentSessionForClient: vi.fn((value) => value),
}));

vi.mock("../src/services/payment/paymentSession.service.js", () => ({
  createReservationPayment: mocks.createReservationPayment,
  sanitizePaymentSessionForClient: mocks.sanitizePaymentSessionForClient,
}));

import { createReservationProviderPayment } from "../graphql/resolvers/payment/reservationPaymentMutation.js";

const originalEnv = { ...process.env };

describe("reservation provider payment mutation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.API_PUBLIC_BASE_URL;
    delete process.env.PUBLIC_BASE_URL;
    delete process.env.APP_PUBLIC_URL;
    mocks.createReservationPayment.mockResolvedValue({
      id: "payment-1",
      provider: "vnpay",
    });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("passes the public origin and customer IP into the reservation service", async () => {
    const ctx = {
      user: { id: "64b000000000000000000001" },
      request: {
        headers: {
          "x-forwarded-proto": "https",
          "x-forwarded-host": "api.cohan.example",
          "x-forwarded-for": "198.51.100.12, 10.0.0.3",
        },
      },
    };

    await expect(
      createReservationProviderPayment(
        null,
        { input: { reservationId: "64b000000000000000000002", provider: "vnpay" } },
        ctx,
      ),
    ).resolves.toMatchObject({ id: "payment-1" });

    expect(mocks.createReservationPayment).toHaveBeenCalledWith({
      reservationId: "64b000000000000000000002",
      provider: "vnpay",
      userId: "64b000000000000000000001",
      baseApiUrl: "https://api.cohan.example",
      clientIp: "198.51.100.12",
    });
  });

  it("rejects anonymous payment creation", async () => {
    await expect(
      createReservationProviderPayment(
        null,
        { input: { reservationId: "64b000000000000000000002", provider: "vnpay" } },
        {},
      ),
    ).rejects.toThrow("Unauthorized");
  });
});
