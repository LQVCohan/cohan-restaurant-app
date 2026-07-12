function firstHeaderValue(value) {
  if (Array.isArray(value)) return String(value[0] || "").trim();
  return String(value || "").split(",")[0].trim();
}

function normalizeBaseUrl(value) {
  const text = String(value || "").trim().replace(/\/+$/, "");
  if (!text) return "";
  try {
    const url = new URL(text);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

export function getPaymentBaseApiUrl(ctx, env = process.env) {
  const configured = normalizeBaseUrl(
    env.API_PUBLIC_BASE_URL || env.PUBLIC_BASE_URL || env.APP_PUBLIC_URL,
  );
  if (configured) return configured;

  const req = ctx?.request || ctx?.req;
  const headers = req?.headers || {};
  const host = firstHeaderValue(headers["x-forwarded-host"] || headers.host);
  const protocol = firstHeaderValue(headers["x-forwarded-proto"] || req?.protocol || "http");
  const derived = host ? normalizeBaseUrl(`${protocol}://${host}`) : "";
  return derived || "http://localhost:4000";
}

export function getPaymentClientIp(ctx) {
  const req = ctx?.request || ctx?.req;
  const forwarded = firstHeaderValue(req?.headers?.["x-forwarded-for"]);
  const value = forwarded || req?.ip || req?.socket?.remoteAddress || "127.0.0.1";
  return String(value).trim().replace(/^::ffff:/, "") || "127.0.0.1";
}
