import crypto from "node:crypto";
import { Buffer } from "node:buffer";
import process from "node:process";

const DEFAULT_TIMEOUT = Number(process.env.PAYMENT_PROVIDER_TIMEOUT_MS || 15000);

function hmacSHA256(raw, key) {
  return crypto.createHmac("sha256", key).update(raw).digest("hex");
}

function sortObject(input = {}) {
  return Object.keys(input)
    .sort()
    .reduce((acc, k) => {
      if (input[k] === undefined || input[k] === null) return acc;
      acc[k] = input[k];
      return acc;
    }, {});
}

function getOrderInfo(payment) {
  return String(payment?.metadata?.orderInfo || `Thanh toan Cohan ${payment?.reference || ""}`).trim();
}

export async function createMomoPayment({ payment, ipnUrl, returnUrl, mode = "sandbox" }) {
  const endpoint =
    mode === "production"
      ? (process.env.MOMO_ENDPOINT_PRODUCTION || "https://payment.momo.vn/v2/gateway/api/create")
      : (process.env.MOMO_ENDPOINT_SANDBOX || "https://test-payment.momo.vn/v2/gateway/api/create");

  const partnerCode = process.env.MOMO_PARTNER_CODE;
  const accessKey = process.env.MOMO_ACCESS_KEY;
  const secretKey = process.env.MOMO_SECRET_KEY;

  if (!partnerCode || !accessKey || !secretKey) {
    throw new Error("MoMo chưa cấu hình đầy đủ MOMO_PARTNER_CODE/MOMO_ACCESS_KEY/MOMO_SECRET_KEY");
  }

  const requestId = payment.requestId;
  const orderId = payment.reference;
  const payload = {
    partnerCode,
    partnerName: process.env.MOMO_PARTNER_NAME || "Cohan Restaurant",
    storeId: process.env.MOMO_STORE_ID || "cohan-store",
    requestId,
    amount: String(Math.round(payment.amount)),
    orderId,
    orderInfo: getOrderInfo(payment),
    redirectUrl: returnUrl,
    ipnUrl,
    lang: "vi",
    requestType: process.env.MOMO_REQUEST_TYPE || "captureWallet",
    autoCapture: true,
    extraData: Buffer.from(
      JSON.stringify({
        paymentId: String(payment._id),
        reservationId: payment.reservationId ? String(payment.reservationId) : null,
        source: payment?.metadata?.source || null,
      })
    ).toString("base64"),
  };

  const rawSignature =
    `accessKey=${accessKey}&amount=${payload.amount}&extraData=${payload.extraData}&ipnUrl=${payload.ipnUrl}` +
    `&orderId=${payload.orderId}&orderInfo=${payload.orderInfo}&partnerCode=${payload.partnerCode}` +
    `&redirectUrl=${payload.redirectUrl}&requestId=${payload.requestId}&requestType=${payload.requestType}`;

  payload.signature = hmacSHA256(rawSignature, secretKey);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
  });

  const json = await response.json();
  if (!response.ok || Number(json?.resultCode) !== 0) {
    throw new Error(`MoMo create payment lỗi: ${json?.message || response.statusText}`);
  }

  return {
    provider: "momo",
    payUrl: json.payUrl || json.deeplink || "",
    deeplink: json.deeplink || null,
    qrCodeUrl: json.qrCodeUrl || null,
    providerTransactionId: json.transId ? String(json.transId) : null,
    raw: json,
  };
}

export function verifyMomoCallback(payload = {}) {
  const accessKey = process.env.MOMO_ACCESS_KEY;
  const secretKey = process.env.MOMO_SECRET_KEY;
  if (!accessKey || !secretKey) return false;

  const rawSignature =
    `accessKey=${accessKey}&amount=${payload.amount}&extraData=${payload.extraData || ""}` +
    `&message=${payload.message || ""}&orderId=${payload.orderId}&orderInfo=${payload.orderInfo || ""}` +
    `&orderType=${payload.orderType || "momo_wallet"}&partnerCode=${payload.partnerCode}` +
    `&payType=${payload.payType || ""}&requestId=${payload.requestId}&responseTime=${payload.responseTime}` +
    `&resultCode=${payload.resultCode}&transId=${payload.transId}`;

  const expected = hmacSHA256(rawSignature, secretKey);
  return safeCompareString(expected, payload.signature);
}


function safeCompareString(a, b) {
  const left = String(a || "").trim();
  const right = String(b || "").trim();
  if (!left || !right) return false;

  const leftBuf = Buffer.from(left, "utf8");
  const rightBuf = Buffer.from(right, "utf8");
  if (leftBuf.length !== rightBuf.length) return false;

  try {
    return crypto.timingSafeEqual(leftBuf, rightBuf);
  } catch {
    return false;
  }
}

function buildVnpHashData(payload) {
  return Object.entries(sortObject(payload))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v).replace(/%20/g, "+")}`)
    .join("&");
}

export function createVnpayPayment({ payment, ipAddr = "127.0.0.1", returnUrl, mode = "sandbox" }) {
  const tmnCode = process.env.VNPAY_TMN_CODE;
  const hashSecret = process.env.VNPAY_HASH_SECRET;
  const baseUrl =
    mode === "production"
      ? (process.env.VNPAY_URL_PRODUCTION || "https://pay.vnpay.vn/vpcpay.html")
      : (process.env.VNPAY_URL_SANDBOX || "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html");

  if (!tmnCode || !hashSecret) {
    throw new Error("VNPAY chưa cấu hình đầy đủ VNPAY_TMN_CODE/VNPAY_HASH_SECRET");
  }

  const createDate = new Date();
  const y = createDate.getUTCFullYear();
  const m = String(createDate.getUTCMonth() + 1).padStart(2, "0");
  const d = String(createDate.getUTCDate()).padStart(2, "0");
  const hh = String(createDate.getUTCHours()).padStart(2, "0");
  const mm = String(createDate.getUTCMinutes()).padStart(2, "0");
  const ss = String(createDate.getUTCSeconds()).padStart(2, "0");

  const vnpParams = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: tmnCode,
    vnp_Amount: Math.round(payment.amount * 100),
    vnp_CurrCode: "VND",
    vnp_TxnRef: payment.reference,
    vnp_OrderInfo: getOrderInfo(payment),
    vnp_OrderType: process.env.VNPAY_ORDER_TYPE || "other",
    vnp_Locale: "vn",
    vnp_ReturnUrl: returnUrl,
    vnp_IpAddr: ipAddr,
    vnp_CreateDate: `${y}${m}${d}${hh}${mm}${ss}`,
  };

  const signData = buildVnpHashData(vnpParams);
  const secureHash = hmacSHA256(signData, hashSecret);
  const query = `${signData}&vnp_SecureHash=${secureHash}`;

  return {
    provider: "vnpay",
    payUrl: `${baseUrl}?${query}`,
    raw: { ...vnpParams, vnp_SecureHash: secureHash },
  };
}

export function verifyVnpayCallback(payload = {}) {
  const hashSecret = process.env.VNPAY_HASH_SECRET;
  if (!hashSecret) return false;

  const working = { ...payload };
  const secureHash = working.vnp_SecureHash;
  delete working.vnp_SecureHash;
  delete working.vnp_SecureHashType;

  const signData = buildVnpHashData(working);
  const expected = hmacSHA256(signData, hashSecret);
  return safeCompareString(expected, secureHash);
}
