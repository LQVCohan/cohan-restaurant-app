import { describe, it, expect, beforeEach } from "vitest";
import {
  createVnpayPayment,
  formatVnpDate,
  verifyMomoCallback,
  verifyVnpayCallback,
} from "../../src/services/payment/providers.js";
import crypto from "node:crypto";

function signMomo(payload) {
  const raw =
    `accessKey=${process.env.MOMO_ACCESS_KEY}&amount=${payload.amount}&extraData=${payload.extraData || ""}` +
    `&message=${payload.message || ""}&orderId=${payload.orderId}&orderInfo=${payload.orderInfo || ""}` +
    `&orderType=${payload.orderType || "momo_wallet"}&partnerCode=${payload.partnerCode}` +
    `&payType=${payload.payType || ""}&requestId=${payload.requestId}&responseTime=${payload.responseTime}` +
    `&resultCode=${payload.resultCode}&transId=${payload.transId}`;
  return crypto
    .createHmac("sha256", process.env.MOMO_SECRET_KEY)
    .update(raw)
    .digest("hex");
}

function signVnpay(payload) {
  const sorted = Object.keys(payload)
    .filter((key) => key.startsWith("vnp_"))
    .sort()
    .map(
      (key) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(payload[key]).replace(/%20/g, "+")}`,
    )
    .join("&");
  return crypto
    .createHmac("sha512", process.env.VNPAY_HASH_SECRET)
    .update(sorted)
    .digest("hex");
}

describe("payment provider signature checks", () => {
  beforeEach(() => {
    process.env.MOMO_ACCESS_KEY = "access";
    process.env.MOMO_SECRET_KEY = "secret";
    process.env.VNPAY_TMN_CODE = "TESTCODE";
    process.env.VNPAY_HASH_SECRET = "vnp-secret";
    process.env.PAYMENT_SESSION_TTL_MINUTES = "10";
  });

  it("accepts and rejects momo signatures", () => {
    const payload = {
      amount: "1000",
      orderId: "o1",
      partnerCode: "pc",
      requestId: "r1",
      responseTime: "1",
      resultCode: "0",
      transId: "2",
    };
    payload.signature = signMomo(payload);
    expect(verifyMomoCallback(payload)).toBe(true);
    expect(
      verifyMomoCallback({
        ...payload,
        signature: payload.signature.slice(1) + "a",
      }),
    ).toBe(false);
    expect(verifyMomoCallback({ ...payload, signature: "" })).toBe(false);
    expect(
      verifyMomoCallback({ ...payload, signature: payload.signature + "ff" }),
    ).toBe(false);
  });

  it("accepts SHA512 VNPAY signatures and ignores non-VNP query fields", () => {
    const payload = {
      vnp_Amount: "100000",
      vnp_ResponseCode: "00",
      vnp_TransactionStatus: "00",
      vnp_TmnCode: "TESTCODE",
      vnp_TransactionNo: "123",
      vnp_TxnRef: "ref",
    };
    const signature = signVnpay(payload);

    expect(
      verifyVnpayCallback({
        ...payload,
        unrelated: "browser-only-value",
        vnp_SecureHash: signature,
      }),
    ).toBe(true);
    expect(
      verifyVnpayCallback({
        ...payload,
        vnp_SecureHash: signature.slice(1) + "a",
      }),
    ).toBe(false);
    expect(verifyVnpayCallback({ ...payload, vnp_SecureHash: "" })).toBe(false);
    expect(
      verifyVnpayCallback({
        ...payload,
        vnp_SecureHash: signature + "aa",
      }),
    ).toBe(false);
  });

  it("creates a VNPAY URL with GMT+7 dates, expiry and SHA512 checksum", () => {
    const now = new Date("2026-07-10T13:15:20.000Z");
    const result = createVnpayPayment({
      payment: {
        _id: "payment-1",
        amount: 150000,
        reference: "VNPAY-REF-1",
        expiresAt: new Date("2026-07-10T13:25:20.000Z"),
        metadata: { orderInfo: "Thanh toán hóa đơn COHAN #1" },
      },
      ipAddr: "::ffff:127.0.0.1",
      returnUrl: "https://api.example.com/api/payments/return/vnpay",
      now,
    });

    const url = new URL(result.payUrl);
    const params = Object.fromEntries(url.searchParams.entries());
    const signature = params.vnp_SecureHash;
    delete params.vnp_SecureHash;

    expect(formatVnpDate(now)).toBe("20260710201520");
    expect(params.vnp_CreateDate).toBe("20260710201520");
    expect(params.vnp_ExpireDate).toBe("20260710202520");
    expect(params.vnp_IpAddr).toBe("127.0.0.1");
    expect(params.vnp_OrderInfo).toBe("Thanh toan hoa don COHAN 1");
    expect(signature).toHaveLength(128);
    expect(signature).toBe(signVnpay(params));
  });
});
