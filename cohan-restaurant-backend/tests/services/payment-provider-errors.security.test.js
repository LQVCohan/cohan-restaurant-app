import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMomoPayment } from "../../src/services/payment/providers.js";

function buildCreateSignature(payload, accessKey, secretKey) {
  const raw =
    `accessKey=${accessKey}&amount=${payload.amount}&extraData=${payload.extraData}&ipnUrl=${payload.ipnUrl}` +
    `&orderId=${payload.orderId}&orderInfo=${payload.orderInfo}&partnerCode=${payload.partnerCode}` +
    `&redirectUrl=${payload.redirectUrl}&requestId=${payload.requestId}&requestType=${payload.requestType}`;
  return crypto.createHmac("sha256", secretKey).update(raw).digest("hex");
}

describe("payment provider create errors", () => {
  beforeEach(() => {
    process.env.MOMO_PARTNER_CODE = " PARTNER ";
    process.env.MOMO_ACCESS_KEY = " ACCESS ";
    process.env.MOMO_SECRET_KEY = " SECRET ";
    process.env.MOMO_REQUEST_TYPE = "captureWallet";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("trims MoMo credentials and does not expose the raw signing string", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        resultCode: 5,
        message:
          "Chữ ký không hợp lệ. accessKey=masked&ipnUrl=https://api.example.com/ipn&redirectUrl=https://api.example.com/return",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    let thrown;
    try {
      await createMomoPayment({
        payment: {
          _id: "payment-1",
          requestId: "request-1",
          reference: "order-1",
          amount: 100000,
          metadata: { source: "wallet_topup", orderInfo: "Nap vi Cohan" },
        },
        ipnUrl: "https://api.example.com/ipn",
        returnUrl: "https://api.example.com/return",
        mode: "sandbox",
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown?.message).toContain("MoMo từ chối chữ ký");
    expect(thrown?.message).toContain("cùng một bộ Sandbox");
    expect(thrown?.message).not.toContain("accessKey=");
    expect(thrown?.message).not.toContain("ipnUrl=");
    expect(thrown?.message).not.toContain("redirectUrl=");

    const sentPayload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sentPayload.partnerCode).toBe("PARTNER");
    expect(sentPayload.signature).toBe(
      buildCreateSignature(sentPayload, "ACCESS", "SECRET"),
    );
  });
});
