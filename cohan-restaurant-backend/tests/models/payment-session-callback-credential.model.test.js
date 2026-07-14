import { beforeEach, describe, expect, it, vi } from "vitest";

const credentialService = vi.hoisted(() => ({
  getPlatformPaymentCredentials: vi.fn(),
  hasCompletePaymentCredentials: vi.fn(),
  resolvePaymentProviderCredential: vi.fn(),
}));

vi.mock("../../src/services/payment/paymentCredential.service.js", () =>
  credentialService,
);

const { resolveCallbackCredentialsForPayment } = await import(
  "../../models/payment-session.model.js"
);

describe("payment session callback credential provenance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    credentialService.hasCompletePaymentCredentials.mockReturnValue(true);
  });

  it("keeps a platform-created payment on the platform credential", async () => {
    const platformCredentials = {
      tmnCode: "PLATFORM-TMN",
      hashSecret: "platform-secret",
    };
    credentialService.getPlatformPaymentCredentials.mockReturnValue(
      platformCredentials,
    );

    await expect(
      resolveCallbackCredentialsForPayment({
        provider: "vnpay",
        providerCredentialSource: "platform",
        providerCredentialMode: "sandbox",
        restaurantId: "restaurant-1",
      }),
    ).resolves.toEqual(platformCredentials);

    expect(
      credentialService.resolvePaymentProviderCredential,
    ).not.toHaveBeenCalled();
  });

  it("uses the exact credential version stored on a restaurant payment", async () => {
    const credentials = {
      tmnCode: "RESTAURANT-TMN-V2",
      hashSecret: "restaurant-secret-v2",
    };
    credentialService.resolvePaymentProviderCredential.mockResolvedValue({
      credentials,
    });

    await expect(
      resolveCallbackCredentialsForPayment({
        provider: "vnpay",
        providerCredentialSource: "restaurant",
        providerCredentialMode: "sandbox",
        providerCredentialId: "credential-version-2",
        restaurantId: "restaurant-1",
      }),
    ).resolves.toEqual(credentials);

    expect(
      credentialService.resolvePaymentProviderCredential,
    ).toHaveBeenCalledWith({
      restaurantId: "restaurant-1",
      provider: "vnpay",
      mode: "sandbox",
      credentialId: "credential-version-2",
    });
  });

  it("rejects a restaurant payment when its original credential id is missing", async () => {
    await expect(
      resolveCallbackCredentialsForPayment({
        provider: "vnpay",
        providerCredentialSource: "restaurant",
        providerCredentialMode: "sandbox",
        restaurantId: "restaurant-1",
      }),
    ).rejects.toThrow("PAYMENT_SESSION_CREDENTIAL_ID_MISSING");

    expect(
      credentialService.resolvePaymentProviderCredential,
    ).not.toHaveBeenCalled();
  });

  it("supports legacy sessions without provenance through the compatibility resolver", async () => {
    const credentials = {
      tmnCode: "LEGACY-TMN",
      hashSecret: "legacy-secret",
    };
    credentialService.resolvePaymentProviderCredential.mockResolvedValue({
      credentials,
    });

    await expect(
      resolveCallbackCredentialsForPayment({
        provider: "vnpay",
        providerCredentialMode: "sandbox",
        providerCredentialId: null,
        restaurantId: "restaurant-legacy",
      }),
    ).resolves.toEqual(credentials);

    expect(
      credentialService.resolvePaymentProviderCredential,
    ).toHaveBeenCalledWith({
      restaurantId: "restaurant-legacy",
      provider: "vnpay",
      mode: "sandbox",
      credentialId: null,
    });
  });
});
