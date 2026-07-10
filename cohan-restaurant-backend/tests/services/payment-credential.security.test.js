import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  decryptPaymentCredential,
  encryptPaymentCredential,
  maskCredentialIdentifier,
  normalizeCredentialPayload,
} from "../../src/services/payment/paymentCredential.service.js";
import {
  createMomoPayment,
  createVnpayPayment,
  primePaymentCredentialContext,
  verifyMomoCallback,
} from "../../src/services/payment/providers.js";

const originalEnv = { ...process.env };

function momoCreateSignature(payload, accessKey, secretKey) {
  const raw =
    `accessKey=${accessKey}&amount=${payload.amount}&extraData=${payload.extraData}&ipnUrl=${payload.ipnUrl}` +
    `&orderId=${payload.orderId}&orderInfo=${payload.orderInfo}&partnerCode=${payload.partnerCode}` +
    `&redirectUrl=${payload.redirectUrl}&requestId=${payload.requestId}&requestType=${payload.requestType}`;
  return crypto.createHmac("sha256", secretKey).update(raw).digest("hex");
}

function momoCallbackSignature(payload, accessKey, secretKey) {
  const raw =
    `accessKey=${accessKey}&amount=${payload.amount}&extraData=${payload.extraData || ""}` +
    `&message=${payload.message || ""}&orderId=${payload.orderId}&orderInfo=${payload.orderInfo || ""}` +
    `&orderType=${payload.orderType || "momo_wallet"}&partnerCode=${payload.partnerCode}` +
    `&payType=${payload.payType || ""}&requestId=${payload.requestId}&responseTime=${payload.responseTime}` +
    `&resultCode=${payload.resultCode}&transId=${payload.transId}`;
  return crypto.createHmac("sha256", secretKey).update(raw).digest("hex");
}

describe("restaurant payment credential security", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "test";
    process.env.PAYMENT_CREDENTIAL_ENCRYPTION_KEY = "a".repeat(64);
    process.env.MOMO_PARTNER_CODE = "PLATFORM_PARTNER";
    process.env.MOMO_ACCESS_KEY = "PLATFORM_ACCESS";
    process.env.MOMO_SECRET_KEY = "PLATFORM_SECRET";
    process.env.VNPAY_TMN_CODE = "PLATFORM_TMN";
    process.env.VNPAY_HASH_SECRET = "PLATFORM_HASH";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
  });

  it("encrypts credentials with authenticated encryption and masks identifiers", () => {
    const credentials = normalizeCredentialPayload("momo", {
      partnerCode: "MERCHANT123456",
      accessKey: "ACCESS_VALUE",
      secretKey: "SECRET_VALUE",
    });
    const encrypted = encryptPaymentCredential(credentials);

    expect(encrypted).not.toContain("SECRET_VALUE");
    expect(encrypted).not.toContain("ACCESS_VALUE");
    expect(decryptPaymentCredential(encrypted)).toEqual(credentials);
    expect(maskCredentialIdentifier("momo", credentials)).toBe("MER••••3456");
  });

  it("creates MoMo requests with restaurant credentials instead of platform environment values", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ resultCode: 0, payUrl: "https://momo.test/pay" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const payment = {
      _id: "payment-1",
      requestId: "request-1",
      reference: "order-1",
      amount: 100000,
      metadata: { source: "order_payment", orderInfo: "Thanh toan don hang" },
      $locals: {
        paymentProviderCredentials: {
          partnerCode: "RESTAURANT_PARTNER",
          accessKey: "RESTAURANT_ACCESS",
          secretKey: "RESTAURANT_SECRET",
        },
      },
    };

    await createMomoPayment({
      payment,
      ipnUrl: "https://api.example.com/api/payments/webhooks/momo",
      returnUrl: "https://api.example.com/api/payments/return/momo",
      mode: "sandbox",
    });

    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.partnerCode).toBe("RESTAURANT_PARTNER");
    expect(payload.partnerCode).not.toBe(process.env.MOMO_PARTNER_CODE);
    expect(payload.signature).toBe(
      momoCreateSignature(payload, "RESTAURANT_ACCESS", "RESTAURANT_SECRET"),
    );
  });

  it("creates VNPAY URLs with restaurant credentials and channel selection", () => {
    const payment = {
      requestId: "request-vnp",
      reference: "order-vnp",
      amount: 250000,
      metadata: { orderInfo: "Thanh toan VNPAY" },
      $locals: {
        paymentProviderCredentials: {
          tmnCode: "RESTAURANT_TMN",
          hashSecret: "RESTAURANT_HASH",
          bankCode: "VNBANK",
        },
      },
    };

    const result = createVnpayPayment({
      payment,
      ipAddr: "127.0.0.1",
      returnUrl: "https://api.example.com/api/payments/return/vnpay",
      mode: "sandbox",
      now: new Date("2026-07-11T00:00:00.000Z"),
    });
    const url = new URL(result.payUrl);

    expect(url.searchParams.get("vnp_TmnCode")).toBe("RESTAURANT_TMN");
    expect(url.searchParams.get("vnp_TmnCode")).not.toBe(process.env.VNPAY_TMN_CODE);
    expect(url.searchParams.get("vnp_BankCode")).toBe("VNBANK");
    expect(url.searchParams.get("vnp_SecureHash")).toMatch(/^[a-f0-9]{128}$/);
  });

  it("verifies callbacks with the credential bound to the payment reference", () => {
    const payload = {
      amount: "100000",
      extraData: "",
      message: "Successful.",
      orderId: "restaurant-order-1",
      orderInfo: "Thanh toan",
      orderType: "momo_wallet",
      partnerCode: "RESTAURANT_PARTNER",
      payType: "qr",
      requestId: "request-1",
      responseTime: "1720000000000",
      resultCode: 0,
      transId: "transaction-1",
    };
    payload.signature = momoCallbackSignature(
      payload,
      "RESTAURANT_ACCESS",
      "RESTAURANT_SECRET",
    );
    primePaymentCredentialContext("momo", payload.orderId, {
      accessKey: "RESTAURANT_ACCESS",
      secretKey: "RESTAURANT_SECRET",
    });

    expect(verifyMomoCallback(payload)).toBe(true);
  });
});
