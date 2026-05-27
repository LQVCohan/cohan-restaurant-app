import { describe, it, expect, beforeEach } from "vitest";
import { verifyMomoCallback, verifyVnpayCallback } from "../../src/services/payment/providers.js";
import crypto from "node:crypto";

function signMomo(payload) {
  const raw = `accessKey=${process.env.MOMO_ACCESS_KEY}&amount=${payload.amount}&extraData=${payload.extraData || ""}` +
    `&message=${payload.message || ""}&orderId=${payload.orderId}&orderInfo=${payload.orderInfo || ""}` +
    `&orderType=${payload.orderType || "momo_wallet"}&partnerCode=${payload.partnerCode}` +
    `&payType=${payload.payType || ""}&requestId=${payload.requestId}&responseTime=${payload.responseTime}` +
    `&resultCode=${payload.resultCode}&transId=${payload.transId}`;
  return crypto.createHmac("sha256", process.env.MOMO_SECRET_KEY).update(raw).digest("hex");
}

describe("payment provider signature checks", () => {
  beforeEach(() => {
    process.env.MOMO_ACCESS_KEY = "access";
    process.env.MOMO_SECRET_KEY = "secret";
    process.env.VNPAY_HASH_SECRET = "vnp-secret";
  });

  it("accepts and rejects momo signatures", () => {
    const payload = { amount: "1000", orderId: "o1", partnerCode: "pc", requestId: "r1", responseTime: "1", resultCode: "0", transId: "2" };
    payload.signature = signMomo(payload);
    expect(verifyMomoCallback(payload)).toBe(true);
    expect(verifyMomoCallback({ ...payload, signature: payload.signature.slice(1) + "a" })).toBe(false);
    expect(verifyMomoCallback({ ...payload, signature: "" })).toBe(false);
    expect(verifyMomoCallback({ ...payload, signature: payload.signature + "ff" })).toBe(false);
  });

  it("accepts and rejects vnpay signatures", () => {
    const payload = { vnp_Amount: "100000", vnp_Command: "pay", vnp_CreateDate: "20260101000000", vnp_CurrCode: "VND", vnp_IpAddr: "127.0.0.1", vnp_Locale: "vn", vnp_OrderInfo: "x", vnp_OrderType: "other", vnp_ReturnUrl: "https://x", vnp_TmnCode: "tmn", vnp_TxnRef: "ref", vnp_Version: "2.1.0", vnp_ResponseCode: "00", vnp_TransactionStatus: "00" };
    const sorted = Object.keys(payload).sort().map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(payload[k]).replace(/%20/g, "+")}`).join("&");
    const sig = crypto.createHmac("sha256", process.env.VNPAY_HASH_SECRET).update(sorted).digest("hex");
    expect(verifyVnpayCallback({ ...payload, vnp_SecureHash: sig })).toBe(true);
    expect(verifyVnpayCallback({ ...payload, vnp_SecureHash: sig.slice(1) + "a" })).toBe(false);
    expect(verifyVnpayCallback({ ...payload, vnp_SecureHash: "" })).toBe(false);
    expect(verifyVnpayCallback({ ...payload, vnp_SecureHash: sig + "aa" })).toBe(false);
  });
});
