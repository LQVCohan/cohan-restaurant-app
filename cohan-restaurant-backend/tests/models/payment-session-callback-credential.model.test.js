import { beforeEach, describe, expect, it, vi } from "vitest";

const credentialService = vi.hoisted(() => ({
  decryptPaymentCredential: vi.fn(),
  encryptPaymentCredential: vi.fn(),
  getPlatformPaymentCredentials: vi.fn(),
  hasCompletePaymentCredentials: vi.fn(),
  resolvePaymentProviderCredential: vi.fn(),
}));

const providerService = vi.hoisted(() => ({
  primePaymentCredentialContext: vi.fn(),
}));

vi.mock("../../src/services/payment/paymentCredential.service.js", () =>
  credentialService,
);

vi.mock("../../src/services/payment/providers.js", () => providerService);

const {
  primeCallbackCredentialsForPayments,
  resolveCallbackCredentialsForPayment,
} = await import("../../models/payment-session.model.js");

describe("payment session callback credential provenance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    credentialService.hasCompletePaymentCredentials.mockReturnValue(true);
  });

  it("prefers the encrypted credential snapshot used to create the payment", async () => {
    const snapshotCredentials = {
      tmnCode: "SNAPSHOT-TMN",
      hashSecret: "snapshot-secret",
    };
    credentialService.decryptPaymentCredential.mockReturnValue({
      provider: "vnpay",
      mode: "sandbox",
      credentials: snapshotCredentials,
    });
    credentialService.getPlatformPaymentCredentials.mockReturnValue({
      tmnCode: "CHANGED-PLATFORM-TMN",
      hashSecret: "changed-platform-secret",
    });

    await expect(
      resolveCallbackCredentialsForPayment({
        provider: "vnpay",
        providerCredentialSource: "platform",
        providerCredentialMode: "sandbox",
        callbackCredentialCiphertext: "encrypted-snapshot",
        restaurantId: "restaurant-1",
      }),
    ).resolves.toEqual(snapshotCredentials);

    expect(credentialService.decryptPaymentCredential).toHaveBeenCalledWith(
      "encrypted-snapshot",
    );
    expect(
      credentialService.getPlatformPaymentCredentials,
    ).not.toHaveBeenCalled();
    expect(
      credentialService.resolvePaymentProviderCredential,
    ).not.toHaveBeenCalled();
  });

  it("primes the exact VNPAY credential for sessions returned by a POS find query", async () => {
    const credentials = {
      tmnCode: "POS-TMN",
      hashSecret: "pos-hash-secret",
    };
    credentialService.decryptPaymentCredential.mockReturnValue({
      provider: "vnpay",
      mode: "sandbox",
      credentials,
    });
    const payment = {
      _id: "payment-pos-1",
      provider: "vnpay",
      reference: "ORD-20260714-4AC263",
      callbackCredentialCiphertext: "encrypted-pos-snapshot",
      $locals: {},
    };

    await expect(
      primeCallbackCredentialsForPayments([payment]),
    ).resolves.toBe(1);

    expect(payment.$locals.paymentProviderCredentials).toEqual(credentials);
    expect(
      payment.$locals.paymentCredentialResolutionError,
    ).toBeUndefined();
    expect(providerService.primePaymentCredentialContext).toHaveBeenCalledWith(
      "vnpay",
      "ORD-20260714-4AC263",
      credentials,
    );
  });

  it("loads an unselected encrypted snapshot before priming callback verification", async () => {
    const credentials = {
      tmnCode: "POS-TMN",
      hashSecret: "pos-hash-secret",
    };
    credentialService.decryptPaymentCredential.mockReturnValue({
      provider: "vnpay",
      credentials,
    });
    const collection = {
      findOne: vi.fn().mockResolvedValue({
        callbackCredentialCiphertext: "encrypted-from-storage",
      }),
    };
    const payment = {
      _id: "payment-pos-2",
      provider: "vnpay",
      reference: "ORD-20260714-NEW001",
      callbackCredentialCiphertext: undefined,
      $locals: {},
    };

    await expect(
      primeCallbackCredentialsForPayments(payment, { collection }),
    ).resolves.toBe(1);

    expect(collection.findOne).toHaveBeenCalledWith(
      { _id: "payment-pos-2" },
      { projection: { callbackCredentialCiphertext: 1 } },
    );
    expect(payment.callbackCredentialCiphertext).toBe(
      "encrypted-from-storage",
    );
    expect(providerService.primePaymentCredentialContext).toHaveBeenCalledWith(
      "vnpay",
      "ORD-20260714-NEW001",
      credentials,
    );
  });

  it("marks a reused POS session when its callback credential cannot be restored", async () => {
    credentialService.decryptPaymentCredential.mockImplementation(() => {
      throw new Error("PAYMENT_CALLBACK_CREDENTIAL_DECRYPT_FAILED");
    });
    const payment = {
      _id: "payment-pos-broken",
      provider: "vnpay",
      reference: "ORD-20260714-BROKEN",
      callbackCredentialCiphertext: "invalid-ciphertext",
      $locals: {},
    };

    await expect(
      primeCallbackCredentialsForPayments([payment]),
    ).resolves.toBe(0);

    expect(payment.$locals.paymentCredentialResolutionError).toBe(
      "PAYMENT_CALLBACK_CREDENTIAL_DECRYPT_FAILED",
    );
    expect(
      providerService.primePaymentCredentialContext,
    ).not.toHaveBeenCalled();
  });

  it("rejects a credential snapshot from another provider", async () => {
    credentialService.decryptPaymentCredential.mockReturnValue({
      provider: "momo",
      credentials: {
        partnerCode: "MOMO",
        accessKey: "access",
        secretKey: "secret",
      },
    });

    await expect(
      resolveCallbackCredentialsForPayment({
        provider: "vnpay",
        callbackCredentialCiphertext: "encrypted-wrong-provider",
      }),
    ).rejects.toThrow("PAYMENT_CALLBACK_CREDENTIAL_PROVIDER_MISMATCH");
  });

  it("keeps a platform-created legacy payment on the platform credential", async () => {
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

  it("uses the exact credential version stored on a legacy restaurant payment", async () => {
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

  it("rejects a legacy restaurant payment when its original credential id is missing", async () => {
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
