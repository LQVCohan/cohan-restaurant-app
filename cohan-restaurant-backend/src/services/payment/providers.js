import crypto from "node:crypto";
import { Buffer } from "node:buffer";
import process from "node:process";

const DEFAULT_TIMEOUT = Number(process.env.PAYMENT_PROVIDER_TIMEOUT_MS || 15000);
const DEFAULT_VNPAY_TTL_MINUTES = Number(process.env.PAYMENT_SESSION_TTL_MINUTES || 10);
const CALLBACK_CREDENTIAL_TTL_MS = 60_000;
const paymentCredentialContexts = new Map();

function credentialContextKey(provider, reference) {
  return `${String(provider || "").toLowerCase()}:${String(reference || "")}`;
}

export function primePaymentCredentialContext(provider, reference, credentials) {
  if (!provider || !reference || !credentials) return;
  const key = credentialContextKey(provider, reference);
  const entry = { credentials, expiresAt: Date.now() + CALLBACK_CREDENTIAL_TTL_MS };
  paymentCredentialContexts.set(key, entry);
  const timer = setTimeout(() => {
    if (paymentCredentialContexts.get(key) === entry) paymentCredentialContexts.delete(key);
  }, CALLBACK_CREDENTIAL_TTL_MS);
  timer.unref?.();
}

function getPaymentCredentialContext(provider, reference) {
  const key = credentialContextKey(provider, reference);
  const entry = paymentCredentialContexts.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    paymentCredentialContexts.delete(key);
    return null;
  }
  return entry.credentials;
}

function platformMomoCredentials() {
  return {
    partnerCode: String(process.env.MOMO_PARTNER_CODE || "").trim(),
    accessKey: String(process.env.MOMO_ACCESS_KEY || "").trim(),
    secretKey: String(process.env.MOMO_SECRET_KEY || "").trim(),
  };
}

function platformVnpayCredentials() {
  return {
    tmnCode: String(process.env.VNPAY_TMN_CODE || "").trim(),
    hashSecret: String(process.env.VNPAY_HASH_SECRET || "").trim(),
    bankCode: String(process.env.VNPAY_BANK_CODE || "").trim().toUpperCase(),
  };
}

function hmacSHA256(raw, key) {
  return crypto.createHmac("sha256", key).update(raw).digest("hex");
}

function hmacSHA512(raw, key) {
  return crypto.createHmac("sha512", key).update(raw).digest("hex");
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
  return String(
    payment?.metadata?.orderInfo ||
      `Thanh toan Cohan ${payment?.reference || ""}`,
  ).trim();
}

function getVnpOrderInfo(payment) {
  return getOrderInfo(payment)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9 .,:_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 255);
}

