const PROVIDERS = ["momo", "vnpay"];
const MODES = ["sandbox", "production"];
const VNPAY_CHANNELS = new Set(["", "VNPAYQR", "VNBANK", "INTCARD"]);

function normalizeUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    url.pathname = url.pathname.replace(/\/+$/, "");
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

function isLocalHostname(hostname) {
  const value = String(hostname || "").toLowerCase();
  return (
    value === "localhost" ||
    value === "127.0.0.1" ||
    value === "0.0.0.0" ||
    value === "::1" ||
    value.endsWith(".local")
  );
}

function isPublicHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !isLocalHostname(url.hostname);
  } catch {
    return false;
  }
}

function runtimeIsProduction(env) {
  return String(env.NODE_ENV || "development").toLowerCase() === "production";
}

function requestOrigin(request) {
  const host = request?.headers?.["x-forwarded-host"] || request?.headers?.host;
  const proto = request?.headers?.["x-forwarded-proto"] || request?.protocol || "http";
  return host ? normalizeUrl(`${proto}://${host}`) : "";
}

export function getPaymentPublicBaseUrl({ env = process.env, request = null } = {}) {
  const explicit = normalizeUrl(
    env.PAYMENT_PUBLIC_BASE_URL || env.PUBLIC_BASE_URL || "",
  );
  if (explicit) return explicit;

  if (!runtimeIsProduction(env)) {
    return requestOrigin(request) || `http://localhost:${env.PORT || 4000}`;
  }
  return "";
}

export function getPaymentWebBaseUrl({ env = process.env } = {}) {
  const explicit = normalizeUrl(
    env.PAYMENT_WEB_RETURN_URL || env.PUBLIC_WEB_URL || env.APP_PUBLIC_URL || "",
  );
  if (explicit) return explicit;
  return runtimeIsProduction(env) ? "" : "http://localhost:5173";
}

export function getPlatformVnpayBankCode({ env = process.env } = {}) {
  const bankCode = String(env.VNPAY_BANK_CODE || "").trim().toUpperCase();
  return VNPAY_CHANNELS.has(bankCode) ? bankCode : "";
}

export function getProviderGatewayUrl(providerValue, modeValue, { env = process.env } = {}) {
  const provider = String(providerValue || "").trim().toLowerCase();
  const mode = String(modeValue || "sandbox").trim().toLowerCase() === "production"
    ? "production"
    : "sandbox";

  if (provider === "momo") {
    return normalizeUrl(
      mode === "production"
        ? env.MOMO_ENDPOINT_PRODUCTION || "https://payment.momo.vn/v2/gateway/api/create"
        : env.MOMO_ENDPOINT_SANDBOX || "https://test-payment.momo.vn/v2/gateway/api/create",
    );
  }
  if (provider === "vnpay") {
    return normalizeUrl(
      mode === "production"
        ? env.VNPAY_URL_PRODUCTION || "https://pay.vnpay.vn/vpcpay.html"
        : env.VNPAY_URL_SANDBOX || "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
    );
  }
  return "";
}

export function buildPaymentCallbackUrls(providerValue, options = {}) {
  const provider = String(providerValue || "").trim().toLowerCase();
  const publicBaseUrl = getPaymentPublicBaseUrl(options);
  if (!PROVIDERS.includes(provider) || !publicBaseUrl) {
    return { publicBaseUrl, returnUrl: "", ipnUrl: "" };
  }
  return {
    publicBaseUrl,
    returnUrl: `${publicBaseUrl}/api/payments/return/${provider}`,
    ipnUrl: `${publicBaseUrl}/api/payments/webhooks/${provider}`,
  };
}

export function buildPaymentWebReturnUrl({ provider, reference, status }, options = {}) {
  const webBaseUrl = getPaymentWebBaseUrl(options);
  if (!webBaseUrl) return "";
  const url = new URL(webBaseUrl);
  url.searchParams.set("paymentProvider", String(provider || ""));
  url.searchParams.set("paymentStatus", String(status || "pending"));
  if (reference) url.searchParams.set("paymentReference", String(reference));
  return url.toString();
}

function readinessFor(provider, mode, options = {}) {
  const env = options.env || process.env;
  const callbacks = buildPaymentCallbackUrls(provider, options);
  const webBaseUrl = getPaymentWebBaseUrl(options);
  const gatewayUrl = getProviderGatewayUrl(provider, mode, options);
  const hasStableEncryptionKey = Boolean(
    String(env.PAYMENT_CREDENTIAL_ENCRYPTION_KEY || "").trim(),
  );
  const encryptionReady =
    hasStableEncryptionKey || (mode === "sandbox" && !runtimeIsProduction(env));
  const callbackReady = mode === "production"
    ? isPublicHttpsUrl(callbacks.publicBaseUrl)
    : Boolean(callbacks.publicBaseUrl);
  const webReturnReady = mode === "production"
    ? isPublicHttpsUrl(webBaseUrl)
    : Boolean(webBaseUrl);
  const gatewayReady = mode === "production"
    ? isPublicHttpsUrl(gatewayUrl)
    : Boolean(gatewayUrl);
  const blockers = [];

  if (!encryptionReady) {
    blockers.push("Chủ nền tảng chưa cấu hình khóa mã hóa thông tin merchant.");
  }
  if (!callbackReady) {
    blockers.push(
      mode === "production"
        ? "URL callback production phải là HTTPS công khai, không được dùng localhost."
        : "Chủ nền tảng chưa cấu hình URL callback thanh toán.",
    );
  }
  if (!webReturnReady) {
    blockers.push(
      mode === "production"
        ? "URL website quay lại sau thanh toán phải là HTTPS công khai."
        : "Chủ nền tảng chưa cấu hình URL website quay lại sau thanh toán.",
    );
  }
  if (!gatewayReady) {
    blockers.push("Endpoint cổng thanh toán chưa hợp lệ.");
  }

  return {
    provider,
    mode,
    publicBaseUrl: callbacks.publicBaseUrl,
    webBaseUrl,
    returnUrl: callbacks.returnUrl,
    ipnUrl: callbacks.ipnUrl,
    gatewayUrl,
    paymentChannel:
      provider === "vnpay"
        ? getPlatformVnpayBankCode(options) || "AUTO"
        : String(env.MOMO_REQUEST_TYPE || "captureWallet"),
    encryptionReady,
    callbackReady,
    webReturnReady,
    ready: blockers.length === 0,
    blockers,
  };
}

export function listPaymentIntegrationReadiness(options = {}) {
  return PROVIDERS.flatMap((provider) =>
    MODES.map((mode) => readinessFor(provider, mode, options)),
  );
}
