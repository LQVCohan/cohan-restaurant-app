import { describe, expect, it } from "vitest";
import {
  buildPaymentCallbackUrls,
  buildPaymentWebReturnUrl,
  getPlatformVnpayBankCode,
  listPaymentIntegrationReadiness,
} from "../../src/services/payment/paymentIntegrationConfig.service.js";
import { normalizeCredentialPayload } from "../../src/services/payment/paymentCredential.service.js";

const productionEnv = {
  NODE_ENV: "production",
  PAYMENT_PUBLIC_BASE_URL: "https://api.cohan.vn/",
  PAYMENT_WEB_RETURN_URL: "https://cohan.vn/",
  PAYMENT_CREDENTIAL_ENCRYPTION_KEY: "test-encryption-key",
  VNPAY_BANK_CODE: "VNPAYQR",
};

describe("payment integration platform configuration", () => {
  it("builds shared callback URLs once for all restaurant merchants", () => {
    expect(buildPaymentCallbackUrls("vnpay", { env: productionEnv })).toEqual({
      publicBaseUrl: "https://api.cohan.vn",
      returnUrl: "https://api.cohan.vn/api/payments/return/vnpay",
      ipnUrl: "https://api.cohan.vn/api/payments/webhooks/vnpay",
    });
  });

  it("marks a production integration ready only with public HTTPS and encryption", () => {
    const readiness = listPaymentIntegrationReadiness({ env: productionEnv });
    const vnpay = readiness.find(
      (item) => item.provider === "vnpay" && item.mode === "production",
    );

    expect(vnpay).toMatchObject({
      ready: true,
      callbackReady: true,
      webReturnReady: true,
      encryptionReady: true,
      paymentChannel: "VNPAYQR",
      blockers: [],
    });
  });

  it("blocks production when the platform still points callbacks to localhost", () => {
    const readiness = listPaymentIntegrationReadiness({
      env: {
        NODE_ENV: "production",
        PAYMENT_PUBLIC_BASE_URL: "http://localhost:4000",
        PAYMENT_WEB_RETURN_URL: "http://localhost:5173",
        PAYMENT_CREDENTIAL_ENCRYPTION_KEY: "",
      },
    });
    const momo = readiness.find(
      (item) => item.provider === "momo" && item.mode === "production",
    );

    expect(momo.ready).toBe(false);
    expect(momo.encryptionReady).toBe(false);
    expect(momo.callbackReady).toBe(false);
    expect(momo.webReturnReady).toBe(false);
    expect(momo.blockers.join(" ")).toContain("HTTPS công khai");
  });

  it("keeps VNPAY channel platform-owned instead of accepting it from a restaurant form", () => {
    expect(
      normalizeCredentialPayload("vnpay", {
        tmnCode: "ABC12345",
        hashSecret: "merchant-secret",
        bankCode: "INTCARD",
      }),
    ).toEqual({
      tmnCode: "ABC12345",
      hashSecret: "merchant-secret",
    });
    expect(getPlatformVnpayBankCode({ env: productionEnv })).toBe("VNPAYQR");
  });

  it("builds a safe frontend return destination from platform config", () => {
    expect(
      buildPaymentWebReturnUrl(
        { provider: "vnpay", status: "success", reference: "ORD 123" },
        { env: productionEnv },
      ),
    ).toBe(
      "https://cohan.vn/?paymentProvider=vnpay&paymentStatus=success&paymentReference=ORD+123",
    );
  });
});
