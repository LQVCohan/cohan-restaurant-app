import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  PaymentProviderCredential: {
    find: vi.fn(),
    findOne: vi.fn(),
    findById: vi.fn(),
  },
  Restaurant: {
    findById: vi.fn(),
  },
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: vi.fn(() => true),
  },
}));

const originalEnv = { ...process.env };

function missingCredentialQuery() {
  return {
    sort: vi.fn(() => ({
      select: vi.fn(() => ({
        lean: vi.fn().mockResolvedValue(null),
      })),
    })),
  };
}

describe("platform payment credential mode", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.VNPAY_TMN_CODE = "SANDBOX_TMN";
    process.env.VNPAY_HASH_SECRET = "SANDBOX_HASH";
    process.env.VNPAY_PLATFORM_MODE = "sandbox";
    modelMocks.PaymentProviderCredential.findOne.mockReturnValue(
      missingCredentialQuery(),
    );
    modelMocks.PaymentProviderCredential.find.mockReturnValue({
      lean: vi.fn().mockResolvedValue([]),
    });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("resolves platform VNPAY credentials with their real sandbox mode", async () => {
    const {
      listRestaurantPaymentCredentialStatuses,
      resolvePaymentProviderCredential,
    } = await import("../../src/services/payment/paymentCredential.service.js");

    const resolved = await resolvePaymentProviderCredential({
      restaurantId: "restaurant-1",
      provider: "vnpay",
      mode: "production",
    });

    expect(resolved).toMatchObject({
      source: "platform",
      credentialId: null,
      mode: "sandbox",
      credentials: {
        tmnCode: "SANDBOX_TMN",
        hashSecret: "SANDBOX_HASH",
      },
    });

    const statuses = await listRestaurantPaymentCredentialStatuses("restaurant-1");
    expect(
      statuses.find(
        (item) => item.provider === "vnpay" && item.mode === "sandbox",
      ),
    ).toMatchObject({ configured: true, source: "platform" });
    expect(
      statuses.find(
        (item) => item.provider === "vnpay" && item.mode === "production",
      ),
    ).toMatchObject({ configured: false, source: "none" });
  });

  it("uses the mode bound to the payment instead of the stale restaurant mode", async () => {
    const { createVnpayPayment } = await import(
      "../../src/services/payment/providers.js"
    );

    const result = createVnpayPayment({
      payment: {
        reference: "VNPAY-TEST-1",
        amount: 45000,
        providerCredentialMode: "sandbox",
        $locals: {
          paymentProviderCredentials: {
            tmnCode: "SANDBOX_TMN",
            hashSecret: "SANDBOX_HASH",
            bankCode: "",
          },
        },
      },
      ipAddr: "127.0.0.1",
      returnUrl: "http://127.0.0.1:4000/api/payments/return/vnpay",
      mode: "production",
      now: new Date("2026-07-11T02:00:00.000Z"),
    });

    expect(new URL(result.payUrl).hostname).toBe("sandbox.vnpayment.vn");
  });
});
