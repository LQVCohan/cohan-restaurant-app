import { describe, expect, it } from "vitest";
import {
  buildPaymentProviderSetup,
  getPaymentBaseApiUrl,
  getPaymentClientIp,
  isPublicPaymentBaseUrl,
} from "../../src/services/payment/paymentRequestContext.js";

describe("payment request context", () => {
  it("prefers the configured public API origin and strips paths/trailing slashes", () => {
    expect(getPaymentBaseApiUrl({}, {
      API_PUBLIC_BASE_URL: "https://api.cohan.vn/provider/callback/",
      PUBLIC_BASE_URL: "https://legacy.example.com",
    })).toBe("https://api.cohan.vn");
  });

  it("uses trusted forwarded request headers when no public origin is configured", () => {
    const ctx = {
      request: {
        headers: {
          "x-forwarded-host": "payments.example.com",
          "x-forwarded-proto": "https",
          "x-forwarded-for": "203.0.113.7, 10.0.0.4",
        },
      },
    };
    expect(getPaymentBaseApiUrl(ctx, {})).toBe("https://payments.example.com");
    expect(getPaymentClientIp(ctx)).toBe("203.0.113.7");
  });

  it("builds the exact VNPAY IPN and Return URLs shown to managers", () => {
    expect(buildPaymentProviderSetup("https://api.cohan.vn/")).toMatchObject({
      publiclyReachable: true,
      vnpayIpnUrl: "https://api.cohan.vn/api/payments/webhooks/vnpay",
      vnpayReturnUrl: "https://api.cohan.vn/api/payments/return/vnpay",
    });
  });

  it("marks local and private callback origins as unreachable", () => {
    expect(isPublicPaymentBaseUrl("http://localhost:4000")).toBe(false);
    expect(isPublicPaymentBaseUrl("http://192.168.1.20:4000")).toBe(false);
    expect(isPublicPaymentBaseUrl("https://api.cohan.vn")).toBe(true);
  });
});
