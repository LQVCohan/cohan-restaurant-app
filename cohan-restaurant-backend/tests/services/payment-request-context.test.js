import { describe, expect, it } from "vitest";
import {
  getPaymentBaseApiUrl,
  getPaymentClientIp,
} from "../../src/services/payment/paymentRequestContext.js";

describe("payment provider request context", () => {
  it("prefers and normalizes the configured public API origin", () => {
    expect(
      getPaymentBaseApiUrl({}, {
        API_PUBLIC_BASE_URL: "https://api.cohan.example///",
        PUBLIC_BASE_URL: "https://legacy.example",
      }),
    ).toBe("https://api.cohan.example");
  });

  it("falls back to the first forwarded origin", () => {
    const ctx = {
      request: {
        protocol: "http",
        headers: {
          "x-forwarded-proto": "https, http",
          "x-forwarded-host": "payments.cohan.example, internal:4000",
        },
      },
    };

    expect(getPaymentBaseApiUrl(ctx, {})).toBe("https://payments.cohan.example");
  });

  it("normalizes the first forwarded client IP", () => {
    expect(
      getPaymentClientIp({
        req: {
          headers: { "x-forwarded-for": "::ffff:203.0.113.10, 10.0.0.2" },
          ip: "10.0.0.1",
        },
      }),
    ).toBe("203.0.113.10");
  });

  it("uses the backend development origin when no request origin exists", () => {
    expect(getPaymentBaseApiUrl({}, {})).toBe("http://localhost:4000");
    expect(getPaymentClientIp({})).toBe("127.0.0.1");
  });
});