export function formatVnpDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid VNPAY date");

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}${values.month}${values.day}${values.hour}${values.minute}${values.second}`;
}

function normalizeVnpIpAddress(value) {
  const first = String(value || "127.0.0.1").split(",")[0].trim();
  return first.replace(/^::ffff:/i, "") || "127.0.0.1";
}

export async function createMomoPayment({ payment, ipnUrl, returnUrl, mode = "sandbox" }) {
  const effectiveMode = payment?.providerCredentialMode || mode;
  const endpoint =
    effectiveMode === "production"
      ? (process.env.MOMO_ENDPOINT_PRODUCTION || "https://payment.momo.vn/v2/gateway/api/create")
      : (process.env.MOMO_ENDPOINT_SANDBOX || "https://test-payment.momo.vn/v2/gateway/api/create");

  const merchant = payment?.$locals?.paymentProviderCredentials || platformMomoCredentials();
  const partnerCode = String(merchant.partnerCode || "").trim();
  const accessKey = String(merchant.accessKey || "").trim();
  const secretKey = String(merchant.secretKey || "").trim();

  if (!partnerCode || !accessKey || !secretKey) {
    throw new Error("MoMo chưa cấu hình đầy đủ tài khoản merchant.");
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
      }),
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
    const providerMessage = String(json?.message || "");
    const resultCode = Number.isFinite(Number(json?.resultCode))
      ? String(json.resultCode)
      : String(response.status || "unknown");
    if (/chữ ký không hợp lệ|invalid signature/i.test(providerMessage)) {
      const environmentLabel = effectiveMode === "production" ? "Production" : "Sandbox";
      throw new Error(
        `MoMo từ chối chữ ký (mã ${resultCode}). Kiểm tra ba thông tin merchant phải thuộc cùng một bộ ${environmentLabel}.`,
      );
    }
    throw new Error(
      `MoMo từ chối yêu cầu thanh toán (mã ${resultCode}). Vui lòng thử lại hoặc chọn phương thức khác.`,
    );
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
  const merchant = getPaymentCredentialContext("momo", payload.orderId) || platformMomoCredentials();
  const accessKey = String(merchant.accessKey || "").trim();
  const secretKey = String(merchant.secretKey || "").trim();
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
    .map(
      ([k, v]) =>
        `${encodeURIComponent(k)}=${encodeURIComponent(v).replace(/%20/g, "+")}`,
    )
    .join("&");
}

export function createVnpayPayment({
  payment,
  ipAddr = "127.0.0.1",
  returnUrl,
  mode = "sandbox",
  now = new Date(),
}) {
  const merchant = payment?.$locals?.paymentProviderCredentials || platformVnpayCredentials();
  const tmnCode = String(merchant.tmnCode || "").trim();
  const hashSecret = String(merchant.hashSecret || "").trim();
  const bankCode = String(merchant.bankCode || "").trim().toUpperCase();
  const effectiveMode = payment?.providerCredentialMode || mode;
  const baseUrl =
    effectiveMode === "production"
      ? (process.env.VNPAY_URL_PRODUCTION || "https://pay.vnpay.vn/vpcpay.html")
      : (process.env.VNPAY_URL_SANDBOX || "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html");

  if (!tmnCode || !hashSecret) {
    throw new Error("VNPAY chưa cấu hình đầy đủ tài khoản merchant.");
  }

  const createDate = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(createDate.getTime())) {
    throw new Error("Invalid VNPAY create date");
  }

  const configuredTtl =
    Number.isFinite(DEFAULT_VNPAY_TTL_MINUTES) && DEFAULT_VNPAY_TTL_MINUTES > 0
      ? DEFAULT_VNPAY_TTL_MINUTES
      : 10;
  const storedExpiry = payment?.expiresAt ? new Date(payment.expiresAt) : null;
  const expireDate =
    storedExpiry &&
    !Number.isNaN(storedExpiry.getTime()) &&
    storedExpiry.getTime() > createDate.getTime()
      ? storedExpiry
      : new Date(createDate.getTime() + configuredTtl * 60 * 1000);

  const vnpParams = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: tmnCode,
    vnp_Amount: Math.round(payment.amount * 100),
    vnp_CurrCode: "VND",
    vnp_TxnRef: payment.reference,
    vnp_OrderInfo: getVnpOrderInfo(payment),
    vnp_OrderType: process.env.VNPAY_ORDER_TYPE || "other",
    vnp_Locale: "vn",
    vnp_ReturnUrl: returnUrl,
    vnp_IpAddr: normalizeVnpIpAddress(ipAddr),
    vnp_CreateDate: formatVnpDate(createDate),
    vnp_ExpireDate: formatVnpDate(expireDate),
  };

  if (bankCode) vnpParams.vnp_BankCode = bankCode;

  const signData = buildVnpHashData(vnpParams);
  const secureHash = hmacSHA512(signData, hashSecret);
  const query = `${signData}&vnp_SecureHash=${secureHash}`;

  return {
    provider: "vnpay",
    payUrl: `${baseUrl}?${query}`,
    raw: { ...vnpParams, vnp_SecureHash: secureHash },
  };
}

export function isVnpaySuccessful(payload = {}) {
  return (
    String(payload.vnp_ResponseCode || "") === "00" &&
    String(payload.vnp_TransactionStatus || "") === "00"
  );
}

export function verifyVnpayCallback(payload = {}) {
  const merchant = getPaymentCredentialContext("vnpay", payload.vnp_TxnRef) || platformVnpayCredentials();
  const hashSecret = String(merchant.hashSecret || "").trim();
  if (!hashSecret) return false;

  const secureHash = payload.vnp_SecureHash;
  const working = Object.fromEntries(
    Object.entries(payload).filter(
      ([key, value]) =>
        key.startsWith("vnp_") &&
        !["vnp_SecureHash", "vnp_SecureHashType"].includes(key) &&
        value !== undefined &&
        value !== null,
    ),
  );

  const signData = buildVnpHashData(working);
  const expected = hmacSHA512(signData, hashSecret);
  return safeCompareString(expected, secureHash);
}
