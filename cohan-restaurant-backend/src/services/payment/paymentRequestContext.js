const LOCAL_HOST_PATTERNS = [
  /^localhost$/i,
  /\.localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^0\.0\.0\.0$/,
  /^::1$/,
  /\.local$/i,
];

function normalizeOrigin(value) {
  const candidate = String(value || "").trim();
  if (!candidate) return "";
  try {
    const url = new URL(candidate);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return url.origin.replace(/\/$/, "");
  } catch {
    return "";
  }
}

function firstHeaderValue(value) {
  return String(Array.isArray(value) ? value[0] : value || "")
    .split(",")[0]
    .trim();
}

export function getPaymentBaseApiUrl(ctx = {}, env = process.env) {
  for (const value of [env.API_PUBLIC_BASE_URL, env.PUBLIC_BASE_URL, env.APP_PUBLIC_URL]) {
    const origin = normalizeOrigin(value);
    if (origin) return origin;
  }

  const request = ctx?.request || ctx?.req;
  const headers = request?.headers || {};
  const host = firstHeaderValue(headers["x-forwarded-host"] || headers.host);
  const protocol = firstHeaderValue(headers["x-forwarded-proto"] || request?.protocol || "http");
  const origin = host ? normalizeOrigin(`${protocol}://${host}`) : "";
  return origin || "http://localhost:4000";
}

export function getPaymentClientIp(ctx = {}) {
  const request = ctx?.request || ctx?.req;
  const raw =
    request?.headers?.["x-forwarded-for"] ||
    request?.ip ||
    request?.socket?.remoteAddress ||
    "127.0.0.1";
  return firstHeaderValue(raw).replace(/^::ffff:/i, "") || "127.0.0.1";
}

export function isPublicPaymentBaseUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    return !LOCAL_HOST_PATTERNS.some((pattern) => pattern.test(url.hostname));
  } catch {
    return false;
  }
}

export function buildPaymentProviderSetup(baseApiUrl) {
  const publicBaseUrl = normalizeOrigin(baseApiUrl) || "http://localhost:4000";
  return {
    publicBaseUrl,
    publiclyReachable: isPublicPaymentBaseUrl(publicBaseUrl),
    vnpayReturnUrl: `${publicBaseUrl}/api/payments/return/vnpay`,
    vnpayIpnUrl: `${publicBaseUrl}/api/payments/webhooks/vnpay`,
    momoReturnUrl: `${publicBaseUrl}/api/payments/return/momo`,
    momoIpnUrl: `${publicBaseUrl}/api/payments/webhooks/momo`,
  };
}
